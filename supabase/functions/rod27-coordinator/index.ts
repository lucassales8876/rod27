
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
      db.from("perguntas_avaliacao").select("id,codigo,categoria,titulo,enunciado,tipo_resposta,opcoes,obrigatoria,ordem,status").eq("ciclo_id", ctx.coord.ciclo_id).eq("ativa", true).eq("status","publicada").order("ordem"),
      db.from("respostas_avaliacao").select("pergunta_id,resposta_texto,resposta_opcao,atualizado_em").eq("avaliacao_id", evaluation.id),
    ]);
    return json({
      ok: true, evaluation, config, questions: config?.status === "publicado" ? (questions ?? []) : [], answers: answers ?? [],
      editable: config?.status === "publicado" && evaluation.status !== "enviada" && !evaluation.eh_proprio_coordenador,
      special_reason: evaluation.eh_proprio_coordenador
        ? "A avaliação do próprio coordenador será tratada separadamente pela Secretaria."
        : null,
    });
  }

  if (action === "confirm_notice") {
    const {data:pubConfig}=await db.from("configuracoes_avaliacao").select("status").eq("ciclo_id",ctx.coord.ciclo_id).maybeSingle();
    if(pubConfig?.status!=="publicado")return fail("Formulário ainda não publicado pela Secretaria.",409);
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
    const {data:pubConfig}=await db.from("configuracoes_avaliacao").select("status").eq("ciclo_id",ctx.coord.ciclo_id).maybeSingle();
    if(pubConfig?.status!=="publicado")return fail("Formulário ainda não publicado pela Secretaria.",409);
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
      .eq("codigo", code).eq("ativa", true).eq("status","publicada").maybeSingle();
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
    const {data:pubConfig}=await db.from("configuracoes_avaliacao").select("status").eq("ciclo_id",ctx.coord.ciclo_id).maybeSingle();
    if(pubConfig?.status!=="publicado")return fail("Formulário ainda não publicado pela Secretaria.",409);
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

const PAGE_HTML = "<!doctype html>\n<html lang=\"pt-BR\"><head>\n<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"robots\" content=\"noindex,nofollow,noarchive\"><meta name=\"theme-color\" content=\"#17223b\">\n<title>Rod27 · Coordenador</title>\n<style>\n:root{--n:#17223b;--n2:#273a62;--p:#f5f2ec;--i:#182033;--m:#68707d;--l:#e4ded3;--g:#1f7a55;--a:#9a6418;--r:#a53d3d;--gold:#b7873f}\n*{box-sizing:border-box}body{margin:0;background:var(--p);color:var(--i);font:15px/1.5 system-ui,-apple-system,\"Segoe UI\",sans-serif}button,input,textarea{font:inherit}button{cursor:pointer}.shell{max-width:960px;margin:auto;min-height:100vh;padding-bottom:50px}\n.hero{background:linear-gradient(145deg,var(--n),var(--n2));color:#fff;padding:28px 20px;border-radius:0 0 28px 28px}.ey{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#dbc69d;font-weight:800}.hero h1{margin:5px 0}.hero p{margin:0;opacity:.85}.top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.badges{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}.badge{font-size:12px;padding:6px 9px;border-radius:99px;background:#ffffff17;border:1px solid #ffffff20}\nmain{padding:18px}.prog{background:#fff;border:1px solid var(--l);border-radius:17px;padding:13px;margin-bottom:12px}.bar{height:8px;background:#ece7de;border-radius:99px;margin-top:8px;overflow:hidden}.bar i{display:block;height:100%;background:var(--g)}.filters{display:flex;gap:7px;overflow:auto;margin-bottom:12px}.chip{white-space:nowrap;border:1px solid var(--l);background:#fff;border-radius:99px;padding:7px 10px}.chip.on{background:var(--n);color:#fff}\n.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}.card{background:#fff;border:1px solid var(--l);border-radius:18px;padding:12px;display:grid;grid-template-columns:58px 1fr auto;gap:11px;align-items:center}.card button{display:contents}.photo{width:58px;height:58px;border-radius:15px;object-fit:cover;background:#eee}.name{font-weight:800;line-height:1.25}.church{font-size:13px;color:var(--m);margin-top:2px}.state{font-size:10px;font-weight:900;text-transform:uppercase;border-radius:99px;padding:5px 7px}.new{background:#eef1f5}.draft{background:#fff1cf;color:var(--a)}.sent{background:#dff3e9;color:var(--g)}.special{background:#f2e8f7;color:#72438b}\n.login{max-width:430px;margin:72px auto;background:#fff;border:1px solid var(--l);border-radius:24px;padding:25px}.login h2{margin:5px 0}.field{margin:12px 0}.field label{display:block;font-size:12px;font-weight:800;margin-bottom:5px}.field input{width:100%;border:1px solid #d6d0c6;border-radius:11px;padding:12px}.muted{color:var(--m)}.error{color:var(--r);font-size:13px;min-height:20px}.btn{border:0;border-radius:12px;padding:10px 14px;font-weight:800}.primary{background:var(--n);color:#fff}.ghost{background:#eee9e1}.danger{background:var(--r);color:#fff}.small{font-size:12px;padding:7px 9px}\n.back{position:fixed;inset:0;background:#0c12218a;display:none;align-items:flex-end;justify-content:center;z-index:30}.back.show{display:flex}.modal{width:min(720px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:25px 25px 0 0;padding:19px}.warn{background:#fff8e9;border-left:4px solid var(--gold);padding:11px;border-radius:10px;margin:13px 0}.actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:15px}.head{display:flex;gap:11px;align-items:center;padding-bottom:13px;border-bottom:1px solid var(--l)}.head img{width:56px;height:56px;border-radius:14px;object-fit:cover;background:#eee}.q{padding:14px 0;border-bottom:1px solid var(--l)}.qn{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);font-weight:900}.q h3{margin:3px 0 5px;font-size:17px}.q p{margin:0 0 9px;color:#5f6673}textarea{width:100%;min-height:120px;border:1px solid #d8d2c8;border-radius:12px;padding:10px;resize:vertical}.op{display:flex;gap:8px;padding:9px;border:1px solid var(--l);border-radius:10px;margin:6px 0}.save{font-size:11px;color:var(--m);min-height:16px;margin-top:4px}.review{background:#f7f5f0;border:1px solid var(--l);border-radius:13px;padding:11px}.review p{white-space:pre-wrap;margin:4px 0 11px}.toast{position:fixed;left:50%;bottom:16px;transform:translateX(-50%) translateY(20px);background:var(--n);color:#fff;padding:9px 12px;border-radius:10px;opacity:0;transition:.2s;z-index:50}.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}\n@media(min-width:720px){.hero{margin-top:18px;border-radius:26px}.back{align-items:center}.modal{border-radius:24px}}\n</style></head><body>\n<div id=\"app\" class=\"shell\"></div><div id=\"back\" class=\"back\"><div id=\"modal\" class=\"modal\"></div></div><div id=\"toast\" class=\"toast\"></div>\n<script>\nvar S={session:sessionStorage.getItem(\"rod27_session\")||null,data:null,filter:\"all\",cur:null,form:null,timers:new Map()},app=document.getElementById(\"app\"),back=document.getElementById(\"back\"),box=document.getElementById(\"modal\");\nfunction e(v){return String(v==null?\"\":v).replace(/[&<>\"']/g,function(x){return{\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",\"\\\"\":\"&quot;\",\"'\":\"&#39;\"}[x]})}\nfunction toast(m){var x=document.getElementById(\"toast\");x.textContent=m;x.classList.add(\"show\");setTimeout(function(){x.classList.remove(\"show\")},2200)}\nasync function post(action,p,auth){var h={\"Content-Type\":\"application/json\"};if(auth!==false&&S.session)h[\"X-Rod27-Session\"]=S.session;var r=await fetch(location.pathname,{method:\"POST\",headers:h,body:JSON.stringify(Object.assign({action:action},p||{}))});var j=await r.json().catch(function(){return{ok:false,error:\"Resposta inválida.\"}});if(!r.ok||!j.ok)throw new Error(j.error||\"Falha na comunicação.\");return j}\nfunction loginView(msg){app.innerHTML='<div class=\"login\"><div class=\"ey\">ROD27 · COORDENADOR</div><h2>Entrar no seu setor</h2><p class=\"muted\">Use seu ROL de coordenador e a senha fornecida pela Secretaria.</p><div class=\"field\"><label>ROL</label><input id=\"rol\" inputmode=\"numeric\" autocomplete=\"username\" placeholder=\"Seu ROL\"></div><div class=\"field\"><label>Senha de acesso</label><input id=\"pin\" type=\"password\" inputmode=\"numeric\" autocomplete=\"current-password\" placeholder=\"••••••\"></div><div id=\"err\" class=\"error\">'+e(msg||\"\")+'</div><button class=\"btn primary\" style=\"width:100%\" onclick=\"login()\">Entrar</button></div>'}\nwindow.login=async function(){var rol=document.getElementById(\"rol\").value.trim(),senha=document.getElementById(\"pin\").value.trim(),err=document.getElementById(\"err\");err.textContent=\"Entrando…\";try{var d=await post(\"login\",{rol:rol,senha:senha},false);S.session=d.session_token;sessionStorage.setItem(\"rod27_session\",S.session);await boot()}catch(x){err.textContent=x.message}}\nwindow.logout=async function(){try{if(S.session)await post(\"logout\")}catch(x){}S.session=null;sessionStorage.removeItem(\"rod27_session\");loginView()}\nfunction tag(c){if(c.eh_proprio_coordenador)return[\"Coordenação\",\"special\"];if(c.status===\"enviada\")return[\"Enviada\",\"sent\"];if(c.status===\"em_preenchimento\")return[\"Em andamento\",\"draft\"];return[\"Avaliar\",\"new\"]}\nfunction filt(k,l){return'<button class=\"chip '+(S.filter===k?\"on\":\"\")+'\" onclick=\"setF(&quot;'+k+'&quot;)\">'+l+'</button>'}\nfunction card(c){var t=tag(c);return'<div class=\"card\"><button onclick=\"openC(&quot;'+c.id+'&quot;)\"><img class=\"photo\" src=\"'+e(c.dirigente_foto_url_snapshot||\"\")+'\" alt=\"\" onerror=\"this.style.visibility=&quot;hidden&quot;\"><div><div class=\"name\">'+e(c.dirigente_nome_snapshot)+'</div><div class=\"church\">'+e(c.congregacao_nome_snapshot)+'</div></div><span class=\"state '+t[1]+'\">'+t[0]+'</span></button></div>'}\nfunction render(){var d=S.data,u=d.progress.total-d.progress.tratamento_especial,p=u?Math.round(d.progress.enviadas/u*100):0,rows=d.cards.filter(function(c){return S.filter===\"all\"||c.status===S.filter||(S.filter===\"special\"&&c.eh_proprio_coordenador)});app.innerHTML='<section class=\"hero\"><div class=\"top\"><div><div class=\"ey\">Rodízio 2027 · Área '+e(d.coordinator.area)+'</div><h1>Setor '+d.coordinator.setor+'</h1><p>'+e(d.coordinator.nome)+' · ROL '+e(d.coordinator.rol)+'</p></div><button class=\"btn ghost small\" onclick=\"logout()\">Sair</button></div><div class=\"badges\"><span class=\"badge\">'+d.progress.total+' dirigentes</span><span class=\"badge\">'+d.progress.enviadas+' enviados</span><span class=\"badge\">'+d.progress.em_preenchimento+' em andamento</span></div></section><main><div class=\"prog\"><strong>Progresso</strong><span style=\"float:right\">'+d.progress.enviadas+'/'+u+'</span><div class=\"bar\"><i style=\"width:'+p+'%\"></i></div></div><div class=\"filters\">'+filt(\"all\",\"Todos\")+filt(\"nao_iniciada\",\"Não iniciadas\")+filt(\"em_preenchimento\",\"Em andamento\")+filt(\"enviada\",\"Enviadas\")+filt(\"special\",\"Coordenação\")+'</div><div class=\"grid\">'+(rows.map(card).join(\"\")||'<span class=\"muted\">Nenhum dirigente neste filtro.</span>')+'</div></main>'}\nwindow.setF=function(k){S.filter=k;render()};\nfunction closeM(){back.classList.remove(\"show\");box.innerHTML=\"\"}window.closeM=closeM;back.addEventListener(\"click\",function(x){if(x.target===back)closeM()});\nwindow.openC=async function(id){var c=S.data.cards.find(function(x){return x.id===id});if(c.eh_proprio_coordenador){box.innerHTML='<h2>'+e(c.dirigente_nome_snapshot)+'</h2><p>'+e(c.congregacao_nome_snapshot)+'</p><div class=\"warn\"><strong>Ficha da coordenação</strong><br>A avaliação do próprio coordenador será tratada separadamente pela Secretaria.</div><div class=\"actions\"><button class=\"btn primary\" onclick=\"closeM()\">Entendi</button></div>';back.classList.add(\"show\");return}if(c.status===\"nao_iniciada\"){try{var f=await post(\"form\",{avaliacao_id:id});S.form=f;S.cur=c;box.innerHTML='<h2>'+e(f.config.titulo_aviso)+'</h2><div class=\"warn\">'+e(f.config.texto_aviso)+'</div><p class=\"muted\">Você pode salvar e continuar depois. O bloqueio definitivo ocorre apenas no envio.</p><div class=\"actions\"><button class=\"btn ghost\" onclick=\"closeM()\">Cancelar</button><button class=\"btn primary\" onclick=\"startE()\">Entendi, iniciar</button></div>';back.classList.add(\"show\")}catch(x){toast(x.message)}}else loadF(id)};\nwindow.startE=async function(){try{await post(\"confirm_notice\",{avaliacao_id:S.cur.id});await loadF(S.cur.id,true)}catch(x){toast(x.message)}};\nasync function loadF(id,keep){try{var f=await post(\"form\",{avaliacao_id:id});S.form=f;S.cur=S.data.cards.find(function(x){return x.id===id});var ans=new Map((f.answers||[]).map(function(a){return[a.pergunta_id,a.resposta_texto!=null?a.resposta_texto:(a.resposta_opcao||\"\")]})),h='<div class=\"head\"><img src=\"'+e(f.evaluation.dirigente_foto_url_snapshot||\"\")+'\" alt=\"\"><div><div class=\"ey\">Avaliação do dirigente</div><h2 style=\"margin:2px 0\">'+e(f.evaluation.dirigente_nome_snapshot)+'</h2><div class=\"church\">'+e(f.evaluation.congregacao_nome_snapshot)+'</div></div></div>';if(f.evaluation.status===\"enviada\")h+='<div class=\"warn\"><strong>Avaliação enviada.</strong> Somente leitura.</div>';h+=(f.questions||[]).map(function(q,i){return qHtml(q,i,ans.get(q.id)||\"\",f.evaluation.status===\"enviada\")}).join(\"\");h+='<div class=\"actions\"><button class=\"btn ghost\" onclick=\"closeM()\">Fechar</button>'+(f.evaluation.status!==\"enviada\"?'<button class=\"btn primary\" onclick=\"reviewE()\">Revisar e enviar</button>':\"\")+'</div>';box.innerHTML=h;back.classList.add(\"show\")}catch(x){toast(x.message);if(!keep)closeM()}}window.loadF=loadF;\nfunction qHtml(q,i,v,ro){var x=\"\";if(q.tipo_resposta===\"escolha_unica\")x=(q.opcoes||[]).map(function(o){return'<label class=\"op\"><input type=\"radio\" name=\"q_'+q.id+'\" value=\"'+e(o)+'\" '+(v===o?\"checked\":\"\")+' '+(ro?\"disabled\":\"\")+' onchange=\"queue(&quot;'+q.codigo+'&quot;,this.value,&quot;'+q.id+'&quot;)\"><span>'+e(o)+'</span></label>'}).join(\"\");else x='<textarea '+(ro?\"disabled\":\"\")+' data-qid=\"'+q.id+'\" oninput=\"queue(&quot;'+q.codigo+'&quot;,this.value,&quot;'+q.id+'&quot;)\">'+e(v)+'</textarea>';return'<section class=\"q\"><div class=\"qn\">Pergunta '+(i+1)+' · '+e(q.categoria)+'</div><h3>'+e(q.titulo)+'</h3><p>'+e(q.enunciado)+'</p>'+x+'<div id=\"s_'+q.id+'\" class=\"save\"></div></section>'}\nwindow.queue=function(c,v,id){var l=document.getElementById(\"s_\"+id);if(l)l.textContent=\"Alteração pendente…\";clearTimeout(S.timers.get(id));S.timers.set(id,setTimeout(function(){save(c,v,id)},700))};\nasync function save(c,v,id){if(!String(v).trim())return;var l=document.getElementById(\"s_\"+id);if(l)l.textContent=\"Salvando…\";try{await post(\"save_answer\",{avaliacao_id:S.cur.id,codigo:c,resposta:v});if(l)l.textContent=\"Salvo\";var x=S.data.cards.find(function(y){return y.id===S.cur.id});if(x&&x.status===\"nao_iniciada\"){x.status=\"em_preenchimento\";S.data.progress.nao_iniciadas--;S.data.progress.em_preenchimento++}}catch(z){if(l)l.textContent=\"Não salvo\";toast(z.message)}}\nwindow.reviewE=async function(){S.timers.forEach(clearTimeout);S.timers.clear();var ta=Array.from(box.querySelectorAll(\"textarea[data-qid]\"));for(var i=0;i<ta.length;i++){var el=ta[i],q=S.form.questions.find(function(x){return x.id===el.dataset.qid});if(el.value.trim())await save(q.codigo,el.value,q.id)}var f=await post(\"form\",{avaliacao_id:S.cur.id}),m=new Map((f.answers||[]).map(function(a){return[a.pergunta_id,a.resposta_texto!=null?a.resposta_texto:(a.resposta_opcao||\"\")]})),miss=f.questions.filter(function(q){return q.obrigatoria&&!String(m.get(q.id)||\"\").trim()});if(miss.length){toast(\"Ainda há \"+miss.length+\" pergunta(s) sem resposta.\");return}box.innerHTML='<h2>Revise antes de enviar</h2><div class=\"warn\"><strong>Última conferência.</strong> Depois do envio não será possível alterar.</div><div class=\"review\">'+f.questions.map(function(q){return'<b>'+e(q.titulo)+'</b><p>'+e(m.get(q.id)||\"\")+'</p>'}).join(\"\")+'</div><div class=\"actions\"><button class=\"btn ghost\" onclick=\"loadF(&quot;'+S.cur.id+'&quot;,true)\">Voltar e editar</button><button class=\"btn danger\" onclick=\"submitE()\">Enviar definitivamente</button></div>'};\nwindow.submitE=async function(){try{await post(\"submit\",{avaliacao_id:S.cur.id});closeM();toast(\"Avaliação enviada.\");await boot()}catch(x){toast(x.message)}};\nasync function boot(){if(!S.session){loginView();return}try{S.data=await post(\"bootstrap\");render()}catch(x){S.session=null;sessionStorage.removeItem(\"rod27_session\");loginView(x.message)}}\nboot();\n</script></body></html>";

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
