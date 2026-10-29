import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Accept transpiled sources so this runs without Deno or production secrets.
const admin=fs.readFileSync(process.argv[2],'utf8');
const control=fs.readFileSync(process.argv[3],'utf8');
let count=0;
const check=(condition,message)=>{assert.ok(condition,message);count++};
const actions=[...fs.readFileSync(path.join(root,'supabase/functions/rod27-admin/index.ts'),'utf8').matchAll(/case"([^"]+)"/g)].map(x=>x[1]);
for(const role of ['superadmin1','superadmin','secretario_geral','revisor']){
 for(const allowed of [false,true]){
  let operations=0;
  const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{papel:role,ativo:true}})})})})}),rpc:async()=>({data:allowed})};
  const context=vm.createContext({Response,Request,console,db,crypto:globalThis.crypto,Deno:{serve(){}}});
  vm.runInContext(admin.slice(admin.indexOf('const cors =')).replace(/Deno.serve\([\s\S]*$/,''),context);
  vm.runInContext('async function secretariaAllowed(db,id){const r=await db.rpc("rod27_secretaria_can_access",{p_actor:id});if(r.error)throw Error("authorization unavailable");return r.data===true}',context);
  // Every action must pass the common gate before its handler can run.
  if(!allowed)for(const action of actions){
   const result=await context.handle(new Request('https://test/admin',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({action})}));
   check(result.status===403,`${role} bypass: ${action}`);
  }
  if(allowed){
   vm.runInContext('async function bootstrap(){return {ok:true}}',context);
   const result=await context.handle(new Request('https://test/admin',{method:'POST',headers:{authorization:'Bearer test'},body:'{"action":"bootstrap"}'}));
   check(result.status===200,`${role} explicit grant`);
   if(role!=='secretario_geral'){
    const denied=await context.handle(new Request('https://test/admin',{method:'POST',headers:{authorization:'Bearer test'},body:'{"action":"secretaria_access_get"}'}));
    check(denied.status===400,`${role} cannot manage access`);
   }
  }
  db.rpc=async()=>({data:null,error:{code:'unavailable'}});
  const failClosed=await context.handle(new Request('https://test/admin',{method:'POST',headers:{authorization:'Bearer test'},body:'{"action":"bootstrap"}'}));
  check(failClosed.status!==200,'fail closed');
 }
}
for(const role of ['superadmin1','superadmin']){
 const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{papel:role,ativo:true}})})})})})};
 const context=vm.createContext({Response,Request,console,db,Deno:{serve(){}}});
 vm.runInContext(control.slice(control.indexOf('const cors =')).replace(/Deno.serve\([\s\S]*$/,''),context);
 const result=await context.handle(new Request('https://test/control',{method:'POST',headers:{authorization:'Bearer test'},body:'{"action":"show_coordinator_pin","setor":1}'}));
 check(result.status===403,'legacy PIN denied even to superadmin1');
 check(!(await result.text()).includes('"pin"'),'no PIN in denial');
}
for(const name of ['secretaria.html','controle.html']){
 const html=fs.readFileSync(path.join(root,name),'utf8');
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
 check(true,`${name} JS parses`);
}
const html=fs.readFileSync(path.join(root,'controle.html'),'utf8');
check(!html.includes('showCoordinatorPIN'),'no old PIN UI');
check(!html.includes('Contas e PINs'),'renamed accounts');
check(html.includes('delete window._latestPinInfo'),'PIN cleared on close');
// Exercise the real upload/list implementation on synthetic in-memory rows only.
{
 const rows=[],files=new Map();let inserts=0;
 const db={from(table){let filters={},payload=null;
  const q={select(){return q},eq(k,v){filters[k]=v;return q},order(){return q},limit(){return q},
   async maybeSingle(){return{data:rows.find(x=>Object.entries(filters).every(([k,v])=>x[k]===v))??null}},
   insert(x){payload=x;return q},async single(){
    if(rows.some(x=>x.avaliacao_id===payload.avaliacao_id&&x.sha256===payload.sha256))return{error:{code:'23505'}};
    const row={...payload,id:'synthetic-document-'+(++inserts)};rows.push(row);return{data:row};
   },then(resolve){resolve({data:rows.filter(x=>Object.entries(filters).every(([k,v])=>x[k]===v))})}};return q;
 },storage:{from(){return{async upload(p,b){files.set(p,b);return{}},async remove(ps){for(const p of ps)files.delete(p);return{}}}}}};
 const context=vm.createContext({Response,Request,console,db,crypto:globalThis.crypto,atob,Deno:{serve(){}}});
 vm.runInContext(admin.slice(admin.indexOf('const cors =')).replace(/Deno.serve\([\s\S]*$/,''),context);
 vm.runInContext('async function requireCurrentEval(id){return {id}};async function audit(){};async function encryptFile(bytes){return bytes}',context);
 const ctx={secretariaAllowed:true,user:{id:'synthetic-actor'},admin:{papel:'secretario_geral'}};
 const request={avaliacao_id:'synthetic-evaluation',nome:'synthetic.pdf',tipo_mime:'application/pdf',base64:Buffer.from('%PDF-1.7\nsynthetic-only\n%%EOF').toString('base64')};
 const [a,b]=await Promise.all([context.officeUploadDocument(ctx,request),context.officeUploadDocument(ctx,request)]);
 check(a.documento_id===b.documento_id,'concurrent duplicate returns same document');
 check(rows.length===1&&files.size===1,'duplicate leaves one row and one object');
 const c=await context.officeUploadDocument(ctx,request);
 check(c.duplicado===true&&rows.length===1,'sequential duplicate');
 const list=await context.officeDocuments(ctx,{avaliacao_id:'synthetic-evaluation'});
 check(list.documentos.length===1,'attachment list contains canonical document');
 await assert.rejects(()=>context.officeUploadDocument(ctx,{...request,tipo_mime:'image/png'}));count++;
 await assert.rejects(()=>context.officeUploadDocument({...ctx,secretariaAllowed:false},request));count++;
}
console.log(JSON.stringify({passed:count,actions:actions.length,real_accounts_used:0,pins_reset:0}));
