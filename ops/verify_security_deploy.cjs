const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const assert=require('node:assert/strict');
(async()=>{
 const assets={'/secretaria':'secretaria.html','/controle':'controle.html','/secretaria-acessos.js':'secretaria-acessos.js','/impressao-rod27.js':'impressao-rod27.js','/pdf-lib.min.js':'pdf-lib.min.js','/mapa-rodizio.js':'mapa-rodizio.js','/planejamento-rodizio.js':'planejamento-rodizio.js','/redefinir-senha':'redefinir-senha.html'};
 const hash=b=>createHash('sha256').update(b).digest('hex');
 for(const [url,file] of Object.entries(assets)){
  const r=await fetch('https://rod27-ieadern.pages.dev'+url,{signal:AbortSignal.timeout(20000)});
  assert.equal(r.status,200,url);
  const body=Buffer.from(await r.arrayBuffer());const code=execFileSync('git',['show','HEAD:'+file]);
  assert.equal(hash(body),hash(code),url+' differs from Git');
  console.log('PASS published HTTP 200 and Git SHA256 match:',url);
 }
 for(const [endpoint,action] of [['rod27-admin','bootstrap'],['rod27-admin','secretaria_access_get'],['rod27-admin','secretaria_access_set'],['rod27-admin','my_profile'],['rod27-admin','office_upload_document'],['rod27-admin','reset_coordinator_pin'],['rod27-control','show_coordinator_pin']]){
  for(const invalid of [false,true]){
   const headers={'Content-Type':'application/json'};if(invalid)headers.Authorization='Bearer invalid.synthetic.token';
   const r=await fetch('https://zrjxxcytgtjuuinhkfux.supabase.co/functions/v1/'+endpoint,{method:'POST',headers,body:JSON.stringify({action}),signal:AbortSignal.timeout(20000)});
   assert.ok([401,403].includes(r.status),endpoint+':'+action+':'+r.status);
   assert.ok(!(await r.text()).includes('"pin"'));
   console.log('PASS direct Edge denied',endpoint,action,invalid?'invalid JWT':'no session',r.status);
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1});
