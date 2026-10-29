import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {recoveryMailReady,digestRecovery,sendRecoveryMail,RECOVERY_ORIGIN} from '../_shared/recovery-mail.ts';
const URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')??'{}').default;
const db=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':RECOVERY_ORIGIN,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
function json(body:any,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})}
const generic={ok:true,message:'Se este endereço estiver habilitado, as instruções serão enviadas.'};
async function handle(req:Request){
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({ok:false,error:'Método não permitido.'},405);
 if(Number(req.headers.get('content-length')??0)>4096)return json({ok:false,error:'Requisição inválida.'},400);
 let b:any;try{
  const reader=req.body?.getReader();if(!reader)throw Error();
  let total=0;const chunks:Uint8Array[]=[];
  while(true){const next=await reader.read();if(next.done)break;total+=next.value.length;if(total>4096){await reader.cancel();throw Error()}chunks.push(next.value)}
  const bytes=new Uint8Array(total);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
  b=JSON.parse(new TextDecoder().decode(bytes));
 }catch{return json({ok:false,error:'Requisição inválida.'},400)}
 if(b.action==='confirm_secondary'){
  if(typeof b.token!=='string'||!/^[-_a-zA-Z0-9]{43}$/.test(b.token))return json({ok:false,error:'Link inválido ou expirado.'},400);
  const {data,error}=await db.rpc('rod27_confirm_recovery_email',{p_hash:await digestRecovery(b.token)});
  return !error&&data===true?json({ok:true}):json({ok:false,error:'Link inválido, expirado ou já utilizado.'},400);
 }
 if(b.action!=='request')return json({ok:false,error:'Ação inválida.'},400);
 if(!recoveryMailReady())return json({ok:false,delivery_unavailable:true,error:'O envio ao endereço secundário ainda não está disponível.'},503);
 const email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return json(generic,202);
 try{
  const lookup=await db.rpc('rod27_recovery_lookup',{p_email:email});
  if(lookup.error||lookup.data?.length!==1)return json(generic,202);
  const account=lookup.data[0];
  const rate=await db.rpc('rod27_recovery_consume_rate',{p_bucket:await digestRecovery(account.user_id)});
  if(rate.error||rate.data!==true)return json(generic,202);
  const generated=await db.auth.admin.generateLink({type:'recovery',email:account.primary_email,options:{redirectTo:RECOVERY_ORIGIN+'/redefinir-senha'}});
  const hash=generated.data?.properties?.hashed_token;
  if(generated.error||typeof hash!=='string'||!/^\w{32,128}$/.test(hash))return json(generic,202);
  const link=RECOVERY_ORIGIN+'/redefinir-senha#type=recovery&token_hash='+encodeURIComponent(hash);
  // Separate messages: no contact is exposed to another recipient.
  const recipients=[...new Set<string>([account.primary_email,...(account.secondary_emails??[])])];
  let accepted=0;
  const requestId=crypto.randomUUID();
  for(let i=0;i<recipients.length;i++){
   try{await sendRecoveryMail(recipients[i],'Recuperação de acesso ao Rod27','Abra o link para escolher uma nova senha. Ele é temporário e pode ser utilizado uma única vez.',link,requestId+'-'+i);accepted++}catch{/* Never log provider payloads or recovery tokens. */}
  }
  await db.from('auditoria_sistema').insert({user_id:account.user_id,papel:'recovery',acao:'recovery_delivery_requested',entidade:'usuarios_admin',entidade_id:account.user_id,detalhes:{recipient_count:recipients.length,provider_accepted:accepted,delivery_confirmed:false}});
 }catch{/* Public result must not disclose account existence or internal errors. */}
 return json(generic,202);
}
Deno.serve(handle);
