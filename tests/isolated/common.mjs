import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const fixtures=dirname(fileURLToPath(import.meta.url));
export const repo=resolve(fixtures,'../..');
export const cwd=resolve(process.argv[2]||resolve(repo,'../rod27-isolated'));
assert.match(readFileSync(resolve(cwd,'supabase/config.toml'),'utf8'),/project_id\s*=\s*"rod27-isolated"/,'Exige ambiente fictício isolado');
export function command(name,args,input){const r=spawnSync(name,args,{cwd,input,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr.slice(-1500));return r.stdout.trim()}
export const status=JSON.parse(command('npm',['exec','--yes','--package=supabase@2.120.0','--','supabase','status','--output','json']));
assert.equal(status.API_URL,'http://127.0.0.1:55421','Apenas API local autorizada para testes');
export const sql=query=>command('docker',['exec','-i','supabase_db_rod27-isolated','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],query);
export const apply=path=>sql(readFileSync(path,'utf8'));
export async function post(path,body,headers={}){const r=await fetch(status.API_URL+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});return{status:r.status,data:await r.json().catch(()=>({}))}}
export async function authUser(email,password){await post('/auth/v1/admin/users',{email,password,email_confirm:true},{apikey:status.SERVICE_ROLE_KEY,Authorization:'Bearer '+status.SERVICE_ROLE_KEY});const r=await post('/auth/v1/token?grant_type=password',{email,password},{apikey:status.PUBLISHABLE_KEY});assert.equal(r.status,200);return r.data}
export const expect=(r,s,label)=>assert.equal(r.status,s,label+': '+(r.data.error||''));
