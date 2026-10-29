// Explicit institutional authorization required. Values exist only in process memory.
import assert from 'node:assert/strict';
const key=process.env.ROD27_SERVICE_KEY,password=process.env.ROD27_TEMP_PASSWORD;
delete process.env.ROD27_SERVICE_KEY;delete process.env.ROD27_TEMP_PASSWORD;
if(!key||!password)throw Error('Required in-memory credentials unavailable');
const base='https://zrjxxcytgtjuuinhkfux.supabase.co';
async function call(path,method='GET',body,token=key){
 const r=await fetch(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 const data=await r.json().catch(()=>({}));return{status:r.status,data};
}
const roles=await call('/rest/v1/usuarios_admin?papel=eq.secretario_geral&ativo=eq.true&select=user_id');
assert.equal(roles.status,200);assert.equal(roles.data.length,1,'must identify exactly one secretary');
const id=roles.data[0].user_id;const before=await call('/auth/v1/admin/users/'+id);assert.equal(before.status,200);
const reset=await call('/auth/v1/admin/users/'+id,'PUT',{password,app_metadata:{...before.data.app_metadata,rod27_password_change_required:true}});
assert.equal(reset.status,200,'authorized reset');assert.ok(reset.data.email===before.data.email,'primary email preserved');
assert.equal(reset.data.app_metadata.rod27_password_change_required,true,'mandatory change set');
const login=await call('/auth/v1/token?grant_type=password','POST',{email:before.data.email,password});assert.equal(login.status,200,'temporary password works');
const token=login.data.access_token;
for(const action of ['bootstrap','secretaria_access_get','my_profile','reset_coordinator_pin']){
 const r=await call('/functions/v1/rod27-admin','POST',{action},token);assert.equal(r.status,428,'administrative lock: '+action);assert.equal(r.data.password_change_required,true);
}
const revoked=await call('/auth/v1/logout?scope=global','POST',{},token);assert.ok([200,204].includes(revoked.status),'global session revocation');
const denied=await call('/functions/v1/rod27-admin','POST',{action:'bootstrap'},token);assert.equal(denied.status,401,'revoked JWT denied');
const audit=await call('/rest/v1/auditoria_sistema','POST',{user_id:id,papel:'institutional_admin',acao:'authorized_temporary_password_reset',entidade:'usuarios_admin',entidade_id:id,detalhes:{mandatory_change:true,sessions_revoked:true,authorization:'explicit institutional authorization in chat'}});assert.equal(audit.status,201,'reset audit');
console.log(JSON.stringify({authorized_reset:true,temporary_login_verified:true,mandatory_change:true,administration_blocked:true,all_sessions_revoked:true,primary_preserved:true,pins_changed:0}));
