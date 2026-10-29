import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const strip=s=>s.replace(/export\s*\{[\s\S]*$/,'');
const helper=strip(fs.readFileSync(process.argv[2],'utf8')),server=fs.readFileSync(process.argv[3],'utf8');
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++};
function setup(){
 const state={enabled:true,found:true,rate:true,generateError:false,providerError:false,confirm:true,mails:[],rpc:[],audits:[],email:{id:'email-fixture',email:'secondary@example.invalid',verified_at:null}};
 const values={ROD27_RECOVERY_DELIVERY_ENABLED:'true',ROD27_RECOVERY_RESEND_KEY:'synthetic-key',ROD27_RECOVERY_FROM:'noreply@example.invalid'};
 const db={rpc:async(name,args)=>{state.rpc.push({name,args});
  if(name==='rod27_recovery_lookup')return{data:state.found?[{user_id:'fixture-user',primary_email:'primary@example.invalid',secondary_emails:['secondary@example.invalid']}]:[]};
  if(name==='rod27_recovery_consume_rate')return{data:state.rate};
  if(name==='rod27_confirm_recovery_email')return{data:state.confirm};return{};
 },auth:{admin:{generateLink:async()=>state.generateError?{error:{code:'fixture'}}:{data:{properties:{hashed_token:'a'.repeat(64)}}}}},from(table){return{select(){return this},eq(){return this},maybeSingle:async()=>({data:state.email}),insert:async row=>{state.audits.push(row);return{}},update(){return this},then(resolve){resolve({})}}}};
 const context=vm.createContext({Response,Request,TextEncoder,TextDecoder,AbortSignal,crypto:globalThis.crypto,atob,btoa,db,
  Deno:{env:{get:k=>k==='ROD27_RECOVERY_DELIVERY_ENABLED'?(state.enabled?'true':'false'):values[k]},serve(){}},
  fetch:async(url,options)=>{check(url==='https://api.resend.com/emails','provider endpoint fixed');const mail=JSON.parse(options.body);state.mails.push(mail);return new Response(JSON.stringify(state.providerError?{error:'fixture'}:{id:'synthetic-provider-id'}),{status:state.providerError?403:200})}
 });
 vm.runInContext(helper,context);vm.runInContext(server.slice(server.indexOf('const cors =')).replace(/Deno.serve\([\s\S]*$/,''),context);
 return{context,state};
}
const req=body=>new Request('https://test.invalid',{method:'POST',body:JSON.stringify(body)});
{
 const {context:c,state:s}=setup();s.enabled=false;
 const r=await c.handle(req({action:'request',email:'secondary@example.invalid'}));check(r.status===503,'unconfigured delivery is explicit');check(s.rpc.length===0&&s.mails.length===0,'no token or send without provider');
 await assert.rejects(()=>c.requestRecoveryConfirmation(c.db,{user:{id:'fixture-user'},admin:{papel:'secretario_geral'}},'email-fixture'));checks++;
}
{
 const {context:c,state:s}=setup();const r=await c.handle(req({action:'request',email:' SECONDARY@example.invalid '}));
 check(r.status===202,'public result generic');check(s.mails.length===2,'both verified addresses selected');
 check(s.mails[0].to[0]==='primary@example.invalid'&&s.mails[1].to[0]==='secondary@example.invalid','separate recipients');
 check(s.mails.every(m=>!m.cc&&!m.bcc),'no cross-address disclosure');
 check(s.mails.every(m=>m.text.includes('/redefinir-senha#type=recovery&token_hash=')),'native one-use token in fragment');
 check(!(await r.text()).includes('token_hash'),'public result has no token');
 check(s.rpc[0].args.p_email==='secondary@example.invalid','normalized lookup');
 check(s.audits[0].detalhes.provider_accepted===2&&s.audits[0].detalhes.delivery_confirmed===false,'acceptance distinct from delivery');
 const known=await c.handle(req({action:'request',email:'secondary@example.invalid'}));s.found=false;
 const unknown=await c.handle(req({action:'request',email:'unknown@example.invalid'}));check(await known.text()===await unknown.text(),'no account enumeration');
}
for(const field of ['rate','found']){
 const {context:c,state:s}=setup();s[field]=false;const r=await c.handle(req({action:'request',email:'secondary@example.invalid'}));check(r.status===202&&s.mails.length===0,'no send when '+field+' denied');
}
{
 const {context:c,state:s}=setup();s.generateError=true;await c.handle(req({action:'request',email:'secondary@example.invalid'}));check(s.mails.length===0,'no mail with missing native recovery token');
}
{
 const {context:c,state:s}=setup();s.providerError=true;const r=await c.handle(req({action:'request',email:'secondary@example.invalid'}));check(r.status===202,'provider failure does not expose account');check(s.audits[0].detalhes.provider_accepted===0,'provider failure not marked as accepted');
}
{
 const {context:c,state:s}=setup();
 const result=await c.requestRecoveryConfirmation(c.db,{user:{id:'fixture-user'},admin:{papel:'secretario_geral'}},'email-fixture');
 check(result.provider_accepted===true&&result.delivery_confirmed===false,'verification acceptance not delivery');
 const link=s.mails[0].text.match(/https:\/\/[^\s]+/)[0];const token=new URL(link).hash.slice(7);
 check(/^[-_a-zA-Z0-9]{43}$/.test(token),'256-bit verification token');
 const issued=s.rpc.find(r=>r.name==='rod27_issue_recovery_confirmation');check(issued.args.p_hash===await c.digestRecovery(token),'only digest sent to database');
 check(!JSON.stringify(s.rpc).includes(token),'raw token not persisted');
 await assert.rejects(()=>c.requestRecoveryConfirmation(c.db,{user:{id:'other'},admin:{papel:'superadmin'}},'email-fixture'));checks++;
 s.confirm=false;let r=await c.handle(req({action:'confirm_secondary',token}));check(r.status===400,'invalid or consumed confirmation denied');
 s.confirm=true;r=await c.handle(req({action:'confirm_secondary',token}));check(r.status===200,'proof consumes via atomic RPC');
 r=await c.handle(req({action:'confirm_secondary',token:'invalid'}));check(r.status===400,'malformed token denied');
 r=await c.handle(new Request('https://test.invalid',{method:'GET'}));check(r.status===405,'GET cannot consume proof');
 r=await c.handle(req({action:'request',email:'x'.repeat(5000)}));check(r.status===400,'oversized request denied');
}
for(const file of ['secretaria.html','controle.html','redefinir-senha.html','confirmar-email.html']){
 const html=fs.readFileSync(new URL(file,root),'utf8');for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);check(true,file+' parses');
}
console.log(JSON.stringify({secondary_recovery_checks:checks,real_emails_sent:0,real_passwords_changed:0}));
