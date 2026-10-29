import {recoveryMailReady,requestRecoveryConfirmation} from "../_shared/recovery-mail.ts";
import {adminSessionActive,passwordChangeRequired,completeRequiredPasswordChange} from "../_shared/admin-password.ts";
import {secretariaAllowed} from "../_shared/secretaria-access.ts";
import {encryptText,decryptText,encryptFile,decryptFile,encodeBase64} from "../_shared/rod27-content-crypto.ts";

import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??(()=>{try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}").default??""}catch{return""}})();
if(!SUPABASE_URL||!KEY)throw new Error("Rod27 admin credentials unavailable.");
const db=createClient(SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type, authorization","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
function fail(message:string,status=400){return json({ok:false,error:message},status)}
function b64url(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function hashPin(pin:string){const salt=crypto.getRandomValues(new Uint8Array(16)),iter=210000,key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]),bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:iter},key,256);return "pbkdf2-sha256$"+iter+"$"+b64url(salt)+"$"+b64url(new Uint8Array(bits))}
function genPin(){const limit=Math.floor(4294967296/1000000)*1000000;let x=0;do{x=crypto.getRandomValues(new Uint32Array(1))[0]}while(x>=limit);return String(x%1000000).padStart(6,"0")}
async function resolveAdmin(req:Request){const h=req.headers.get("authorization")??"";if(!h.startsWith("Bearer "))return null;const{data,error}=await db.auth.getUser(h.slice(7).trim());if(error||!data.user)return null;if(!await adminSessionActive(db,data.user,req))return null;const{data:a}=await db.from("usuarios_admin").select("user_id,papel,nome_exibicao,ativo").eq("user_id",data.user.id).eq("ativo",true).maybeSingle();return a?{user:data.user,admin:a}:null}
function canOperate(ctx:any){return ctx.secretariaAllowed===true}
async function audit(ctx:any,acao:string,entidade:string,id:string,detalhes:any={}){await db.from("auditoria_sistema").insert({user_id:ctx.user.id,papel:ctx.admin.papel,acao,entidade,entidade_id:id,detalhes})}
async function cycle(){const{data,error}=await db.from("ciclos_rodizio").select("id,ano,ano_base,nome,status").eq("ano",2027).single();if(error)throw error;return data}
async function sectorContext(n:number){const c=await cycle();const{data:s}=await db.from("setores").select("id,numero,area").eq("numero",n).single();const{data:coord}=await db.from("coordenacoes_setor").select("id,obreiro_rol,coordenador_nome_snapshot").eq("ciclo_id",c.id).eq("setor_id",s.id).single();const{data:cred}=await db.from("coordenador_credenciais").select("id,rol_login,status,ultimo_login_em,bloqueado_ate").eq("coordenacao_id",coord.id).single();return{c,s,coord,cred}}
async function unveilManifest(row:any){
 if(!row)return row;
 const text=await decryptText(row.justificativa,"manifest:"+row.coordenacao_id);
 if(typeof row.justificativa==="string"&&row.justificativa.startsWith("r27e1:")){
  const data=JSON.parse(text||"{}");
  return {...row,deseja_permanecer:data.deseja_permanecer??null,
   opcao_movimentacao:data.opcao_movimentacao??null,justificativa:data.justificativa??null};
 }
 return row;
}
async function unveilAnswer(row:any,evalId:string){
 return {...row,
  resposta_texto:await decryptText(row.resposta_texto,"answer:"+evalId+":"+row.pergunta_id),
  resposta_opcao:await decryptText(row.resposta_opcao,"answer:"+evalId+":"+row.pergunta_id)};
}
async function protectedDocument(id:string,path:string,mime:string){
 const {data,error}=await db.storage.from("rod27-documentos").download(path);
 if(error||!data)throw error??new Error("Arquivo privado indisponível.");
 const plain=await decryptFile(new Uint8Array(await data.arrayBuffer()),"document:"+path);
 return{ok:true,base64:encodeBase64(plain),mime,expira_segundos:0};
}
async function planningSnapshot(ctx:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const c=await cycle();
 const [{data:state,error:stateErr},{data:slots,error:slotErr},{data:history,error:historyErr}]=await Promise.all([
  db.from("rod27_planejamento").select("ciclo_id,ano,status,revisao,atualizado_em").eq("ciclo_id",c.id).single(),
  db.from("rod27_planejamento_posicoes").select("id,tipo,destino_id,obreiro_rol,nome_snapshot,foto_url_snapshot").eq("ciclo_id",c.id),
  db.from("rod27_planejamento_eventos").select("id,revisao,tipo,acao,autor,antes,depois,observacao,criado_em")
   .eq("ciclo_id",c.id).order("revisao",{ascending:false}).limit(30)
 ]);
 if(stateErr||slotErr||historyErr)throw stateErr??slotErr??historyErr;
 const actors=[...new Set((history??[]).map((x:any)=>x.autor))];
 let names=new Map<string,string>();
 if(actors.length){
  const {data:users,error:userErr}=await db.from("usuarios_admin").select("user_id,nome_exibicao").in("user_id",actors);
  if(!userErr)names=new Map((users??[]).map((u:any)=>[u.user_id,u.nome_exibicao]));
 }
 return{ok:true,ano:2027,planejamento:state,slots:slots??[],
  historico:(history??[]).map((row:any)=>({...row,autor_nome:names.get(row.autor)??"Secretaria"})),
  somente_proposta:true};
}
async function planningMove(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const p={
  p_destino:String(b.destino_id??""),p_rol:String(b.rol??"").trim(),
  p_tipo:String(b.tipo??""),p_revisao:Number(b.revisao),p_autor:ctx.user.id
 };
 if(!/^[a-f0-9-]{36}$/i.test(p.p_destino)||!/^[0-9]{1,12}$/.test(p.p_rol)||
  !["coordenador","dirigente"].includes(p.p_tipo)||!Number.isInteger(p.p_revisao))
  throw new Error("Movimentação inválida.");
 const{data,error}=await db.rpc("rod27_planejamento_mover",p);
 if(error)throw error;
 await audit(ctx,"planejamento_2027_movimentar","rod27_planejamento",String(data?.revisao),{
  tipo:p.p_tipo,destino_id:p.p_destino,rol:p.p_rol,troca:data?.troca===true});
 return data;
}
async function planningUndo(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const rev=Number(b.revisao);
 if(!Number.isInteger(rev)||rev<1)throw new Error("Revisão inválida.");
 const{data,error}=await db.rpc("rod27_planejamento_desfazer",{p_revisao:rev,p_autor:ctx.user.id});
 if(error)throw error;
 await audit(ctx,"planejamento_2027_desfazer","rod27_planejamento",String(data?.revisao),{desfeita:data?.revisao_desfeita});
 return data;
}
async function planningFind(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const term=String(b.busca??"").trim();
 if(term.length<2||term.length>70)throw new Error("Informe pelo menos dois caracteres.");
 const{data,error}=await db.rpc("rod27_planejamento_buscar_obreiros",{p_busca:term});
 if(error)throw error;
 return{ok:true,pessoas:data??[]};
}
async function map2026(ctx:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const [{data:sectors,error:se},{data:churches,error:ce},{data:assignments,error:de},
 {data:cycle,error:ye}]=await Promise.all([
  db.from("setores").select("id,numero,area,ativo").eq("ativo",true).order("numero"),
  db.from("congregacoes").select("id,codigo_origem,nome,area,setor,ativo").eq("ativo",true).order("nome"),
  db.from("designacoes").select("id,congregacao_id,obreiro_rol,dirigente_nome_snapshot,dirigente_foto_url_snapshot,vigencia_ano,atual,atualizado_em")
    .eq("vigencia_ano",2026).eq("atual",true),
  db.from("ciclos_rodizio").select("id,ano_base").eq("ano",2027).eq("ano_base",2026).maybeSingle()
 ]);
 if(se||ce||de||ye)throw se??ce??de??ye;
 if(!cycle)throw new Error("Base 2026 de coordenações indisponível.");
 const {data:coords,error:coerr}=await db.from("coordenacoes_setor")
   .select("id,setor_id,obreiro_rol,coordenador_nome_snapshot,ano_base_designacao")
   .eq("ciclo_id",cycle.id).eq("ano_base_designacao",2026);
 if(coerr)throw coerr;
 const {data:evaluations,error:evError}=await db.from("avaliacoes_dirigente")
  .select("id,congregacao_id,dirigente_rol,status,enviada_em,origem_preenchimento")
  .eq("ciclo_id",cycle.id).eq("eh_proprio_coordenador",false);
 if(evError)throw evError;
 const evalIndex=new Map<string,any[]>();
 for(const ev of evaluations??[]){
  const index=ev.congregacao_id+"::"+ev.dirigente_rol;
  const matches=evalIndex.get(index)??[];
  matches.push(ev);evalIndex.set(index,matches);
 }
 const perSector=new Map((sectors??[]).map((x:any)=>[x.id,x]));
 const byArea=new Map<string,any>();
 const byNumber=new Map<number,any>();
 for(const sec of sectors??[]){
  const area=String(sec.area??"Sem área");
  if(!byArea.has(area))byArea.set(area,{codigo:area,setores:[]});
  const item={numero:sec.numero,id:sec.id,area,coordenador:null as any,congregacoes:[] as any[]};
  byArea.get(area).setores.push(item);byNumber.set(sec.numero,item);
 }
 for(const coord of coords??[]){
  const sec=perSector.get(coord.setor_id);
  const item=sec?byNumber.get(sec.numero):null;
  if(item)item.coordenador={id:coord.id,nome:coord.coordenador_nome_snapshot,rol:coord.obreiro_rol,
    foto_url:(assignments??[]).find((x:any)=>x.obreiro_rol===coord.obreiro_rol)?.dirigente_foto_url_snapshot??null,
    fonte:"Coordenações do Rod27, ano-base 2026"};
 }
 const byChurch=new Map<string,any[]>();
 for(const entry of assignments??[]){
  const list=byChurch.get(entry.congregacao_id)??[];
  list.push(entry);
  byChurch.set(entry.congregacao_id,list);
 }
 let absent=0,conflicts=0;
 for(const church of churches??[]){
  const parent=byNumber.get(church.setor);
  if(!parent)continue;
  const list=byChurch.get(church.id)??[];
  if(list.length===0)absent++;
  if(list.length>1)conflicts++;
  const first=list.length===1?list[0]:null;
  const linked=first?(evalIndex.get(church.id+"::"+first.obreiro_rol)??[]):[];
  const matched=linked.length===1?linked[0]:null;
  parent.congregacoes.push({
   id:church.id,codigo:church.codigo_origem,nome:church.nome,area:parent.area,setor:church.setor,
   dirigente:first?{nome:first.dirigente_nome_snapshot,rol:first.obreiro_rol,
     foto_url:first.dirigente_foto_url_snapshot,atualizado_em:first.atualizado_em}:null,
   estado:list.length===1?"identificado":list.length>1?"conflito":"sem_designacao",
   quantidade_designacoes:list.length,
   avaliacao:matched?{id:matched.id,status:matched.status,enviada_em:matched.enviada_em,
    origem:matched.origem_preenchimento,ciclo:2027}:null,
   avaliacao_ambigua:linked.length>1
  });
 }
 const romanValue=(input:string)=>{
  const digits:Record<string,number>={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
  if(/^\d+$/.test(input))return Number(input);
  const u=input.toUpperCase().trim();if(!/^[IVXLCDM]+$/.test(u))return 99999;
  let total=0;for(let i=0;i<u.length;i++){const n=digits[u[i]];total+=n<(digits[u[i+1]]??0)?-n:n}
  return total;
 };
 const collator=new Intl.Collator("pt-BR",{sensitivity:"base",numeric:true});
 const areas=[...byArea.values()].sort((a,b)=>romanValue(a.codigo)-romanValue(b.codigo)||collator.compare(a.codigo,b.codigo));
 for(const area of areas)for(const sector of area.setores){
  sector.congregacoes.sort((a:any,b:any)=>collator.compare(a.nome,b.nome));
 }
 return {
  ok:true,ano:2026,consulta_em:new Date().toISOString(),somente_leitura:true,
  fonte:"Dirigentes: designações vigentes de 2026 no Rod27. Coordenadores: ano-base 2026 registrado nas coordenações do Rodízio 2027. Sem consulta em tempo real ao Propósito.",
  totais:{areas:areas.length,setores:sectors?.length??0,congregacoes:churches?.length??0,
    designacoes:assignments?.length??0,coordenadores:coords?.length??0,
    sem_designacao:absent,conflitos:conflicts},
  areas
 };
}
async function coordinatorContext(setor:number,rol:string){
 if(!Number.isInteger(setor)||setor<1||setor>42||!/^[0-9]{1,12}$/.test(rol))throw new Error("Identificação de coordenação inválida.");
 const c=await cycle();
 const {data:sector,error:sErr}=await db.from("setores").select("id,numero,area").eq("numero",setor).eq("ativo",true).single();
 if(sErr||!sector)throw new Error("Setor não encontrado.");
 const {data:coord,error:cErr}=await db.from("coordenacoes_setor")
   .select("id,ciclo_id,obreiro_rol,coordenador_nome_snapshot,setor_id,ano_base_designacao")
   .eq("setor_id",sector.id).eq("ciclo_id",c.id).eq("obreiro_rol",rol).maybeSingle();
 if(cErr||!coord||coord.ano_base_designacao!==2026)throw new Error("Esta coordenação não corresponde à base de 2026.");
 return{c,sector,coord};
}
async function coordinatorProfile(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const {c,sector,coord}=await coordinatorContext(Number(b.setor),String(b.rol??"").trim());
 const [{data:people,error:pe},{data:manifest,error:me},{data:docs,error:de}]=await Promise.all([
  db.rpc("rod27_obreiro_resumo",{p_rol:coord.obreiro_rol}),
  db.from("manifestacoes_interesse_coordenador")
   .select("status,deseja_permanecer,opcao_movimentacao,justificativa,criado_em,atualizado_em,enviada_em,congregacao_nome_snapshot")
   .eq("ciclo_id",c.id).eq("coordenacao_id",coord.id)
   .eq("coordenador_rol_snapshot",coord.obreiro_rol).maybeSingle(),
  db.from("documentos_coordenador")
   .select("id,nome_original,tipo_mime,tamanho_bytes,enviado_em,sha256")
   .eq("coordenacao_id",coord.id).eq("ciclo_id",c.id)
   .eq("obreiro_rol",coord.obreiro_rol).order("enviado_em",{ascending:false})
 ]);
 if(pe||me||de)throw pe??me??de;
 return{ok:true,ano_base:2026,ciclo_manifestacao:2027,
  coordenador:{id:coord.id,rol:coord.obreiro_rol,nome:people?.[0]?.nome??coord.coordenador_nome_snapshot,
   foto_url:people?.[0]?.foto_url??null,setor:sector.numero,area:sector.area},
  manifestacao:await unveilManifest(manifest),documentos:docs??[]};
}
async function coordinatorUpload(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const {c,coord}=await coordinatorContext(Number(b.setor),String(b.rol??"").trim());
 const nome=String(b.nome??"").trim().replace(/[\r\n\t]/g," ").slice(0,160);
 if(!nome)throw new Error("Informe o nome do documento.");
 const mime=String(b.tipo_mime??"");
 if(!["application/pdf","image/jpeg","image/png"].includes(mime))throw new Error("Envie PDF, JPG ou PNG.");
 const encoded=String(b.base64??"");
 if(!encoded||encoded.length>11185000||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new Error("Arquivo inválido ou maior que 8 MB.");
 const bin=atob(encoded),bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 if(bytes.length===0||bytes.length>8388608)throw new Error("O documento deve ter no máximo 8 MB.");
 const isPdf=bytes.length>4&&bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70,
  isJpeg=bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
  isPng=bytes.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 if(!((mime==="application/pdf"&&isPdf)||(mime==="image/jpeg"&&isJpeg)||(mime==="image/png"&&isPng)))throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("");
 const ext=mime==="application/pdf"?"pdf":mime==="image/jpeg"?"jpg":"png";
 const {data:existing,error:ee}=await db.from("documentos_coordenador").select("id").eq("coordenacao_id",coord.id).eq("sha256",sha256).order("enviado_em",{ascending:false}).limit(1).maybeSingle();
 if(ee)throw Error("Falha ao verificar anexos existentes.");
 if(existing)return{ok:true,documento_id:existing.id,sha256,duplicado:true};
 const path="coordenador/"+c.id+"/"+coord.id+"/"+crypto.randomUUID()+".r27";
 const protectedBytes=await encryptFile(bytes,"document:"+path);
 const {error:storageError}=await db.storage.from("rod27-documentos").upload(path,protectedBytes,{contentType:"application/octet-stream",upsert:false,cacheControl:"private"});
 if(storageError)throw storageError;
 const{data:doc,error:insertError}=await db.from("documentos_coordenador").insert({
  coordenacao_id:coord.id,ciclo_id:c.id,obreiro_rol:coord.obreiro_rol,
  caminho_storage:path,nome_original:nome,tipo_mime:mime,tamanho_bytes:bytes.length,
  sha256,enviado_por:ctx.user.id
 }).select("id").single();
 if(insertError||!doc){
  await db.storage.from("rod27-documentos").remove([path]);
  if(insertError?.code==="23505"){
   const {data:prior,error:pe}=await db.from("documentos_coordenador").select("id").eq("coordenacao_id",coord.id).eq("sha256",sha256).order("enviado_em",{ascending:false}).limit(1).maybeSingle();
   if(!pe&&prior)return{ok:true,documento_id:prior.id,sha256,duplicado:true};
  }
  throw Error("Falha ao registrar documento.");
 }
 await audit(ctx,"anexar_documento_coordenador","documentos_coordenador",doc.id,
   {coordenacao_id:coord.id,ciclo_id:c.id,rol:coord.obreiro_rol,sha256,tamanho:bytes.length});
 return{ok:true,documento_id:doc.id,sha256};
}
async function coordinatorDocumentUrl(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const {c,coord}=await coordinatorContext(Number(b.setor),String(b.rol??"").trim());
 const id=String(b.documento_id??"");
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error("Documento inválido.");
 const{data:doc,error}=await db.from("documentos_coordenador")
  .select("id,caminho_storage,tipo_mime").eq("id",id).eq("coordenacao_id",coord.id)
  .eq("ciclo_id",c.id).eq("obreiro_rol",coord.obreiro_rol).maybeSingle();
 if(error||!doc)throw new Error("Documento indisponível para esta coordenação.");

 await audit(ctx,"consultar_documento_coordenador","documentos_coordenador",id,{coordenacao_id:coord.id});
 return await protectedDocument(id,doc.caminho_storage,doc.tipo_mime);
}
async function bootstrap(ctx:any){const c=await cycle();const{data:selfSetting}=await db.from("configuracoes_sistema_runtime").select("valor").eq("chave","avaliacao.autoavaliacao.permitida").maybeSingle();const autoavaliacao_permitida=selfSetting?.valor?.permitida===true;const[{data:coords},{data:secs},{data:creds},{data:evals}]=await Promise.all([db.from("coordenacoes_setor").select("id,setor_id,obreiro_rol,coordenador_nome_snapshot").eq("ciclo_id",c.id),db.from("setores").select("id,numero,area"),db.from("coordenador_credenciais").select("coordenacao_id,rol_login,status,ultimo_login_em"),db.from("avaliacoes_dirigente").select("coordenacao_id,status,eh_proprio_coordenador").eq("ciclo_id",c.id).eq("eh_proprio_coordenador",false)]);const sm=new Map((secs??[]).map((x:any)=>[x.id,x])),cm=new Map((creds??[]).map((x:any)=>[x.coordenacao_id,x])),em=new Map<string,any[]>();for(const x of evals??[]){const a=em.get(x.coordenacao_id)??[];a.push(x);em.set(x.coordenacao_id,a)}const rows=(coords??[]).map((x:any)=>{const s=sm.get(x.setor_id),cr=cm.get(x.id),ee=em.get(x.id)??[];return{setor:s.numero,area:s.area,coordenador:x.coordenador_nome_snapshot,rol:x.obreiro_rol,total:ee.length,tratamento_especial:0,nao_iniciadas:ee.filter(z=>z.status==="nao_iniciada").length,em_preenchimento:ee.filter(z=>z.status==="em_preenchimento").length,enviadas:ee.filter(z=>z.status==="enviada").length,credencial_status:cr?.status??"nao_configurada",ultimo_login_em:cr?.ultimo_login_em??null}}).sort((a,b)=>a.setor-b.setor);return{ok:true,autoavaliacao_permitida,admin:{email:ctx.user.email,papel:ctx.admin.papel,nome_exibicao:ctx.admin.nome_exibicao},summary:{setores:rows.length,total:rows.reduce((n,x)=>n+x.total,0),nao_iniciadas:rows.reduce((n,x)=>n+x.nao_iniciadas,0),em_preenchimento:rows.reduce((n,x)=>n+x.em_preenchimento,0),enviadas:rows.reduce((n,x)=>n+x.enviadas,0),credenciais_ativas:rows.filter(x=>x.credencial_status==="ativa").length},sectors:rows}}
async function manifestations(ctx:any){if(!canOperate(ctx))throw new Error("Sem permissão.");const c=await cycle();const[{data:coords,error:cErr},{data:secs,error:sErr},{data:churches,error:gErr},{data:owners,error:oErr},{data:rows,error:mErr}]=await Promise.all([db.from("coordenacoes_setor").select("id,setor_id,obreiro_rol,coordenador_nome_snapshot").eq("ciclo_id",c.id),db.from("setores").select("id,numero,area"),db.from("congregacoes").select("id,nome,setor"),db.from("avaliacoes_dirigente").select("coordenacao_id,congregacao_id,congregacao_nome_snapshot,dirigente_rol,dirigente_nome_snapshot").eq("ciclo_id",c.id).eq("eh_proprio_coordenador",true),db.from("manifestacoes_interesse_coordenador").select("id,coordenacao_id,coordenador_rol_snapshot,coordenador_nome_snapshot,setor_numero_snapshot,congregacao_nome_snapshot,deseja_permanecer,opcao_movimentacao,justificativa,status,criado_em,atualizado_em,enviada_em").eq("ciclo_id",c.id)]);if(cErr||sErr||gErr||oErr||mErr)throw cErr??sErr??gErr??oErr??mErr;const sm=new Map((secs??[]).map((x:any)=>[x.id,x])),gm=new Map((churches??[]).map((x:any)=>[x.id,x])),om=new Map((owners??[]).map((x:any)=>[x.coordenacao_id,x])),mm=new Map((await Promise.all((rows??[]).map(unveilManifest))).map((x:any)=>[x.coordenacao_id,x]));const list=(coords??[]).map((x:any)=>{const sec=sm.get(x.setor_id),own=om.get(x.id),church=gm.get(own?.congregacao_id),m=mm.get(x.id);if(!sec||!own||!church||own.dirigente_rol!==x.obreiro_rol||own.dirigente_nome_snapshot!==x.coordenador_nome_snapshot||own.congregacao_nome_snapshot!==church.nome||church.setor!==sec.numero)throw new Error("Identificação de coordenação ou setor inconsistente.");return{id:m?.id??null,status:m?.status??"pendente",coordenador_rol_snapshot:x.obreiro_rol,coordenador_nome_snapshot:x.coordenador_nome_snapshot,setor_numero_snapshot:sec.numero,area:sec.area,congregacao_id:own.congregacao_id,congregacao_nome_snapshot:own.congregacao_nome_snapshot,deseja_permanecer:m?.deseja_permanecer??null,opcao_movimentacao:m?.opcao_movimentacao??null,justificativa:m?.justificativa??null,criado_em:m?.criado_em??null,atualizado_em:m?.atualizado_em??null,enviada_em:m?.enviada_em??null}}).sort((a,b)=>a.setor_numero_snapshot-b.setor_numero_snapshot);return{ok:true,manifestations:list}}async function sector(n:number){const x=await sectorContext(n);const{data:e,error}=await db.from("avaliacoes_dirigente").select("id,congregacao_nome_snapshot,dirigente_nome_snapshot,dirigente_foto_url_snapshot,status,eh_proprio_coordenador,iniciada_em,enviada_em").eq("ciclo_id",x.c.id).eq("coordenacao_id",x.coord.id).eq("eh_proprio_coordenador",false).order("congregacao_nome_snapshot");if(error)throw error;return{ok:true,setor:x.s.numero,area:x.s.area,coordenador:x.coord.coordenador_nome_snapshot,evaluations:e??[]}}
async function evaluation(id:string){const{data:e,error}=await db.from("avaliacoes_dirigente").select("id,ciclo_id,coordenacao_id,congregacao_nome_snapshot,dirigente_nome_snapshot,status,enviada_em,eh_proprio_coordenador,formulario_versao,formulario_snapshot").eq("id",id).eq("eh_proprio_coordenador",false).maybeSingle();if(error||!e||e.status!=="enviada")return null;const[{data:q},{data:a},{data:c}]=await Promise.all([db.from("perguntas_avaliacao").select("id,titulo,ordem").eq("ciclo_id",e.ciclo_id).eq("ativa",true).eq("status","publicada").order("ordem"),db.from("respostas_avaliacao").select("pergunta_id,resposta_texto,resposta_opcao").eq("avaliacao_id",e.id),db.from("classificacoes_avaliacao").select("*").eq("avaliacao_id",e.id).maybeSingle()]);const clear=await Promise.all((a??[]).map((z:any)=>unveilAnswer(z,e.id)));const am=new Map(clear.map((z:any)=>[z.pergunta_id,z]));const answerQuestions=Array.isArray(e.formulario_snapshot?.questions)?e.formulario_snapshot.questions:(q??[]);const answers=answerQuestions.map((z:any)=>{const r=am.get(z.id);return{titulo:z.titulo,resposta:r?.resposta_texto??r?.resposta_opcao??""}});const{data:co}=await db.from("coordenacoes_setor").select("setor_id").eq("id",e.coordenacao_id).single();const{data:s}=await db.from("setores").select("numero").eq("id",co.setor_id).single();return{ok:true,evaluation:e,answers,classification:c?{...c,resumo_analitico:await decryptText(c.resumo_analitico,"classification:"+e.id)}:null,setor:s.numero}}

async function exportDetailed(ctx:any,b:any){
 if(!canOperate(ctx))throw Error("Acesso restrito.");
 const mode=String(b.scope??"all");
 if(!["all","sector","evaluation"].includes(mode))throw Error("Escopo inválido.");
 const sectorId=Number(b.setor),evalId=String(b.avaliacao_id??"");
 if(mode==="sector"&&(!Number.isInteger(sectorId)||sectorId<1||sectorId>42))throw Error("Setor inválido.");
 if(mode==="evaluation"&&!/^[a-f0-9-]{36}$/i.test(evalId))throw Error("Avaliação inválida.");
 const c=await cycle();
 const [{data:secs,error:serr},{data:coords,error:cerr},{data:published,error:perr}]=await Promise.all([
  db.from("setores").select("id,numero,area"),
  db.from("coordenacoes_setor").select("id,setor_id,obreiro_rol,coordenador_nome_snapshot").eq("ciclo_id",c.id),
  db.from("perguntas_avaliacao").select("id,titulo,enunciado,ordem,codigo").eq("ciclo_id",c.id).eq("ativa",true).eq("status","publicada").order("ordem")
 ]);
 if(serr||cerr||perr)throw serr??cerr??perr;
 const sm=new Map((secs??[]).map((x:any)=>[x.id,x]));
 const cm=new Map((coords??[]).map((x:any)=>[x.id,x]));
 let evaluations:any[]=[];
 for(let page=0;page<25;page++){
  let q=db.from("avaliacoes_dirigente").select("id,ciclo_id,coordenacao_id,dirigente_rol,dirigente_nome_snapshot,congregacao_nome_snapshot,status,enviada_em,formulario_versao,formulario_snapshot,origem_preenchimento").eq("ciclo_id",c.id).eq("status","enviada").eq("eh_proprio_coordenador",false).order("id").range(page*400,(page+1)*400-1);
  if(mode==="evaluation")q=q.eq("id",evalId);
  const {data,error}=await q;
  if(error)throw error;
  evaluations.push(...(data??[]));
  if((data??[]).length<400)break;
 }
 if(mode==="evaluation"&&!evaluations.length)throw Error("Nenhuma avaliação enviada foi encontrada.");
 const evals=evaluations.filter((ev:any)=>{
  const co=cm.get(ev.coordenacao_id),sec=sm.get(co?.setor_id);
  return co&&sec&&(mode!=="sector"||sec.numero===sectorId);
 });
 const answerMap=new Map<string,any[]>();
 for(let i=0;i<evals.length;i+=10){
  const ids=evals.slice(i,i+10).map((x:any)=>x.id);
  const {data,error}=await db.from("respostas_avaliacao").select("avaliacao_id,pergunta_id,resposta_texto,resposta_opcao").in("avaliacao_id",ids).limit(1000);
  if(error)throw error;
  for(const r of data??[]){const list=answerMap.get(r.avaliacao_id)??[];list.push(r);answerMap.set(r.avaliacao_id,list);}
 }
 const rows:any[]=[];
 for(const ev of evals){
  const co=cm.get(ev.coordenacao_id),sec=sm.get(co.setor_id);
  const questions=Array.isArray(ev.formulario_snapshot?.questions)?ev.formulario_snapshot.questions:(published??[]);
  const answers=new Map((answerMap.get(ev.id)??[]).map((x:any)=>[x.pergunta_id,x]));
  for(const q of questions){
   const answer:any=answers.get(q.id);
   rows.push({
    area:sec.area,setor:sec.numero,coordenador:co.coordenador_nome_snapshot,coordenador_rol:co.obreiro_rol,
    congregacao:ev.congregacao_nome_snapshot,dirigente:ev.dirigente_nome_snapshot,dirigente_rol:ev.dirigente_rol,
    avaliacao_id:ev.id,versao:ev.formulario_versao,origem:ev.origem_preenchimento,
    enviada_em:ev.enviada_em,pergunta_numero:q.ordem,pergunta:q.enunciado||q.titulo,
    resposta:await decryptText(answer?.resposta_texto??answer?.resposta_opcao??"","answer:"+ev.id+":"+q.id)
   });
  }
 }
 const areaNumber=(a:any)=>{const n=String(a??"").match(/\d+/);return n?Number(n[0]):999;};
 rows.sort((a,b)=>areaNumber(a.area)-areaNumber(b.area)||Number(a.setor)-Number(b.setor)||
 String(a.congregacao).localeCompare(String(b.congregacao),"pt-BR")||
 Number(a.pergunta_numero)-Number(b.pergunta_numero));
 return{ok:true,scope:mode,rows,total_avaliacoes:evals.length,total_respostas:rows.length};
}
async function resetPin(ctx:any,n:number){if(!canOperate(ctx))throw new Error("Sem permissão.");const x=await sectorContext(n),pin=genPin(),hash=await hashPin(pin);const{data,error}=await db.rpc("rod27_reset_coordinator_pin",{p_cred_id:x.cred.id,p_pin:pin,p_hash:hash,p_admin:ctx.user.id});if(error)throw error;return{ok:true,setor:n,rol:data?.[0]?.rol??x.coord.obreiro_rol,pin}}
async function revoke(ctx:any,n:number){if(!canOperate(ctx))throw new Error("Sem permissão.");const x=await sectorContext(n);await db.from("coordenador_sessoes").update({revogada_em:new Date().toISOString()}).eq("credencial_id",x.cred.id).is("revogada_em",null);const{error}=await db.from("coordenador_credenciais").update({status:"revogada"}).eq("id",x.cred.id);if(error)throw error;await audit(ctx,"revoke_coordinator","coordenador_credenciais",x.cred.id,{setor:n});return{ok:true}}
async function saveClass(ctx:any,b:any){if(!canOperate(ctx))throw new Error("Sem permissão.");const evaluationId=String(b.avaliacao_id??"").trim();if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(evaluationId))throw new Error("Avaliação inválida.");const currentCycle=await cycle();const{data:targetEval,error:targetError}=await db.from("avaliacoes_dirigente").select("status").eq("id",evaluationId).eq("ciclo_id",currentCycle.id).maybeSingle();if(targetError||!targetEval||targetEval.status!=="enviada")throw new Error("A avaliação precisa estar enviada para classificação.");const allowed=["pessimo","ruim","mediano","bom","excelente"];for(const k of["qualificacao","reputacao","capacitacao","engajamento"])if(!allowed.includes(String(b[k])))throw new Error("Classificação inválida.");const payload={avaliacao_id:evaluationId,status:"validada",qualificacao:b.qualificacao,reputacao:b.reputacao,capacitacao:b.capacitacao,engajamento:b.engajamento,resumo_analitico:await encryptText(String(b.resumo??"").trim()||null,"classification:"+evaluationId),validado_por:ctx.user.id,validado_em:new Date().toISOString(),atualizado_em:new Date().toISOString()};const{error}=await db.from("classificacoes_avaliacao").upsert(payload,{onConflict:"avaliacao_id"});if(error)throw error;await audit(ctx,"classify_evaluation","avaliacoes_dirigente",payload.avaliacao_id,{qualificacao:b.qualificacao,reputacao:b.reputacao,capacitacao:b.capacitacao,engajamento:b.engajamento});return{ok:true}}
async function blankForm(ctx:any,b:any){
 const current=await cycle();
 const [{data:questions,error:qErr},{data:form,error:fErr}]=await Promise.all([
  db.from("perguntas_avaliacao").select("id,ordem,codigo,titulo,enunciado,tipo_resposta,opcoes,obrigatoria,status,ativa").eq("ciclo_id",current.id).eq("ativa",true).eq("status","publicada").order("ordem"),
  db.from("configuracoes_avaliacao").select("status,versao,titulo_aviso,texto_aviso").eq("ciclo_id",current.id).order("versao",{ascending:false}).limit(1).maybeSingle()
 ]);
 if(qErr||fErr)throw qErr??fErr;
 if(!questions?.length)throw new Error("Não há perguntas cadastradas.");
 let sectorInfo:any=null;
 const num=Number(b.setor);
 if(Number.isInteger(num)&&num>0&&num<=42){
  const sectorData=await sectorContext(num);
  sectorInfo={numero:sectorData.s.numero,area:sectorData.s.area,coordenador:sectorData.coord.coordenador_nome_snapshot,rol:sectorData.coord.obreiro_rol};
 }
 return{ok:true,form:{status:form?.status??"rascunho",versao:form?.versao??1,title:form?.titulo_aviso??"",notice:form?.texto_aviso??""},sector:sectorInfo,questions};
}

async function blankBatch(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const tipo=String(b.tipo??"");
 if(!["manifestacao","avaliacao"].includes(tipo))throw new Error("Tipo de formulário inválido.");
 const raw=Array.isArray(b.setores)?b.setores:[];
 const selected=[...new Set(raw.map(Number))];
 if(!selected.length||selected.length>42||selected.some(n=>!Number.isInteger(n)||n<1||n>42))throw new Error("Selecione de 1 a 42 setores válidos.");
 const c=await cycle();
 const [{data:secs,error:se},{data:coords,error:ce},{data:questions,error:qe},{data:settings,error:fe}]=await Promise.all([
  db.from("setores").select("id,numero,area").in("numero",selected),
  db.from("coordenacoes_setor").select("id,setor_id,obreiro_rol,coordenador_nome_snapshot").eq("ciclo_id",c.id),
  tipo==="avaliacao"?db.from("perguntas_avaliacao").select("id,ordem,titulo,enunciado,tipo_resposta,opcoes,obrigatoria").eq("ciclo_id",c.id).eq("ativa",true).eq("status","publicada").order("ordem"):Promise.resolve({data:[],error:null}),
  tipo==="avaliacao"?db.from("configuracoes_avaliacao").select("status,versao").eq("ciclo_id",c.id).order("versao",{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null,error:null})
 ]);
 if(se||ce||qe||fe)throw se??ce??qe??fe;
 const cmap=new Map((coords??[]).map((x:any)=>[x.setor_id,x]));
 const selectedSecs=(secs??[]).sort((x:any,y:any)=>x.numero-y.numero);
 if(selectedSecs.length!==selected.length)throw new Error("Um ou mais setores não foram encontrados.");
 const ids=selectedSecs.map((s:any)=>cmap.get(s.id)?.id).filter(Boolean);
 if(ids.length!==selected.length)throw new Error("Há setor sem coordenação vigente.");
 let rows:any[]=[];
 if(tipo==="avaliacao"){
  const{data,error}=await db.from("avaliacoes_dirigente")
   .select("id,coordenacao_id,dirigente_nome_snapshot,dirigente_rol,congregacao_nome_snapshot")
   .eq("ciclo_id",c.id).eq("eh_proprio_coordenador",false).in("coordenacao_id",ids)
   .order("congregacao_nome_snapshot").limit(1000);
  if(error)throw error;
  rows=data??[];
  if(!questions?.length)throw new Error("O formulário de avaliação não tem perguntas publicadas.");
 }
 const groups=selectedSecs.map((sector:any)=>{
  const coord=cmap.get(sector.id);
  return{setor:sector.numero,area:sector.area,coordenador:coord.coordenador_nome_snapshot,
   rol:coord.obreiro_rol,avaliacoes:rows.filter((x:any)=>x.coordenacao_id===coord.id).map((x:any)=>({
    id:x.id,dirigente:x.dirigente_nome_snapshot,rol:x.dirigente_rol,congregacao:x.congregacao_nome_snapshot
   }))};
 });
 return{ok:true,tipo,ano:2027,versao:settings?.versao??1,setores:groups,perguntas:questions??[]};
}
async function officeLookup(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Sem autorização para editar.");
 const rol=String(b.rol??"").trim();
 if(!/^[0-9]{1,12}$/.test(rol))throw new Error("Informe um ROL numérico válido.");
 const {data,error}=await db.rpc("rod27_obreiro_resumo",{p_rol:rol});
 if(error)throw error;
 if(!data?.length)throw new Error("ROL não encontrado no fichário.");
 return{ok:true,obreiro:data[0]};
}
async function officeReplacePastor(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Sem autorização para editar.");
 const id=String(b.avaliacao_id??"");
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error("Avaliação inválida.");
 const {data,error}=await db.rpc("rod27_substituir_dirigente",{p_avaliacao_id:id,p_novo_rol:String(b.rol??""),p_admin:ctx.user.id});
 if(error)throw error;
 return{ok:true,obreiro:data?.[0]};
}
async function officeChangeCoordinator(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Sem autorização para editar.");
 const setor=Number(b.setor),rol=String(b.rol??"").trim();
 if(!Number.isInteger(setor)||setor<1||setor>42||!/^[0-9]{1,12}$/.test(rol))throw new Error("Setor ou ROL inválido.");
 const pin=genPin(),hash=await hashPin(pin);
 const {data,error}=await db.rpc("rod27_change_coordinator_with_pin",{p_setor:setor,p_novo_rol:rol,p_novo_hash:hash,p_novo_pin:pin,p_admin:ctx.user.id});
 if(error)throw error;
 return{ok:true,coordenador:data?.[0],pin};
}
async function requireCurrentEval(id:string){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error("ID de avaliação inválido.");
 const c=await cycle();
 const {data,error}=await db.from("avaliacoes_dirigente").select("id,ciclo_id,coordenacao_id,congregacao_nome_snapshot,dirigente_nome_snapshot,status,origem_preenchimento,dirigente_rol,eh_proprio_coordenador").eq("id",id).eq("ciclo_id",c.id).eq("eh_proprio_coordenador",false).maybeSingle();
 if(error||!data)throw new Error("Ficha não encontrada no ciclo 2027.");
 return data;
}
async function officeDocuments(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Permissão insuficiente para consultar rascunhos e documentos originais.");
 const evalId=String(b.avaliacao_id??"");
 await requireCurrentEval(evalId);
 const {data,error}=await db.from("documentos_avaliacao").select("id,nome_original,tipo_mime,tamanho_bytes,sha256,enviado_em,status_ocr").eq("avaliacao_id",evalId).order("enviado_em",{ascending:false});
 if(error)throw error;
 return{ok:true,documentos:data??[]};
}
async function officeDocumentUrl(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Permissão insuficiente para consultar rascunhos e documentos originais.");
 const id=String(b.documento_id??"");
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error("Documento inválido.");
 const{data:doc,error}=await db.from("documentos_avaliacao").select("id,caminho_storage,avaliacao_id,tipo_mime").eq("id",id).maybeSingle();
 if(error||!doc)throw new Error("Documento não encontrado.");
 await requireCurrentEval(doc.avaliacao_id);

 await audit(ctx,"consultar_documento","documentos_avaliacao",id,{avaliacao_id:doc.avaliacao_id});
 return await protectedDocument(id,doc.caminho_storage,doc.tipo_mime);
}
async function officeUploadDocument(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Sem autorização para anexar.");
 const evalId=String(b.avaliacao_id??"");
 await requireCurrentEval(evalId);
 const nome=String(b.nome??"documento").trim().replace(/[\\r\\n\\t]/g," ").slice(0,160);
 const mime=String(b.tipo_mime??"");
 if(!["application/pdf","image/jpeg","image/png"].includes(mime))throw new Error("Envie PDF, JPG ou PNG.");
 const encoded=String(b.base64??"");
 if(!encoded||encoded.length>11185000||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new Error("Documento inválido ou maior que 8 MB.");
 const bin=atob(encoded),bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 if(bytes.length===0||bytes.length>8388608)throw new Error("O documento deve ter no máximo 8 MB.");
 const isPdf=bytes.length>4&&bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70,
       isJpeg=bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
       isPng=bytes.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 if(!((mime==="application/pdf"&&isPdf)||(mime==="image/jpeg"&&isJpeg)||(mime==="image/png"&&isPng)))throw new Error("Tipo real do arquivo não corresponde à extensão.");
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("");
 const ext=mime==="application/pdf"?"pdf":mime==="image/jpeg"?"jpg":"png";
 const {data:existing,error:existingError}=await db.from("documentos_avaliacao")
  .select("id").eq("avaliacao_id",evalId).eq("sha256",hash)
  .order("enviado_em",{ascending:false}).limit(1).maybeSingle();
 if(existingError)throw new Error("Falha ao verificar anexos existentes.");
 if(existing)return{ok:true,documento_id:existing.id,sha256:hash,duplicado:true};
 const path="aval/"+evalId+"/"+crypto.randomUUID()+".r27";
 const protectedBytes=await encryptFile(bytes,"document:"+path);const{error:uploadError}=await db.storage.from("rod27-documentos").upload(path,protectedBytes,{contentType:"application/octet-stream",upsert:false,cacheControl:"private"});
 if(uploadError){console.error("doc upload storage",uploadError);throw new Error("Falha ao armazenar PDF no arquivo privado.");}
 const{data:doc,error:dbErr}=await db.from("documentos_avaliacao").insert({avaliacao_id:evalId,caminho_storage:path,nome_original:nome,tipo_mime:mime,tamanho_bytes:bytes.length,sha256:hash,enviado_por:ctx.user.id,status_ocr:"nao_processado"}).select("id").single();
 if(dbErr||!doc){
  await db.storage.from("rod27-documentos").remove([path]);
  if(dbErr?.code==="23505"){
   const {data:prior,error:pe}=await db.from("documentos_avaliacao").select("id").eq("avaliacao_id",evalId).eq("sha256",hash).order("enviado_em",{ascending:false}).limit(1).maybeSingle();
   if(!pe&&prior)return{ok:true,documento_id:prior.id,sha256:hash,duplicado:true};
  }
  throw Error("Falha ao cadastrar o documento.");
 }
 await audit(ctx,"upload_documento_assinado","documentos_avaliacao",doc.id,{avaliacao_id:evalId,sha256:hash,tamanho:bytes.length});
 return{ok:true,documento_id:doc.id,sha256:hash};
}
async function officeTranscription(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Permissão insuficiente para consultar rascunhos e documentos originais.");
 const ev=await requireCurrentEval(String(b.avaliacao_id??""));
 if(ev.status==="enviada")throw new Error("A ficha já foi enviada; consulte a avaliação.");
 const [{data:questions,error:qErr},{data:draft,error:dErr},{data:docs,error:docErr}]=await Promise.all([
  db.from("perguntas_avaliacao").select("id,titulo,enunciado,tipo_resposta,opcoes,ordem,obrigatoria,status").eq("ciclo_id",ev.ciclo_id).eq("ativa",true).eq("status","publicada").order("ordem"),
  db.from("transcricoes_secretaria").select("respostas,documento_id,transcrito_por,atualizado_em").eq("avaliacao_id",ev.id).maybeSingle(),
  db.from("documentos_avaliacao").select("id,nome_original,tipo_mime,tamanho_bytes,enviado_em").eq("avaliacao_id",ev.id).order("enviado_em",{ascending:false})
 ]);
 if(qErr||dErr||docErr)throw qErr??dErr??docErr;
 const rows=Array.isArray(draft?.respostas)?await Promise.all(draft.respostas.map(async(item:any)=>({
 ...item,resposta:await decryptText(item.resposta??null,"answer:"+ev.id+":"+item.pergunta_id)}))):null;
 return{ok:true,avaliacao:ev,perguntas:questions??[],rascunho:draft?{...draft,respostas:rows}:null,documentos:docs??[]};
}
async function officeSaveTranscription(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Sem autorização para transcrever.");
 const ev=await requireCurrentEval(String(b.avaliacao_id??""));
 if(ev.status==="enviada")throw new Error("A ficha já foi enviada.");
 const respostas=Array.isArray(b.respostas)?b.respostas:[];
 if(respostas.length>80)throw new Error("Quantidade de respostas inválida.");
 const doc=b.documento_id?String(b.documento_id):null;
 if(doc&&!/^[a-f0-9-]{36}$/i.test(doc))throw new Error("Documento inválido.");
 const{data:validQuestions,error:qerr}=await db.from("perguntas_avaliacao").select("id,tipo_resposta,opcoes,ativa,status").eq("ciclo_id",ev.ciclo_id);
 if(qerr)throw qerr;
 const byId=new Map((validQuestions??[]).map((x:any)=>[x.id,x]));
 const encrypted:any[]=[];
 for(const item of respostas){
  const q:any=byId.get(String(item?.pergunta_id??""));
  if(!q||!q.ativa)throw new Error("Pergunta inválida.");
  const value=String(item?.resposta??"").trim();
  if(value.length>10000)throw new Error("Resposta longa demais.");
  if(q.tipo_resposta==="escolha_unica"&&value&&!q.opcoes?.includes(value))throw new Error("Opção inválida.");
  if(b.finalizar===true&&q.status!=="publicada")throw new Error("Pergunta não publicada.");
  encrypted.push({pergunta_id:q.id,resposta:value?await encryptText(value,"answer:"+ev.id+":"+q.id):""});
 }
 const{data,error}=await db.rpc("rod27_salvar_transcricao",{p_avaliacao:ev.id,p_admin:ctx.user.id,p_respostas:encrypted,p_documento:doc,p_finalizar:b.finalizar===true});
 if(error){
  console.error("rod27 transcription failed",error.code,error.message);
  const msg=String(error.message||"");
  if(msg.includes("perguntas obrigatórias")||msg.includes("Responda todas"))throw new Error("Preencha todas as perguntas obrigatórias antes de concluir.");
  if(msg.includes("Aguarde a publicação"))throw new Error("O formulário ainda não está publicado.");
  if(msg.includes("Ficha já foi iniciada")||msg.includes("ficha já foi iniciada"))throw new Error("Esta ficha já foi iniciada por outra origem. Não é possível transcrevê-la automaticamente.");
  if(msg.includes("não corresponde à ficha"))throw new Error("O PDF selecionado não pertence a esta avaliação.");
  throw new Error("Não foi possível salvar a transcrição. Verifique o formulário e tente novamente.");
 }
 return{ok:true,resultado:data?.[0]};
}

function requireSecretary(ctx:any){if(ctx.admin.papel!=="secretario_geral")throw Error("Acesso exclusivo do secretário-geral.");}
async function accessGet(ctx:any){
 requireSecretary(ctx);
 const [{data:policy,error:pe},{data:grants,error:ge},{data:accounts,error:ae}]=await Promise.all([
 db.from("rod27_secretaria_access_policy").select("enabled,allow_all,revision").eq("id",1).single(),
 db.from("rod27_secretaria_access_grants").select("user_id"),
 db.from("usuarios_admin").select("user_id,nome_exibicao,papel").eq("ativo",true)]);
 if(pe||ge||ae)throw pe??ge??ae;
 return{ok:true,policy,grants:(grants??[]).map((g:any)=>g.user_id),accounts};
}
async function accessSet(ctx:any,b:any){
 requireSecretary(ctx);
 if(typeof b.enabled!=="boolean"||typeof b.allow_all!=="boolean"||!Array.isArray(b.grants)||!Number.isInteger(b.revision))throw Error("Configuração inválida.");
 const {error}=await db.rpc("rod27_set_secretaria_access",{p_actor:ctx.user.id,p_enabled:b.enabled,p_allow_all:b.allow_all,p_grants:b.grants,p_revision:b.revision});
 if(error)throw Error("Não foi possível salvar. Atualize o controle de acesso e tente novamente.");
 return accessGet(ctx);
}
async function myProfile(ctx:any){
 requireSecretary(ctx);
 const {data,error}=await db.from("rod27_recovery_emails").select("id,email,verified_at").eq("user_id",ctx.user.id).order("created_at");
 if(error)throw error;
 return{ok:true,primary_email:ctx.user.email,secondary_emails:data??[],delivery_available:recoveryMailReady(),
 delivery_status:recoveryMailReady()?"Envio configurado. Confirme os endereços adicionais antes de usá-los para recuperação.":"O envio ao endereço secundário aguarda a configuração do remetente. O e-mail principal e o acesso atual permanecem disponíveis."};
}
async function recoveryEmailSave(ctx:any,b:any){
 requireSecretary(ctx);
 const email=String(b.email??"").trim().toLowerCase();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||email===ctx.user.email?.toLowerCase())throw Error("Informe um e-mail secundário válido.");
 const {error}=await db.rpc("rod27_save_recovery_email",{p_actor:ctx.user.id,p_email:email,p_remove:b.remove===true});
 if(error)throw Error("Não foi possível atualizar o endereço secundário.");
 return myProfile(ctx);
}

async function handle(req:Request){const ctx=await resolveAdmin(req);if(!ctx)return fail("Sessão inválida ou conta não autorizada.",401);let b:any;try{b=await req.json()}catch{return fail("Requisição inválida.",400)};try{if(String(b.action??"")==="change_own_password")return json(await completeRequiredPasswordChange(db,ctx.user,req,b,true));if(String(b.action??"")==="change_required_password")return json(await completeRequiredPasswordChange(db,ctx.user,req,b));if(passwordChangeRequired(ctx.user))return json({ok:false,password_change_required:true,error:"Troca obrigatória de senha antes de acessar a administração."},428);if(!await secretariaAllowed(db,ctx.user.id))return fail("Acesso à Secretaria não autorizado pelo secretário-geral.",403);ctx.secretariaAllowed=true;switch(String(b.action??"")){case"secretaria_access_get":return json(await accessGet(ctx));case"secretaria_access_set":return json(await accessSet(ctx,b));case"my_profile":return json(await myProfile(ctx));case"recovery_email_verify_request":return json(await requestRecoveryConfirmation(db,ctx,String(b.email_id??"")));case"recovery_email_save":return json(await recoveryEmailSave(ctx,b));case"bootstrap":return json(await bootstrap(ctx));case"map_2026":return json(await map2026(ctx));case"planning_snapshot":return json(await planningSnapshot(ctx));case"planning_move":return json(await planningMove(ctx,b));case"planning_undo":return json(await planningUndo(ctx,b));case"planning_find":return json(await planningFind(ctx,b));case"coordinator_profile":return json(await coordinatorProfile(ctx,b));case"coordinator_document_upload":return json(await coordinatorUpload(ctx,b));case"coordinator_document_url":return json(await coordinatorDocumentUrl(ctx,b));case"manifestations":return json(await manifestations(ctx));case"export_detailed":return json(await exportDetailed(ctx,b));case"blank_form":return json(await blankForm(ctx,b));case"blank_batch":return json(await blankBatch(ctx,b));case"office_lookup_obreiro":return json(await officeLookup(ctx,b));case"office_replace_dirigente":return json(await officeReplacePastor(ctx,b));case"office_change_coordinator":return json(await officeChangeCoordinator(ctx,b));case"office_documents":return json(await officeDocuments(ctx,b));case"office_document_url":return json(await officeDocumentUrl(ctx,b));case"office_upload_document":return json(await officeUploadDocument(ctx,b));case"office_transcription":return json(await officeTranscription(ctx,b));case"office_save_transcription":return json(await officeSaveTranscription(ctx,b));case"sector":return json(await sector(Number(b.setor)));case"evaluation":{if(!canOperate(ctx))throw new Error("Leitura das respostas restrita à Secretaria e superadministrador.");const d=await evaluation(String(b.avaliacao_id??""));return d?json(d):fail("Avaliação não encontrada.",404)}case"reset_coordinator_pin":return json(await resetPin(ctx,Number(b.setor)));case"revoke_coordinator":return json(await revoke(ctx,Number(b.setor)));case"save_classification":return json(await saveClass(ctx,b));default:return fail("Ação desconhecida.",400)}}catch(e){console.error("rod27-admin operation failed");return fail(e instanceof Error?e.message:"Falha administrativa.",400)}}
Deno.serve(async(req:Request)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method==="GET")return Response.redirect("https://rod27-ieadern.pages.dev/secretaria",302);if(req.method==="POST")return handle(req);return new Response("Method not allowed",{status:405,headers:cors})});