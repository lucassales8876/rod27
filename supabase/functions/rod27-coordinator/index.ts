
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (() => {
    try {
      const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
      return keys.default ?? "";
    } catch {
      return "";
    }
  })();

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Rod27 credentials unavailable.");

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-rod27-session",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function fail(message: string, status = 400) { return json({ ok: false, error: message }, status); }

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(s: string) {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const raw = atob(p);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function sha256Hex(value: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function derive(pin: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}
async function verifyPin(pin: string, stored: string, credentialId: string) {
  if (/^\$2a\$10\$/.test(stored)) {
    const { data, error } = await db.rpc("rod27_verify_coordinator_pin", {
      p_cred_id: credentialId, p_pin: pin,
    });
    if (error) { console.error("PIN verification unavailable",error.code); return false; }
    return data === true;
  }
  try {
    const [kind, iterText, saltText, hashText] = stored.split("$");
    if (kind !== "pbkdf2-sha256") return false;
    const iterations = Number(iterText);
    if (!Number.isInteger(iterations) || iterations < 100000) return false;
    const actual = await derive(pin, fromB64url(saltText), iterations);
    const expected = fromB64url(hashText);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
function normalizeRol(value: unknown) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  return digits || s;
}
async function settingNumber(key: string, fallback: number) {
  const { data } = await db.from("configuracoes_sistema_runtime").select("valor").eq("chave", key).maybeSingle();
  const n = Number(data?.valor);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
async function contextFromCredential(credential: any) {
  const { data: coord, error: cErr } = await db
    .from("coordenacoes_setor")
    .select("id,ciclo_id,setor_id,obreiro_rol,coordenador_nome_snapshot,source")
    .eq("id", credential.coordenacao_id)
    .maybeSingle();
  if (cErr || !coord) return null;

  const [{ data: setor }, { data: page }, { data: ciclo }] = await Promise.all([
    db.from("setores").select("id,numero,area,slug").eq("id", coord.setor_id).maybeSingle(),
    db.from("paginas_coordenador").select("id,rota_slug,ativa").eq("coordenacao_id", coord.id).eq("ciclo_id", coord.ciclo_id).maybeSingle(),
    db.from("ciclos_rodizio").select("id,ano,nome,status").eq("id", coord.ciclo_id).maybeSingle(),
  ]);
  if (!setor || !page || !page.ativa || !ciclo) return null;
  return { credential, coord, setor, page, ciclo };
}
async function resolveSession(req: Request) {
  const token = req.headers.get("x-rod27-session")?.trim() ?? "";
  if (token.length < 32 || token.length > 256) return null;
  const hash = await sha256Hex(token);

  const { data: session, error } = await db
    .from("coordenador_sessoes")
    .select("id,credencial_id,expira_em,revogada_em")
    .eq("sessao_hash", hash)
    .maybeSingle();

  if (error || !session || session.revogada_em) return null;
  if (new Date(session.expira_em).getTime() <= Date.now()) return null;

  const { data: cred } = await db
    .from("coordenador_credenciais")
    .select("id,coordenacao_id,rol_login,status,versao")
    .eq("id", session.credencial_id)
    .maybeSingle();

  if (!cred || cred.status !== "ativa") return null;

  await db.from("coordenador_sessoes").update({ ultimo_uso_em: new Date().toISOString() }).eq("id", session.id);
  const ctx = await contextFromCredential(cred);
  return ctx ? { ...ctx, session } : null;
}
async function login(req: Request, body: any) {
  const rol = normalizeRol(body?.rol);
  const pin = String(body?.senha ?? "").trim();
  if (!rol || pin.length < 4 || pin.length > 64) return fail("ROL ou senha inválidos.", 401);

  const { data: cred, error } = await db
    .from("coordenador_credenciais")
    .select("id,coordenacao_id,rol_login,senha_hash,status,falhas_consecutivas,bloqueado_ate,versao")
    .eq("rol_login", rol)
    .maybeSingle();

  if (error || !cred) return fail("ROL ou senha inválidos.", 401);
  if (cred.status === "nao_configurada") return fail("O acesso deste coordenador ainda não foi liberado pela Secretaria.", 403);
  if (cred.status === "revogada") return fail("Este acesso foi desativado pela Secretaria.", 403);

  if (cred.status === "bloqueada") {
    const until = cred.bloqueado_ate ? new Date(cred.bloqueado_ate).getTime() : 0;
    if (!until || until > Date.now()) return fail("Acesso temporariamente bloqueado por tentativas incorretas. Tente novamente mais tarde.", 429);
    // Desbloqueio condicional: nunca reativa uma credencial bloqueada novamente em outra chamada.
    const { data: unlocked, error: unlockErr } = await db.from("coordenador_credenciais")
      .update({ status: "ativa", falhas_consecutivas: 0, bloqueado_ate: null })
      .eq("id", cred.id).eq("versao", cred.versao).eq("status", "bloqueada")
      .eq("falhas_consecutivas", cred.falhas_consecutivas)
      .lte("bloqueado_ate", new Date().toISOString())
      .select("id,status,falhas_consecutivas,bloqueado_ate").maybeSingle();
    if (unlockErr) return fail("Não foi possível validar o acesso.", 503);
    if (unlocked) Object.assign(cred, unlocked);
    else {
      const { data: current, error: readErr } = await db.from("coordenador_credenciais")
        .select("status,falhas_consecutivas,bloqueado_ate,versao,senha_hash").eq("id", cred.id).maybeSingle();
      if (readErr || !current) return fail("Não foi possível validar o acesso.", 503);
      Object.assign(cred, current);
      if (cred.status !== "ativa") return fail("Acesso temporariamente bloqueado ou desativado.", 429);
    }
  }

  const ok = cred.senha_hash ? await verifyPin(pin, cred.senha_hash, cred.id) : false;
  if (!ok) {
    const max = Math.max(1, Math.floor(await settingNumber("coordenador.login.max_falhas", 5)));
    const mins = await settingNumber("coordenador.login.bloqueio_minutos", 15);
    // Compare-and-swap: cada falha concorrente só incrementa o contador que leu.
    // Se outra requisição o alterou, relê e tenta novamente. Sem incremento perdido.
    for (let attempt = 0; attempt < 30; attempt++) {
      if (cred.status !== "ativa") return fail("Acesso bloqueado ou desativado.", 429);
      const prev = Number(cred.falhas_consecutivas ?? 0);
      const failures = prev + 1;
      const blocked = failures >= max;
      const { data: changed, error: writeErr } = await db.from("coordenador_credenciais")
        .update({ falhas_consecutivas: failures,
          status: blocked ? "bloqueada" : "ativa",
          bloqueado_ate: blocked ? new Date(Date.now() + mins * 60000).toISOString() : null })
        .eq("id", cred.id).eq("versao", cred.versao).eq("status", "ativa")
        .eq("falhas_consecutivas", prev).select("id").maybeSingle();
      if (writeErr) return fail("Não foi possível contabilizar a tentativa.", 503);
      if (changed) return fail(blocked
        ? "Acesso temporariamente bloqueado por tentativas incorretas."
        : "ROL ou senha inválidos.", blocked ? 429 : 401);
      const { data: current, error: readErr } = await db.from("coordenador_credenciais")
        .select("status,falhas_consecutivas,versao").eq("id", cred.id).maybeSingle();
      if (readErr || !current) return fail("Não foi possível validar o acesso.", 503);
      if (current.versao !== cred.versao) return fail("Credencial alterada. Tente entrar novamente.", 409);
      Object.assign(cred, current);
    }
    return fail("Muitas tentativas simultâneas. Tente novamente mais tarde.", 503);
  }

  // Um login válido também confirma o estado atual, sem reabrir credenciais bloqueadas
  // e sem aceitar PIN substituído depois da leitura inicial.
  const { data: granted, error: grantErr } = await db.from("coordenador_credenciais")
    .update({ falhas_consecutivas: 0, status: "ativa", bloqueado_ate: null,
      ultimo_login_em: new Date().toISOString() })
    .eq("id", cred.id).eq("versao", cred.versao).eq("status", "ativa")
    .eq("falhas_consecutivas", Number(cred.falhas_consecutivas ?? 0))
    .select("id").maybeSingle();
  if (grantErr) return fail("Não foi possível confirmar o acesso.", 503);
  if (!granted) return fail("Estado do acesso mudou. Entre novamente.", 409);

  const hours = await settingNumber("coordenador.sessao.horas", 12);
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const sessionToken = b64url(tokenBytes);
  const sessionHash = await sha256Hex(sessionToken);
  const ua = req.headers.get("user-agent") ?? "";
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0].trim();

  const { error: sErr } = await db.from("coordenador_sessoes").insert({
    credencial_id: cred.id,
    sessao_hash: sessionHash,
    expira_em: new Date(Date.now() + hours * 3600000).toISOString(),
    user_agent_hash: ua ? await sha256Hex(ua) : null,
    ip_hash: ip ? await sha256Hex(ip) : null,
  });
  if (sErr) return fail("Não foi possível iniciar a sessão.", 500);

  const ctx = await contextFromCredential(cred);
  if (!ctx) return fail("Coordenação não encontrada.", 500);

  return json({
    ok: true,
    session_token: sessionToken,
    expires_in_hours: hours,
    coordinator: {
      nome: ctx.coord.coordenador_nome_snapshot,
      rol: ctx.coord.obreiro_rol,
      setor: ctx.setor.numero,
      area: ctx.setor.area,
    },
  });
}
async function logout(req: Request) {
  const token = req.headers.get("x-rod27-session")?.trim() ?? "";
  if (token) {
    const hash = await sha256Hex(token);
    await db.from("coordenador_sessoes").update({ revogada_em: new Date().toISOString() }).eq("sessao_hash", hash);
  }
  return json({ ok: true });
}
async function getOwnedEvaluation(ctx: any, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db.from("avaliacoes_dirigente")
    .select("id,ciclo_id,coordenacao_id,congregacao_id,dirigente_rol,dirigente_nome_snapshot,dirigente_foto_url_snapshot,congregacao_nome_snapshot,eh_proprio_coordenador,status,aviso_confirmado_em,iniciada_em,enviada_em,formulario_versao,formulario_snapshot")
    .eq("id", id).eq("ciclo_id", ctx.coord.ciclo_id).eq("coordenacao_id", ctx.coord.id).maybeSingle();
  return error || data?.eh_proprio_coordenador ? null : data;
}
const MANIFEST_OPTIONS = new Set([
  "mesma_congregacao",
  "outra_congregacao_mesmo_setor",
  "congregacao_outro_setor",
]);
async function coordinatorAssignment(ctx: any) {
  if (ctx.ciclo?.ano !== 2027 && !(ctx.ciclo?.status === "homologacao" && ctx.coord.source === "homologacao")) throw new Error("Manifestação indisponível neste ciclo.");
  const { data: own, error } = await db.from("avaliacoes_dirigente")
    .select("dirigente_rol,dirigente_nome_snapshot,congregacao_id,congregacao_nome_snapshot")
    .eq("ciclo_id", ctx.coord.ciclo_id).eq("coordenacao_id", ctx.coord.id)
    .eq("eh_proprio_coordenador", true).maybeSingle();
  if (error || !own || own.dirigente_rol !== ctx.coord.obreiro_rol || own.dirigente_nome_snapshot !== ctx.coord.coordenador_nome_snapshot)
    throw new Error("Não foi possível confirmar a identificação da coordenação.");
  const { data: church, error: churchError } = await db.from("congregacoes")
    .select("id,nome,setor").eq("id", own.congregacao_id).eq("setor", ctx.setor.numero).maybeSingle();
  if (churchError || !church || church.nome !== own.congregacao_nome_snapshot)
    throw new Error("A congregação vinculada não pertence ao setor autenticado.");
  return {
    congregacao_id: church.id,
    congregacao_nome: church.nome,
    coordenador_rol: ctx.coord.obreiro_rol,
    coordenador_nome: ctx.coord.coordenador_nome_snapshot,
    setor_id: ctx.setor.id,
    setor_numero: ctx.setor.numero,
  };
}
async function currentManifestation(ctx: any) {
  const { data, error } = await db.from("manifestacoes_interesse_coordenador")
    .select("id,ciclo_id,coordenacao_id,deseja_permanecer,opcao_movimentacao,justificativa,status,criado_em,atualizado_em,enviada_em")
    .eq("ciclo_id", ctx.coord.ciclo_id).eq("coordenacao_id", ctx.coord.id).maybeSingle();
  if (error) throw error;
  return data;
}
async function saveManifestation(ctx: any, body: any, submit: boolean) {
  const identity = await coordinatorAssignment(ctx);
  const existing = await currentManifestation(ctx);
  if (existing?.status === "enviada") return fail("Manifestação já enviada e bloqueada para alterações.", 409);
  const wants = typeof body?.deseja_permanecer === "boolean" ? body.deseja_permanecer : null;
  const optionRaw = body?.opcao_movimentacao == null ? "" : String(body.opcao_movimentacao);
  if (optionRaw && !MANIFEST_OPTIONS.has(optionRaw)) return fail("Opção de movimentação inválida.", 400);
  const option = wants === true ? (optionRaw || null) : null;
  const reasonRaw = body?.justificativa == null ? "" : String(body.justificativa);
  const reason = reasonRaw.trim() || null;
  if (reasonRaw.length > 4000) return fail("A justificativa deve ter no máximo 4.000 caracteres.", 400);
  if (submit && wants === null) return fail("Responda se deseja permanecer no próximo rodízio.", 400);
  if (submit && wants === true && !option) return fail("Selecione uma opção de permanência ou mudança.", 400);
  if (submit && (wants === false || (wants === true && option !== "mesma_congregacao")) && !reason) return fail("Informe o motivo da mudança ou da saída do rodízio.", 400);
  const now = new Date().toISOString();
  const payload = {
    ciclo_id: ctx.coord.ciclo_id,
    coordenacao_id: ctx.coord.id,
    setor_id: identity.setor_id,
    congregacao_id: identity.congregacao_id,
    coordenador_rol_snapshot: identity.coordenador_rol,
    coordenador_nome_snapshot: identity.coordenador_nome,
    setor_numero_snapshot: identity.setor_numero,
    congregacao_nome_snapshot: identity.congregacao_nome,
    deseja_permanecer: wants,
    opcao_movimentacao: option,
    justificativa: reason || null,
    status: submit ? "enviada" : "rascunho",
    atualizado_em: now,
    enviada_em: submit ? now : null,
  };
  const columns = "id,ciclo_id,coordenacao_id,deseja_permanecer,opcao_movimentacao,justificativa,status,criado_em,atualizado_em,enviada_em";
  // UPDATE guardado por status, preservando o estado terminal "enviada".
  async function updateDraft() {
    return await db.from("manifestacoes_interesse_coordenador")
      .update(payload).eq("ciclo_id", ctx.coord.ciclo_id).eq("coordenacao_id", ctx.coord.id)
      .eq("status", "rascunho").select(columns).maybeSingle();
  }
  let result;
  if (existing) result = await updateDraft();
  else {
    result = await db.from("manifestacoes_interesse_coordenador")
      .insert(payload).select(columns).maybeSingle();
    // Duas requisições podem competir pelo primeiro INSERT.
    // A segunda só pode atualizar se a primeira ainda for rascunho.
    if (result.error?.code === "23505") result = await updateDraft();
  }
  if (result.error) { console.error("manifestation save failed", result.error.code); return fail("Não foi possível salvar a manifestação.", 500); }
  if (!result.data) return fail("Manifestação já enviada e bloqueada para alterações.", 409);
  const data = result.data;
  return json({ ok: true, manifestation: data });
}
async function selfEvaluationAllowed(): Promise<boolean> {
  const {data,error}=await db.from("configuracoes_sistema_runtime").select("valor")
    .eq("chave","avaliacao.autoavaliacao.permitida").maybeSingle();
  if(error){console.error("self evaluation setting unavailable",error.code);return false;}
  return data?.valor?.permitida===true;
}
async function handleAuthorized(ctx: any, body: any) {
  const action = String(body?.action ?? "");

  if (action === "bootstrap") {
    const { data: cards, error } = await db.from("avaliacoes_dirigente")
      .select("id,congregacao_nome_snapshot,dirigente_rol,dirigente_nome_snapshot,dirigente_foto_url_snapshot,eh_proprio_coordenador,status,iniciada_em,enviada_em")
      .eq("ciclo_id", ctx.coord.ciclo_id).eq("coordenacao_id", ctx.coord.id)
      .order("congregacao_nome_snapshot");
    if (error) return fail("Não foi possível carregar as avaliações.", 500);
    const allRows = cards ?? [];
    const ownRow = allRows.find((x) => x.eh_proprio_coordenador) ?? null;
    const rows = allRows.filter((x) => !x.eh_proprio_coordenador);
    let assignment: any;
    let manifestation: any;
    try {
      assignment = await coordinatorAssignment(ctx);
      manifestation = await currentManifestation(ctx);
    } catch (e) {
      console.error("manifestation bootstrap failed", e instanceof Error ? e.message : e);
      return fail("Não foi possível carregar a manifestação.", 500);
    }
    return json({
      ok: true,
      can_self_evaluate: false,
      coordinator_assignment: assignment,
      manifestation,
      coordinator: {
        nome: ctx.coord.coordenador_nome_snapshot,
        rol: ctx.coord.obreiro_rol,
        setor: ctx.setor.numero,
        area: ctx.setor.area,
      },
      ciclo: ctx.ciclo,
      progress: {
        total: rows.length,
        nao_iniciadas: rows.filter((x) => x.status === "nao_iniciada").length,
        em_preenchimento: rows.filter((x) => x.status === "em_preenchimento").length,
        enviadas: rows.filter((x) => x.status === "enviada").length,
        tratamento_especial: 0,
      },
      cards: rows,
    });
  }

  if (action === "save_manifestation") return saveManifestation(ctx, body, false);
  if (action === "submit_manifestation") return saveManifestation(ctx, body, true);

  if (action === "form") {
    const evaluation = await getOwnedEvaluation(ctx, String(body?.avaliacao_id ?? ""));
    if (!evaluation) return fail("Avaliação não encontrada neste setor.", 404);
    const [{ data: config }, { data: questions }, { data: answers }] = await Promise.all([
      db.from("configuracoes_avaliacao").select("versao,status,titulo_aviso,texto_aviso,permite_edicao_apos_envio").eq("ciclo_id", ctx.coord.ciclo_id).maybeSingle(),
      db.from("perguntas_avaliacao").select("id,codigo,categoria,titulo,enunciado,tipo_resposta,opcoes,obrigatoria,ordem,status").eq("ciclo_id", ctx.coord.ciclo_id).eq("ativa", true).eq("status","publicada").order("ordem"),
      db.from("respostas_avaliacao").select("pergunta_id,resposta_texto,resposta_opcao,atualizado_em").eq("avaliacao_id", evaluation.id),
    ]);
    return json({
      ok: true, evaluation, config: evaluation.formulario_snapshot?.config ?? config, questions: config?.status === "publicado" ? (evaluation.formulario_snapshot?.questions ?? questions ?? []) : [], answers: answers ?? [],
      editable: config?.status === "publicado" && evaluation.status !== "enviada" && (!evaluation.eh_proprio_coordenador || await selfEvaluationAllowed()),
      special_reason: evaluation.eh_proprio_coordenador && !(await selfEvaluationAllowed())
        ? "A avaliação do próprio coordenador será tratada separadamente pela Secretaria."
        : null,
    });
  }

  if (action === "confirm_notice") {
    const {data:pubConfig}=await db.from("configuracoes_avaliacao").select("status").eq("ciclo_id",ctx.coord.ciclo_id).maybeSingle();
    if(pubConfig?.status!=="publicado")return fail("Formulário ainda não publicado pela Secretaria.",409);
    const evaluation = await getOwnedEvaluation(ctx, String(body?.avaliacao_id ?? ""));
    if (!evaluation) return fail("Avaliação não encontrada.", 404);
    if (evaluation.eh_proprio_coordenador && !(await selfEvaluationAllowed())) return fail("Autoavaliação está desabilitada pela Secretaria.", 409);
    if (evaluation.status === "enviada") return fail("Esta avaliação já foi enviada.", 409);
    const { error } = await db.from("avaliacoes_dirigente")
      .update({ aviso_confirmado_em: new Date().toISOString() })
      .eq("id", evaluation.id).eq("coordenacao_id", ctx.coord.id);
    return error ? fail("Não foi possível iniciar a avaliação.", 500) : json({ ok: true });
  }

  if (action === "save_answer") {
    const {data:pubConfig}=await db.from("configuracoes_avaliacao").select("status").eq("ciclo_id",ctx.coord.ciclo_id).maybeSingle();
    if(pubConfig?.status!=="publicado")return fail("Formulário ainda não publicado pela Secretaria.",409);
    const evaluation = await getOwnedEvaluation(ctx, String(body?.avaliacao_id ?? ""));
    if (!evaluation) return fail("Avaliação não encontrada.", 404);
    if (evaluation.eh_proprio_coordenador && !(await selfEvaluationAllowed())) return fail("Autoavaliação está desabilitada pela Secretaria.", 409);
    if (evaluation.status === "enviada") return fail("Esta avaliação já foi enviada e está bloqueada.", 409);
    if (!evaluation.aviso_confirmado_em) return fail("Confirme o aviso antes de preencher.", 409);

    const code = String(body?.codigo ?? "").trim();
    const value = String(body?.resposta ?? "").trim();
    if (!value) return fail("A resposta não pode ficar vazia.", 400);
    if (value.length > 12000) return fail("Resposta muito longa.", 400);

    const frozenQuestions = evaluation.formulario_snapshot?.questions;
    let q: any = Array.isArray(frozenQuestions)
      ? frozenQuestions.find((item: any) => item.codigo === code) ?? null
      : null;
    if (!Array.isArray(frozenQuestions)) {
      const { data: current } = await db.from("perguntas_avaliacao")
        .select("id,codigo,tipo_resposta,opcoes").eq("ciclo_id", ctx.coord.ciclo_id)
        .eq("codigo", code).eq("ativa", true).eq("status","publicada").maybeSingle();
      q = current;
    }
    if (!q) return fail("Pergunta não pertence à versão desta avaliação.", 400);

    const payload: Record<string, unknown> = {
      avaliacao_id: evaluation.id, pergunta_id: q.id, atualizado_em: new Date().toISOString(),
      resposta_texto: null, resposta_opcao: null,
    };
    if (q.tipo_resposta === "texto_longo") payload.resposta_texto = value;
    else {
      const options = Array.isArray(q.opcoes) ? q.opcoes : [];
      if (!options.includes(value)) return fail("Opção inválida.", 400);
      payload.resposta_opcao = value;
    }

    const { error } = await db.from("respostas_avaliacao").upsert(payload, { onConflict: "avaliacao_id,pergunta_id" });
    return error ? fail("Não foi possível salvar esta resposta.", 500) : json({ ok: true, saved_at: new Date().toISOString() });
  }

  if (action === "submit") {
    const {data:pubConfig}=await db.from("configuracoes_avaliacao").select("status").eq("ciclo_id",ctx.coord.ciclo_id).maybeSingle();
    if(pubConfig?.status!=="publicado")return fail("Formulário ainda não publicado pela Secretaria.",409);
    const evaluation = await getOwnedEvaluation(ctx, String(body?.avaliacao_id ?? ""));
    if (!evaluation) return fail("Avaliação não encontrada.", 404);
    if (evaluation.eh_proprio_coordenador && !(await selfEvaluationAllowed())) return fail("Autoavaliação está desabilitada pela Secretaria.", 409);
    if (evaluation.status === "enviada") return fail("Esta avaliação já foi enviada.", 409);

    const { data, error } = await db.from("avaliacoes_dirigente")
      .update({ status: "enviada" }).eq("id", evaluation.id).eq("coordenacao_id", ctx.coord.id)
      .select("id,status,enviada_em").single();

    if (error) {
      const m = String(error.message ?? "");
      if (m.includes("perguntas obrigatórias")) return fail("Ainda existem perguntas obrigatórias sem resposta.", 409);
      if (m.includes("aviso")) return fail("Confirme o aviso antes do envio.", 409);
      return fail("Não foi possível enviar a avaliação.", 500);
    }
    return json({ ok: true, evaluation: data });
  }

  return fail("Ação desconhecida.", 400);
}

const PAGE_HTML="<!doctype html>\n<html lang=\"pt-BR\"><head>\n<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"robots\" content=\"noindex,nofollow,noarchive\"><meta name=\"theme-color\" content=\"#17223b\">\n<title>Acesso</title>\n<style>\n:root{--n:#17223b;--n2:#273a62;--p:#f5f2ec;--i:#182033;--m:#68707d;--l:#e4ded3;--g:#1f7a55;--a:#9a6418;--r:#a53d3d;--gold:#b7873f}\n*{box-sizing:border-box}body{margin:0;background:var(--p);color:var(--i);font:15px/1.5 system-ui,-apple-system,\"Segoe UI\",sans-serif}button,input,textarea{font:inherit}button{cursor:pointer}.shell{max-width:960px;margin:auto;min-height:100vh;padding-bottom:50px}\n.hero{background:linear-gradient(145deg,var(--n),var(--n2));color:#fff;padding:28px 20px;border-radius:0 0 28px 28px}.ey{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#dbc69d;font-weight:800}.hero h1{margin:5px 0}.hero p{margin:0;opacity:.85}.top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.badges{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}.badge{font-size:12px;padding:6px 9px;border-radius:99px;background:#ffffff17;border:1px solid #ffffff20}\nmain{padding:18px}.prog{background:#fff;border:1px solid var(--l);border-radius:17px;padding:13px;margin-bottom:12px}.bar{height:8px;background:#ece7de;border-radius:99px;margin-top:8px;overflow:hidden}.bar i{display:block;height:100%;background:var(--g)}.filters{display:flex;gap:7px;overflow:auto;margin-bottom:12px}.chip{white-space:nowrap;border:1px solid var(--l);background:#fff;border-radius:99px;padding:7px 10px}.chip.on{background:var(--n);color:#fff}\n.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}.card{background:#fff;border:1px solid var(--l);border-radius:18px;padding:12px;display:grid;grid-template-columns:58px 1fr auto;gap:11px;align-items:center}.card button{display:contents}.photo{width:58px;height:58px;border-radius:15px;object-fit:cover;background:#eee}.name{font-weight:800;line-height:1.25}.church{font-size:13px;color:var(--m);margin-top:2px}.state{font-size:10px;font-weight:900;text-transform:uppercase;border-radius:99px;padding:5px 7px}.new{background:#eef1f5}.draft{background:#fff1cf;color:var(--a)}.sent{background:#dff3e9;color:var(--g)}.special{background:#f2e8f7;color:#72438b}\n.login{max-width:430px;margin:72px auto;background:#fff;border:1px solid var(--l);border-radius:24px;padding:25px}.login h2{margin:5px 0}.field{margin:12px 0}.field label{display:block;font-size:12px;font-weight:800;margin-bottom:5px}.field input{width:100%;border:1px solid #d6d0c6;border-radius:11px;padding:12px}.muted{color:var(--m)}.error{color:var(--r);font-size:13px;min-height:20px}.btn{border:0;border-radius:12px;padding:10px 14px;font-weight:800}.primary{background:var(--n);color:#fff}.ghost{background:#eee9e1}.danger{background:var(--r);color:#fff}.small{font-size:12px;padding:7px 9px}\n.back{position:fixed;inset:0;background:#0c12218a;display:none;align-items:flex-end;justify-content:center;z-index:30}.back.show{display:flex}.modal{width:min(720px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:25px 25px 0 0;padding:19px}.warn{background:#fff8e9;border-left:4px solid var(--gold);padding:11px;border-radius:10px;margin:13px 0}.actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:15px}.head{display:flex;gap:11px;align-items:center;padding-bottom:13px;border-bottom:1px solid var(--l)}.head img{width:56px;height:56px;border-radius:14px;object-fit:cover;background:#eee}.q{padding:14px 0;border-bottom:1px solid var(--l)}.qn{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);font-weight:900}.q h3{margin:3px 0 5px;font-size:17px}.q p{margin:0 0 9px;color:#5f6673}textarea{width:100%;min-height:120px;border:1px solid #d8d2c8;border-radius:12px;padding:10px;resize:vertical}.op{display:flex;gap:8px;padding:9px;border:1px solid var(--l);border-radius:10px;margin:6px 0}.save{font-size:11px;color:var(--m);min-height:16px;margin-top:4px}.review{background:#f7f5f0;border:1px solid var(--l);border-radius:13px;padding:11px}.review p{white-space:pre-wrap;margin:4px 0 11px}.toast{position:fixed;left:50%;bottom:16px;transform:translateX(-50%) translateY(20px);background:var(--n);color:#fff;padding:9px 12px;border-radius:10px;opacity:0;transition:.2s;z-index:50}.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}\n@media(min-width:720px){.hero{margin-top:18px;border-radius:26px}.back{align-items:center}.modal{border-radius:24px}}\n</style></head><body>\n<div id=\"app\" class=\"shell\"></div><div id=\"back\" class=\"back\"><div id=\"modal\" class=\"modal\"></div></div><div id=\"toast\" class=\"toast\"></div>\n<script>\nvar S={session:sessionStorage.getItem(\"rod27_session\")||null,data:null,filter:\"all\",cur:null,form:null,timers:new Map(),saveChains:new Map(),failedSaves:new Set()},app=document.getElementById(\"app\"),back=document.getElementById(\"back\"),box=document.getElementById(\"modal\");\nfunction e(v){return String(v==null?\"\":v).replace(/[&<>\"']/g,function(x){return{\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",\"\\\"\":\"&quot;\",\"'\":\"&#39;\"}[x]})}\nfunction toast(m){var x=document.getElementById(\"toast\");x.textContent=m;x.classList.add(\"show\");setTimeout(function(){x.classList.remove(\"show\")},2200)}\nasync function post(action,p,auth){var h={\"Content-Type\":\"application/json\"};if(auth!==false&&S.session)h[\"X-Rod27-Session\"]=S.session;var r=await fetch(\"https://zrjxxcytgtjuuinhkfux.supabase.co/functions/v1/rod27-coordinator\",{method:\"POST\",headers:h,body:JSON.stringify(Object.assign({action:action},p||{}))});var j=await r.json().catch(function(){return{ok:false,error:\"Resposta inválida.\"}});if(r.status===401&&auth!==false&&S.session){S.session=null;sessionStorage.removeItem(\"rod27_session\");S.timers.forEach(function(x){clearTimeout(x.timer)});S.timers.clear();back.classList.remove(\"show\");loginView(\"Sua sessão expirou. Entre novamente.\");throw new Error(\"Sessão expirada.\")}if(!r.ok||!j.ok)throw new Error(j.error||\"Falha na comunicação.\");return j}\nfunction toggleSenha(btn){\n var fields=(btn.getAttribute(\"data-password-ids\")||\"\").split(\",\").map(function(id){return document.getElementById(id)}).filter(Boolean);\n if(!fields.length)return;\n var reveal=fields[0].type===\"password\";\n fields.forEach(function(input){input.type=reveal?\"text\":\"password\"});\n btn.textContent=reveal?\"Ocultar senha\":\"Mostrar senha\";\n btn.setAttribute(\"aria-pressed\",reveal?\"true\":\"false\");\n}\nfunction loginView(msg){app.innerHTML='<div class=\"login\"><h2>Acesso</h2><div class=\"field\"><label>Identificador</label><input id=\"rol\" inputmode=\"numeric\" autocomplete=\"username\"></div><div class=\"field\"><label>Senha de acesso</label><input id=\"pin\" type=\"password\" inputmode=\"numeric\" autocomplete=\"current-password\" placeholder=\"••••••\"><button type=\"button\" data-password-ids=\"pin\" aria-pressed=\"false\" onclick=\"toggleSenha(this)\" style=\"margin-top:8px;padding:6px 0;border:0;background:transparent;color:#273a62;font:inherit;font-size:13px;font-weight:700;cursor:pointer\">Mostrar senha</button></div><div id=\"err\" class=\"error\">'+e(msg||\"\")+'</div><button class=\"btn primary\" style=\"width:100%\" onclick=\"login()\">Entrar</button><p style=\"text-align:center\"><a href=\"#\" onclick=\"recoverCoordinator();return false\">Esqueci a senha</a></p></div>'}\nwindow.recoverCoordinator=function(){toast(\"Solicite a redefinição do acesso.\");};\nwindow.login=async function(){var rol=document.getElementById(\"rol\").value.trim(),senha=document.getElementById(\"pin\").value.trim(),err=document.getElementById(\"err\");err.textContent=\"Entrando…\";try{var d=await post(\"login\",{rol:rol,senha:senha},false);S.session=d.session_token;sessionStorage.setItem(\"rod27_session\",S.session);await boot()}catch(x){err.textContent=x.message}}\nwindow.logout=async function(){try{if(S.session)await post(\"logout\")}catch(x){}S.session=null;sessionStorage.removeItem(\"rod27_session\");loginView()}\nfunction tag(c){if(c.eh_proprio_coordenador&&S.data&&!S.data.can_self_evaluate)return[\"Coordenação\",\"special\"];if(c.status===\"enviada\")return[\"Enviada\",\"sent\"];if(c.status===\"em_preenchimento\")return[\"Em andamento\",\"draft\"];return[\"Avaliar\",\"new\"]}\nfunction filt(k,l){return'<button class=\"chip '+(S.filter===k?\"on\":\"\")+'\" onclick=\"setF(&quot;'+k+'&quot;)\">'+l+'</button>'}\nfunction card(c){var t=tag(c);return'<div class=\"card\"><button onclick=\"openC(&quot;'+c.id+'&quot;)\"><img class=\"photo\" src=\"'+e(c.dirigente_foto_url_snapshot||\"\")+'\" alt=\"\" onerror=\"this.style.visibility=&quot;hidden&quot;\"><div><div class=\"name\">'+e(c.dirigente_nome_snapshot)+'</div><div class=\"church\">'+e(c.congregacao_nome_snapshot)+'</div></div><span class=\"state '+t[1]+'\">'+t[0]+'</span></button></div>'}\nfunction manifestationOptionLabel(v){return ({mesma_congregacao:\"Permanecer na mesma congregação\",outra_congregacao_mesmo_setor:\"Mudar para outra congregação do mesmo setor\",congregacao_outro_setor:\"Mudar para uma congregação de outro setor\"})[v]||\"\"}\nfunction manifestationPanel(){var m=S.data.manifestation,a=S.data.coordinator_assignment,status=!m?\"Aguardando preenchimento\":m.status===\"enviada\"?\"Enviada\":\"Rascunho salvo\";var h='<section class=\"prog\"><div class=\"top\"><div><div class=\"ey\">Rodízio 2027</div><h2 style=\"margin:3px 0\">Manifestação de Interesse</h2></div><span class=\"state '+(m&&m.status===\"enviada\"?\"sent\":m?\"draft\":\"new\")+'\">'+e(status)+'</span></div><p><strong>'+e(a.coordenador_nome)+'</strong> · ROL '+e(a.coordenador_rol)+'<br>Setor '+e(a.setor_numero)+' · '+e(a.congregacao_nome)+'</p>';if(m&&m.status===\"enviada\"){h+='<p><strong>Resposta:</strong> '+(m.deseja_permanecer?\"Sim — \"+e(manifestationOptionLabel(m.opcao_movimentacao)):\"Não\")+(m.justificativa?'<br><strong>Justificativa:</strong> '+e(m.justificativa):\"\")+'</p>'}h+='<div class=\"actions\"><button class=\"btn primary small\" onclick=\"openManifest()\">'+(m&&m.status===\"enviada\"?\"Ver manifestação\":\"Preencher manifestação\")+'</button><button class=\"btn ghost small\" onclick=\"printBlankManifestation()\">Imprimir formulário em branco</button></div></section>';return h}\nfunction render(){var d=S.data,u=d.progress.total,p=u?Math.round(d.progress.enviadas/u*100):0,rows=d.cards.filter(function(c){return S.filter===\"all\"||c.status===S.filter});app.innerHTML='<section class=\"hero\"><div class=\"top\"><div><div class=\"ey\">Rodízio 2027 · Área '+e(d.coordinator.area)+'</div><h1>Setor '+d.coordinator.setor+'</h1><p>'+e(d.coordinator.nome)+' · ROL '+e(d.coordinator.rol)+'</p></div><button class=\"btn ghost small\" onclick=\"logout()\">Sair</button></div><div class=\"badges\"><span class=\"badge\">'+d.progress.total+' dirigentes</span><span class=\"badge\">'+d.progress.enviadas+' enviados</span><span class=\"badge\">'+d.progress.em_preenchimento+' em andamento</span></div></section><main>'+manifestationPanel()+'<div class=\"prog\"><strong>Progresso das avaliações dos demais dirigentes</strong><span style=\"float:right\">'+d.progress.enviadas+'/'+u+'</span><div class=\"bar\"><i style=\"width:'+p+'%\"></i></div></div><div class=\"filters\">'+filt(\"all\",\"Todos\")+filt(\"nao_iniciada\",\"Não iniciadas\")+filt(\"em_preenchimento\",\"Em andamento\")+filt(\"enviada\",\"Enviadas\")+'</div><div class=\"grid\">'+(rows.map(card).join(\"\")||'<span class=\"muted\">Nenhum dirigente neste filtro.</span>')+'</div></main>'}\nfunction manifestOptionHtml(value,label,selected){return '<label class=\"op\"><input type=\"radio\" name=\"manifest-option\" value=\"'+value+'\" '+(selected?\"checked\":\"\")+' onchange=\"manifestToggle()\"><span>'+label+'</span></label>'}\nfunction manifestationSummary(m){return '<div class=\"review\"><b>Deseja permanecer no próximo rodízio?</b><p>'+(m.deseja_permanecer?\"Sim\":\"Não\")+'</p>'+(m.opcao_movimentacao?'<b>Opção</b><p>'+e(manifestationOptionLabel(m.opcao_movimentacao))+'</p>':\"\")+(m.justificativa?'<b>Justificativa</b><p>'+e(m.justificativa)+'</p>':\"\")+'<b>Enviada em</b><p>'+e(new Date(m.enviada_em).toLocaleString(\"pt-BR\"))+'</p></div>'}\nwindow.openManifest=function(){var m=S.data.manifestation,a=S.data.coordinator_assignment,h='<div class=\"ey\">RODÍZIO 2027</div><h2>Manifestação de Interesse para o Próximo Rodízio</h2><p class=\"muted\">'+e(a.coordenador_nome)+' · ROL '+e(a.coordenador_rol)+'<br>Setor '+e(a.setor_numero)+' · '+e(a.congregacao_nome)+'</p>';if(m&&m.status===\"enviada\"){h+='<div class=\"warn\"><strong>Manifestação enviada.</strong> As respostas foram registradas separadamente das avaliações.</div>'+manifestationSummary(m)+'<div class=\"actions\"><button class=\"btn primary\" onclick=\"closeM()\">Fechar</button></div>';box.innerHTML=h;back.classList.add(\"show\");return}h+='<section class=\"q\"><h3>Deseja permanecer no rodízio do próximo ano?</h3><label class=\"op\"><input type=\"radio\" name=\"manifest-choice\" value=\"yes\" '+(m&&m.deseja_permanecer===true?\"checked\":\"\")+' onchange=\"manifestToggle()\"><span>Sim</span></label><label class=\"op\"><input type=\"radio\" name=\"manifest-choice\" value=\"no\" '+(m&&m.deseja_permanecer===false?\"checked\":\"\")+' onchange=\"manifestToggle()\"><span>Não</span></label></section><section id=\"manifestMoves\" class=\"q\" hidden><h3>Se deseja permanecer, qual opção prefere?</h3>'+manifestOptionHtml(\"mesma_congregacao\",\"Permanecer na mesma congregação\",m&&m.opcao_movimentacao===\"mesma_congregacao\")+manifestOptionHtml(\"outra_congregacao_mesmo_setor\",\"Mudar para outra congregação do mesmo setor\",m&&m.opcao_movimentacao===\"outra_congregacao_mesmo_setor\")+manifestOptionHtml(\"congregacao_outro_setor\",\"Mudar para uma congregação de outro setor\",m&&m.opcao_movimentacao===\"congregacao_outro_setor\")+'</section><section id=\"manifestReason\" class=\"q\" hidden><h3>Motivo da sua preferência</h3><p>Explique sua preferência ao pastor. Para mudança ou saída, a justificativa é obrigatória.</p><textarea id=\"manifestJustification\" maxlength=\"4000\" placeholder=\"Justificativa obrigatória\">'+e(m&&m.justificativa||\"\")+'</textarea></section><div class=\"actions\"><button class=\"btn ghost\" onclick=\"closeM()\">Cancelar</button><button class=\"btn ghost\" onclick=\"saveManifest(false)\">Salvar rascunho</button><button class=\"btn primary\" onclick=\"saveManifest(true)\">Enviar manifestação</button></div>';box.innerHTML=h;back.classList.add(\"show\");manifestToggle()};\nwindow.manifestToggle=function(){var choice=document.querySelector('input[name=\"manifest-choice\"]:checked'),yes=choice&&choice.value===\"yes\",no=choice&&choice.value===\"no\",moves=document.getElementById(\"manifestMoves\"),reason=document.getElementById(\"manifestReason\"),just=document.getElementById(\"manifestJustification\");if(!moves)return;moves.hidden=!yes;reason.hidden=!(yes||no);Array.from(document.querySelectorAll('input[name=\"manifest-option\"]')).forEach(function(x){x.required=!!yes;x.disabled=!yes});if(just){just.required=!!no||!!(yes&&document.querySelector('input[name=\"manifest-option\"]:checked')?.value!==\"mesma_congregacao\");just.disabled=!(yes||no)}};\nwindow.saveManifest=async function(submit){var choice=document.querySelector('input[name=\"manifest-choice\"]:checked'),option=document.querySelector('input[name=\"manifest-option\"]:checked'),just=document.getElementById(\"manifestJustification\"),payload={deseja_permanecer:choice?choice.value===\"yes\":null,opcao_movimentacao:option?option.value:null,justificativa:just?just.value:null};if(submit&&!choice){toast(\"Responda se deseja permanecer.\");return}if(submit&&choice.value===\"yes\"&&!option){toast(\"Selecione uma das opções de permanência ou mudança.\");return}if(submit&&(choice.value===\"no\"||(choice.value===\"yes\"&&option&&option.value!==\"mesma_congregacao\"))&&(!just||!just.value.trim())){toast(\"Explique o motivo da mudança ou saída.\");return}try{var r=await post(submit?\"submit_manifestation\":\"save_manifestation\",payload);S.data.manifestation=r.manifestation;toast(submit?\"Manifestação enviada.\":\"Rascunho salvo.\");if(submit){closeM();render()} }catch(x){toast(x.message)}};\nwindow.printBlankManifestation=function(){var w=window.open(\"\",\"_blank\");if(!w){toast(\"Permita a abertura da janela de impressão.\");return}var doc='<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Manifestação de Interesse · Rodízio 2027</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:12pt/1.45 Arial,sans-serif;color:#111;margin:0}h1{text-align:center;font-size:17pt;margin:0 0 4mm}.sub{text-align:center;margin:0 0 9mm;font-size:11pt}.field{margin:5mm 0}.line{display:inline-block;border-bottom:1px solid #111;min-width:90mm;height:7mm}.short{min-width:40mm}.question{font-weight:bold;margin:8mm 0 3mm}.choice{margin:3mm 0}.circle{display:inline-block;border:1px solid #111;border-radius:50%;width:4mm;height:4mm;margin-right:2mm;vertical-align:middle}.indent{margin-left:8mm}.rule{border-bottom:1px solid #555;height:9mm}.sign{margin-top:17mm;display:flex;gap:14mm}.sign div{flex:1;border-top:1px solid #111;text-align:center;padding-top:2mm}.footer{margin-top:8mm;font-size:10pt}</style></head><body><h1>Manifestação de Interesse<br>para o Próximo Rodízio — 2027</h1><p class=\"sub\">Secretaria Geral da IEADERN</p><div class=\"field\"><b>Nome:</b> <span class=\"line\"></span></div><div class=\"field\"><b>ROL:</b> <span class=\"line short\"></span> <b>Setor:</b> <span class=\"line short\"></span></div><div class=\"field\"><b>Congregação atual:</b> <span class=\"line\"></span></div><div class=\"question\">Deseja permanecer no rodízio do próximo ano?</div><div class=\"choice\"><span class=\"circle\"></span> Sim</div><div class=\"choice\"><span class=\"circle\"></span> Não</div><div class=\"question\">Se respondeu Sim, indique sua preferência:</div><div class=\"choice indent\"><span class=\"circle\"></span> Permanecer na mesma congregação</div><div class=\"choice indent\"><span class=\"circle\"></span> Mudar para outra congregação do mesmo setor</div><div class=\"choice indent\"><span class=\"circle\"></span> Mudar para uma congregação de outro setor</div><div class=\"question\">Se respondeu Não, justifique:</div><div class=\"rule\"></div><div class=\"rule\"></div><div class=\"rule\"></div><div class=\"sign\"><div>Data</div><div>Assinatura</div></div></body></html>';w.document.open();w.document.write(doc);w.document.close();w.focus();setTimeout(function(){w.print()},300)};window.setF=function(k){S.filter=k;render()};\nasync function closeM(){if(S.timers.size||S.saveChains.size){if(!await flushPending(S.cur&&S.cur.id)){toast(\"Existem respostas não salvas. Corrija antes de fechar.\");return}}back.classList.remove(\"show\");box.innerHTML=\"\"}window.closeM=closeM;back.addEventListener(\"click\",function(x){if(x.target===back)closeM()});\nwindow.openC=async function(id){var c=S.data.cards.find(function(x){return x.id===id});if(c.eh_proprio_coordenador&&!S.data.can_self_evaluate){box.innerHTML='<h2>'+e(c.dirigente_nome_snapshot)+'</h2><p>'+e(c.congregacao_nome_snapshot)+'</p><div class=\"warn\"><strong>Ficha da coordenação</strong><br>A avaliação do próprio coordenador será tratada separadamente pela Secretaria.</div><div class=\"actions\"><button class=\"btn primary\" onclick=\"closeM()\">Entendi</button></div>';back.classList.add(\"show\");return}if(c.status===\"nao_iniciada\"){try{var f=await post(\"form\",{avaliacao_id:id});S.form=f;S.cur=c;box.innerHTML='<h2>'+e(f.config.titulo_aviso)+'</h2><div class=\"warn\">'+e(f.config.texto_aviso)+'</div><p class=\"muted\">Você pode salvar e continuar depois. O bloqueio definitivo ocorre apenas no envio.</p><div class=\"actions\"><button class=\"btn ghost\" onclick=\"closeM()\">Cancelar</button><button class=\"btn primary\" onclick=\"startE()\">Entendi, iniciar</button></div>';back.classList.add(\"show\")}catch(x){toast(x.message)}}else loadF(id)};\nwindow.startE=async function(){try{await post(\"confirm_notice\",{avaliacao_id:S.cur.id});await loadF(S.cur.id,true)}catch(x){toast(x.message)}};\nasync function loadF(id,keep){try{var f=await post(\"form\",{avaliacao_id:id});S.form=f;S.cur=S.data.cards.find(function(x){return x.id===id});var ans=new Map((f.answers||[]).map(function(a){return[a.pergunta_id,a.resposta_texto!=null?a.resposta_texto:(a.resposta_opcao||\"\")]})),h='<div class=\"head\"><img src=\"'+e(f.evaluation.dirigente_foto_url_snapshot||\"\")+'\" alt=\"\"><div><div class=\"ey\">Avaliação do dirigente</div><h2 style=\"margin:2px 0\">'+e(f.evaluation.dirigente_nome_snapshot)+'</h2><div class=\"church\">'+e(f.evaluation.congregacao_nome_snapshot)+'</div></div></div>';if(f.evaluation.status===\"enviada\")h+='<div class=\"warn\"><strong>Avaliação enviada.</strong> Somente leitura.</div>';h+=(f.questions||[]).map(function(q,i){return qHtml(q,i,ans.get(q.id)||\"\",f.evaluation.status===\"enviada\")}).join(\"\");h+='<div class=\"actions\"><button class=\"btn ghost\" onclick=\"closeM()\">Fechar</button>'+(f.evaluation.status!==\"enviada\"?'<button class=\"btn primary\" onclick=\"reviewE()\">Revisar e enviar</button>':\"\")+'</div>';box.innerHTML=h;back.classList.add(\"show\")}catch(x){toast(x.message);if(!keep)closeM()}}window.loadF=loadF;\nfunction qHtml(q,i,v,ro){var x=\"\";if(q.tipo_resposta===\"escolha_unica\")x=(q.opcoes||[]).map(function(o){return'<label class=\"op\"><input type=\"radio\" name=\"q_'+q.id+'\" value=\"'+e(o)+'\" '+(v===o?\"checked\":\"\")+' '+(ro?\"disabled\":\"\")+' onchange=\"queue(&quot;'+q.codigo+'&quot;,this.value,&quot;'+q.id+'&quot;)\"><span>'+e(o)+'</span></label>'}).join(\"\");else x='<textarea '+(ro?\"disabled\":\"\")+' data-qid=\"'+q.id+'\" oninput=\"queue(&quot;'+q.codigo+'&quot;,this.value,&quot;'+q.id+'&quot;)\">'+e(v)+'</textarea>';return'<section class=\"q\"><div class=\"qn\">Pergunta '+(i+1)+' · '+e(q.categoria)+'</div><h3>'+e(q.titulo)+'</h3><p>'+e(q.enunciado)+'</p>'+x+'<div id=\"s_'+q.id+'\" class=\"save\"></div></section>'}\nwindow.queue=function(c,v,id){\n  var evalId=S.cur&&S.cur.id;\n  if(!evalId)return;\n  var l=document.getElementById(\"s_\"+id);if(l)l.textContent=\"Alteração pendente…\";\n  var previous=S.timers.get(id);if(previous)clearTimeout(previous.timer);\n  var pending={evalId:evalId,c:c,v:v,id:id};\n  pending.timer=setTimeout(function(){\n    if(S.timers.get(id)===pending)S.timers.delete(id);\n    save(pending.evalId,pending.c,pending.v,pending.id);\n  },700);\n  S.timers.set(id,pending);\n};\nfunction save(evalId,c,v,id){\n  if(!String(v).trim())return Promise.resolve(false);\n  var key=evalId+\":\"+id,prev=S.saveChains.get(key)||Promise.resolve();\n  var job=prev.then(async function(){\n    var current=S.cur&&S.cur.id===evalId;\n    var l=current?document.getElementById(\"s_\"+id):null;\n    if(l)l.textContent=\"Salvando…\";\n    try{\n      await post(\"save_answer\",{avaliacao_id:evalId,codigo:c,resposta:v});\n      S.failedSaves.delete(key);\n      if(l)l.textContent=\"Salvo\";\n      var x=S.data&&S.data.cards.find(function(y){return y.id===evalId});\n      if(x&&x.status===\"nao_iniciada\"){\n        x.status=\"em_preenchimento\";\n        S.data.progress.nao_iniciadas--;\n        S.data.progress.em_preenchimento++;\n      }\n      return true;\n    }catch(z){\n      S.failedSaves.add(key);\n      if(l)l.textContent=\"Não salvo\";\n      toast(z.message);return false;\n    }\n  });\n  S.saveChains.set(key,job);\n  job.then(function(){if(S.saveChains.get(key)===job)S.saveChains.delete(key)});\n  return job;\n}\nasync function flushPending(evalId){\n  var pending=Array.from(S.timers.values());\n  S.timers.clear();\n  pending.forEach(function(x){clearTimeout(x.timer)});\n  var jobs=pending.map(function(x){return save(x.evalId,x.c,x.v,x.id)});\n  jobs=jobs.concat(Array.from(S.saveChains.values()));\n  var results=await Promise.all(jobs);\n  return results.every(Boolean)&&!Array.from(S.failedSaves).some(function(k){return k.startsWith(evalId+\":\")});\n}\nwindow.reviewE=async function(){\n  if(!S.cur)return;\n  var evalId=S.cur.id;\n  try{\n    if(!await flushPending(evalId)){toast(\"Há respostas não salvas. Verifique antes de revisar.\");return}\n    var f=await post(\"form\",{avaliacao_id:evalId});\n    if(!S.cur||S.cur.id!==evalId)return;\n    var m=new Map((f.answers||[]).map(function(a){return[a.pergunta_id,a.resposta_texto!=null?a.resposta_texto:(a.resposta_opcao||\"\")]})),\n        miss=f.questions.filter(function(q){return q.obrigatoria&&!String(m.get(q.id)||\"\").trim()});\n    if(miss.length){toast(\"Ainda há \"+miss.length+\" pergunta(s) sem resposta.\");return}\n    box.innerHTML='<h2>Revise antes de enviar</h2><div class=\"warn\"><strong>Última conferência.</strong> Depois do envio não será possível alterar.</div><div class=\"review\">'+f.questions.map(function(q){return'<b>'+e(q.titulo)+'</b><p>'+e(m.get(q.id)||\"\")+'</p>'}).join(\"\")+'</div><div class=\"actions\"><button class=\"btn ghost\" onclick=\"loadF(&quot;'+evalId+'&quot;,true)\">Voltar e editar</button><button class=\"btn danger\" onclick=\"submitE()\">Enviar definitivamente</button></div>';\n  }catch(x){toast(x.message)}\n};\nwindow.submitE=async function(){try{await post(\"submit\",{avaliacao_id:S.cur.id});closeM();toast(\"Avaliação enviada.\");await boot()}catch(x){toast(x.message)}};\nasync function boot(){if(!S.session){loginView();return}try{S.data=await post(\"bootstrap\");render()}catch(x){S.session=null;sessionStorage.removeItem(\"rod27_session\");loginView(x.message)}}\nboot();\n</script></body></html>";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") {
    return new Response(PAGE_HTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  let body: any;
  try { body = await req.json(); } catch { return fail("Requisição inválida.", 400); }

  const action = String(body?.action ?? "");
  if (action === "login") return login(req, body);
  if (action === "logout") return logout(req);

  const ctx = await resolveSession(req);
  if (!ctx) return fail("Sessão inválida ou expirada. Entre novamente.", 401);
  return handleAuthorized(ctx, body);
});