// Fixture da função de coordenador v4. Somente o HTML GET foi removido.

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
    .select("id,ciclo_id,setor_id,obreiro_rol,coordenador_nome_snapshot")
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
    if (until > Date.now()) return fail("Acesso temporariamente bloqueado por tentativas incorretas. Tente novamente mais tarde.", 429);
    await db.from("coordenador_credenciais").update({
      status: "ativa", falhas_consecutivas: 0, bloqueado_ate: null,
    }).eq("id", cred.id);
    cred.status = "ativa";
    cred.falhas_consecutivas = 0;
  }

  const ok = cred.senha_hash ? await verifyPin(pin, cred.senha_hash, cred.id) : false;
  if (!ok) {
    const max = await settingNumber("coordenador.login.max_falhas", 5);
    const mins = await settingNumber("coordenador.login.bloqueio_minutos", 15);
    const failures = Number(cred.falhas_consecutivas ?? 0) + 1;
    const blocked = failures >= max;
    await db.from("coordenador_credenciais").update({
      falhas_consecutivas: failures,
      status: blocked ? "bloqueada" : "ativa",
      bloqueado_ate: blocked ? new Date(Date.now() + mins * 60000).toISOString() : null,
    }).eq("id", cred.id);
    return fail(blocked
      ? "Acesso temporariamente bloqueado por tentativas incorretas."
      : "ROL ou senha inválidos.", blocked ? 429 : 401);
  }

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

  await db.from("coordenador_credenciais").update({
    status: "ativa",
    falhas_consecutivas: 0,
    bloqueado_ate: null,
    ultimo_login_em: new Date().toISOString(),
  }).eq("id", cred.id);

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
    .select("id,ciclo_id,coordenacao_id,congregacao_id,dirigente_rol,dirigente_nome_snapshot,dirigente_foto_url_snapshot,congregacao_nome_snapshot,eh_proprio_coordenador,status,aviso_confirmado_em,iniciada_em,enviada_em")
    .eq("id", id).eq("ciclo_id", ctx.coord.ciclo_id).eq("coordenacao_id", ctx.coord.id).maybeSingle();
  return error ? null : data;
}
async function handleAuthorized(ctx: any, body: any) {
  const action = String(body?.action ?? "");

  if (action === "bootstrap") {
    const { data: cards, error } = await db.from("avaliacoes_dirigente")
      .select("id,congregacao_nome_snapshot,dirigente_rol,dirigente_nome_snapshot,dirigente_foto_url_snapshot,eh_proprio_coordenador,status,iniciada_em,enviada_em")
      .eq("ciclo_id", ctx.coord.ciclo_id).eq("coordenacao_id", ctx.coord.id)
      .order("congregacao_nome_snapshot");
    if (error) return fail("Não foi possível carregar as avaliações.", 500);
    const rows = cards ?? [];
    return json({
      ok: true,
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
        tratamento_especial: rows.filter((x) => x.eh_proprio_coordenador).length,
      },
      cards: rows,
    });
  }

  if (action === "form") {
    const evaluation = await getOwnedEvaluation(ctx, String(body?.avaliacao_id ?? ""));
    if (!evaluation) return fail("Avaliação não encontrada neste setor.", 404);
    const [{ data: config }, { data: questions }, { data: answers }] = await Promise.all([
      db.from("configuracoes_avaliacao").select("versao,status,titulo_aviso,texto_aviso,permite_edicao_apos_envio").eq("ciclo_id", ctx.coord.ciclo_id).maybeSingle(),
      db.from("perguntas_avaliacao").select("id,codigo,categoria,titulo,enunciado,tipo_resposta,opcoes,obrigatoria,ordem,status").eq("ciclo_id", ctx.coord.ciclo_id).eq("ativa", true).order("ordem"),
      db.from("respostas_avaliacao").select("pergunta_id,resposta_texto,resposta_opcao,atualizado_em").eq("avaliacao_id", evaluation.id),
    ]);
    return json({
      ok: true, evaluation, config, questions: questions ?? [], answers: answers ?? [],
      editable: evaluation.status !== "enviada" && !evaluation.eh_proprio_coordenador,
      special_reason: evaluation.eh_proprio_coordenador
        ? "A avaliação do próprio coordenador será tratada separadamente pela Secretaria."
        : null,
    });
  }

  if (action === "confirm_notice") {
    const evaluation = await getOwnedEvaluation(ctx, String(body?.avaliacao_id ?? ""));
    if (!evaluation) return fail("Avaliação não encontrada.", 404);
    if (evaluation.eh_proprio_coordenador) return fail("Esta ficha terá tratamento específico pela Secretaria.", 409);
    if (evaluation.status === "enviada") return fail("Esta avaliação já foi enviada.", 409);
    const { error } = await db.from("avaliacoes_dirigente")
      .update({ aviso_confirmado_em: new Date().toISOString() })
      .eq("id", evaluation.id).eq("coordenacao_id", ctx.coord.id);
    return error ? fail("Não foi possível iniciar a avaliação.", 500) : json({ ok: true });
  }

  if (action === "save_answer") {
    const evaluation = await getOwnedEvaluation(ctx, String(body?.avaliacao_id ?? ""));
    if (!evaluation) return fail("Avaliação não encontrada.", 404);
    if (evaluation.eh_proprio_coordenador) return fail("Esta ficha terá tratamento específico pela Secretaria.", 409);
    if (evaluation.status === "enviada") return fail("Esta avaliação já foi enviada e está bloqueada.", 409);
    if (!evaluation.aviso_confirmado_em) return fail("Confirme o aviso antes de preencher.", 409);

    const code = String(body?.codigo ?? "").trim();
    const value = String(body?.resposta ?? "").trim();
    if (!value) return fail("A resposta não pode ficar vazia.", 400);
    if (value.length > 12000) return fail("Resposta muito longa.", 400);

    const { data: q } = await db.from("perguntas_avaliacao")
      .select("id,codigo,tipo_resposta,opcoes").eq("ciclo_id", ctx.coord.ciclo_id)
      .eq("codigo", code).eq("ativa", true).maybeSingle();
    if (!q) return fail("Pergunta inválida.", 400);

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
    const evaluation = await getOwnedEvaluation(ctx, String(body?.avaliacao_id ?? ""));
    if (!evaluation) return fail("Avaliação não encontrada.", 404);
    if (evaluation.eh_proprio_coordenador) return fail("Esta ficha terá tratamento específico pela Secretaria.", 409);
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

const PAGE_HTML="Rod27 — fixture local de autenticação";

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
