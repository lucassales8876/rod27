// Synthetic, short-lived Auth identity only. Never uses an existing person's credentials.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const key=process.env.ROD27_SERVICE_KEY;if(!key)throw Error('Service credential unavailable');delete process.env.ROD27_SERVICE_KEY;
const base='https://zrjxxcytgtjuuinhkfux.supabase.co';let id;
async function call(path,method='GET',body,token=key){
 const r=await fetch(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 const data=await r.json().catch(()=>({}));return{status:r.status,data};
}
try{
 const initial=randomUUID()+'aA!',next=randomUUID()+'aA!';const email='rod27-auth-test-'+randomUUID()+'@example.invalid';
 const created=await call('/auth/v1/admin/users','POST',{email,password:initial,email_confirm:true,app_metadata:{rod27_password_change_required:true,rod27_synthetic_test:true}});
 assert.equal(created.status,200,'synthetic Auth creation');id=created.data.id;assert.ok(id);
 const profile=await call('/rest/v1/usuarios_admin','POST',{user_id:id,papel:'revisor',ativo:true,nome_exibicao:'Teste técnico temporário'});assert.equal(profile.status,201,'synthetic role');
 const login=await call('/auth/v1/token?grant_type=password','POST',{email,password:initial});assert.equal(login.status,200,'synthetic sign-in');
 const token=login.data.access_token;
 const locked=await call('/functions/v1/rod27-admin','POST',{action:'bootstrap'},token);assert.equal(locked.status,428,'real Edge requires password change');
 const changed=await call('/functions/v1/rod27-admin','POST',{action:'change_required_password',password:next},token);assert.equal(changed.status,200,'real change: '+String(changed.data.error||'unspecified'));
 const revoked=await call('/functions/v1/rod27-admin','POST',{action:'bootstrap'},token);assert.equal(revoked.status,401,'old signed JWT is revoked');
 const relogin=await call('/auth/v1/token?grant_type=password','POST',{email,password:next});assert.equal(relogin.status,200,'new password works');
 const flag=await call('/auth/v1/admin/users/'+id);assert.equal(flag.data.app_metadata.rod27_password_change_required,false,'server flag cleared');
 const scope=await call('/functions/v1/rod27-admin','POST',{action:'bootstrap'},relogin.data.access_token);assert.equal(scope.status,403,'role/grant still enforced after password change');
 console.log('PASS live synthetic Auth: required change, new password, global logout, revoked JWT denial and access gate preserved.');
}finally{
 if(id){
  const profile=await call('/rest/v1/usuarios_admin?user_id=eq.'+id,'DELETE');assert.ok([200,204].includes(profile.status),'synthetic profile cleanup');
  const removed=await call('/auth/v1/admin/users/'+id,'DELETE');assert.equal(removed.status,200,'synthetic Auth cleanup');
  console.log('PASS synthetic identity removed; no evaluation or real account used.');
 }
}
