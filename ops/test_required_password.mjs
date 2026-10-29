import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
const admin=fs.readFileSync(process.argv[2],'utf8'),control=fs.readFileSync(process.argv[3],'utf8');
const helper=fs.readFileSync(process.argv[4],'utf8').replace(/export\s*\{[\s\S]*$/,'');
const token='synthetic.'+Buffer.from(JSON.stringify({session_id:'00000000-0000-4000-8000-000000000001'})).toString('base64url')+'.synthetic';
const request=body=>new Request('https://test.invalid',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify(body)});
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++};
function setup(source,role){
 const state={active:true,failRevoke:false,updates:[],audit:0,user:{id:'synthetic-user',app_metadata:{rod27_password_change_required:true},user_metadata:{rod27_password_change_required:false}}};
 const db={auth:{getUser:async()=>({data:{user:state.user}}),admin:{
  async updateUserById(id,data){assert.equal(id,state.user.id);state.updates.push(data);if(data.app_metadata)state.user.app_metadata=data.app_metadata;return{}},
  async signOut(jwt,scope){assert.equal(scope,'global');if(state.failRevoke)return{error:{code:'test'}};state.active=false;return{}}
 }},rpc:async(name)=>({data:name==='rod27_admin_session_active'?state.active:true}),from(table){return{
  select(){return this},eq(){return this},async maybeSingle(){return{data:{papel:role,ativo:true}}},async insert(){state.audit++;return{}}
 }}};
 const ctx=vm.createContext({Response,Request,console,atob,Deno:{serve(){}},db});
 vm.runInContext(helper,ctx);vm.runInContext(source.slice(source.indexOf('const cors =')).replace(/Deno.serve\([\s\S]*$/,''),ctx);
 return{state,ctx};
}
for(const [source,role] of [[admin,'secretario_geral'],[control,'superadmin1']]){
 const {state,ctx}=setup(source,role);
 const actions=[...source.matchAll(/case\s*"([^"]+)"/g)].map(m=>m[1]);
 for(const action of actions){const r=await ctx.handle(request({action}));check(r.status===428,'pending password blocks '+action);check((await r.json()).password_change_required===true,'flag returned');}
 check(state.updates.length===0&&state.audit===0,'blocked requests have no side effects');
 state.active=false;const old=await ctx.handle(request({action:'bootstrap'}));check([401,403].includes(old.status),'revoked JWT denied');
}
{
 const {state,ctx}=setup(admin,'secretario_geral');
 let r=await ctx.handle(request({action:'change_required_password',password:'short'}));check(r.status===400,'weak password denied');check(state.updates.length===0,'no password mutation for weak input');
 const password=randomUUID()+'aA!';
 r=await ctx.handle(request({action:'change_required_password',password}));check(r.status===200,'strong password completes');
 const body=await r.text();check(!body.includes(password),'password not returned');check(state.active===false,'all sessions revoked');check(state.user.app_metadata.rod27_password_change_required===false,'lock removed after revoke');check(state.audit===1,'completion audited');
 const old=await ctx.handle(request({action:'bootstrap'}));check(old.status===401,'old JWT remains blocked after changing password');
}
{
 const {state,ctx}=setup(admin,'secretario_geral');state.failRevoke=true;
 const r=await ctx.handle(request({action:'change_required_password',password:randomUUID()+'aA!'}));
 check(r.status===400,'revoke failure reported');check(state.user.app_metadata.rod27_password_change_required===true,'revoke failure retains administrative lock');
}
{
 const {state,ctx}=setup(admin,'secretario_geral');state.user.app_metadata.rod27_password_change_required=false;
 const r=await ctx.handle(request({action:'change_own_password',user_id:'another-account',password:randomUUID()+'aA!'}));
 check(r.status===200,'optional own password change works without mandatory flag');
 check(state.active===false,'optional change revokes sessions');
 check(state.user.app_metadata.rod27_password_change_required===false,'optional change does not require future change');
 check(state.updates.length===1&&state.audit===1,'only authenticated account updated and audited');
}
console.log(JSON.stringify({required_password_checks:checks,real_credentials_used:0}));
