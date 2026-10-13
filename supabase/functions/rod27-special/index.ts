import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-rod27-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const sha256 = async (bytes: Uint8Array) => Array.from(new Uint8Array(
  await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
)).map(v => v.toString(16).padStart(2, "0")).join("");

async function identity(req: Request) {
  const token = req.headers.get("x-rod27-session");
  if (token) {
    const hash = await sha256(new TextEncoder().encode(token));
    const { data, error } = await db.from("coordenador_sessoes").select("id")
      .eq("sessao_hash", hash).is("revogada_em", null).gt("expira_em", new Date().toISOString()).maybeSingle();
    if (error || !data) return null;
    return { p_user: null, p_session: data.id };
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const { data, error } = await db.auth.getUser(auth.slice(7));
  return error || !data.user ? null : { p_user: data.user.id, p_session: null };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
  const actor = await identity(req);
  if (!actor) return json({ ok: false, error: "Acesso não autorizado." }, 401);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Requisição inválida." }, 400); }
  const call = async (action: string, payload = body) => {
    const { data, error } = await db.rpc("rod27_special_command", {
      p_action: action, p_id: body.avaliacao_id ?? null, ...actor, p_payload: payload,
    });
    if (error) throw new Error(error.message);
    return data;
  };
  try {
    if (body.action === "upload") {
      const view = await call("detail");
      if (!view.can_manage || !view.designacao?.ativa || view.avaliacao.status === "enviada") {
        return json({ ok: false, error: "Anexo exige designação e Secretaria autorizada." }, 403);
      }
      const encoded = String(body.base64 ?? "");
      if (!encoded || encoded.length > 11185000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("Arquivo inválido ou maior que 8 MB.");
      const raw = atob(encoded), bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
      const mime = String(body.tipo_mime ?? "");
      const signatures: Record<string, number[]> = {
        "application/pdf": [37,80,68,70,45], "image/jpeg": [255,216,255],
        "image/png": [137,80,78,71,13,10,26,10],
      };
      if (!bytes.length || bytes.length > 8388608 || !signatures[mime]?.every((v,i) => bytes[i] === v)) throw new Error("Conteúdo do arquivo incompatível com PDF, JPG ou PNG.");
      const ext = mime === "application/pdf" ? "pdf" : mime === "image/jpeg" ? "jpg" : "png";
      const path = `aval/${body.avaliacao_id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from("rod27-documentos").upload(path, bytes, { contentType: mime, upsert: false });
      if (error) throw new Error(error.message);
      try {
        return json(await call("register_document", {
          path, mime, size: bytes.length, sha256: await sha256(bytes),
          nome: String(body.nome ?? "Original assinado").replace(/[\r\n\t]/g, " ").slice(0,160),
        }));
      } catch (e) {
        await db.storage.from("rod27-documentos").remove([path]);
        throw e;
      }
    }
    if (body.action === "document_url") {
      const result = await call("document_access");
      const { data, error } = await db.storage.from("rod27-documentos").createSignedUrl(result.path, 300);
      if (error || !data) throw new Error("Original temporariamente indisponível.");
      const origin = new URL(Deno.env.get("ROD27_PUBLIC_API_URL") ?? Deno.env.get("SUPABASE_URL")!);
      const url = new URL(data.signedUrl);
      url.protocol = origin.protocol; url.host = origin.host;
      return json({ ok: true, url: url.toString(), expira_segundos: 300 });
    }
    if (!["list","detail","blank","assign","save","history","lookup"].includes(body.action)) return json({ ok: false, error: "Ação desconhecida." }, 400);
    return json(await call(body.action));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha na ficha especial.";
    const status = /não autorizad[oa]|restrit|proibida|Somente|exige designação/.test(message) ? 403 : 409;
    return json({ ok: false, error: message }, status);
  }
});
