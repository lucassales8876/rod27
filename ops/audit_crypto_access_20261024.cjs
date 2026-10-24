const assert=require("node:assert/strict");
const host="https://zrjxxcytgtjuuinhkfux.supabase.co/functions/v1";
const jobs=[
 ["rod27-admin","bootstrap"],
 ["rod27-admin","evaluation"],
 ["rod27-admin","manifestations"],
 ["rod27-admin","export_detailed"],
 ["rod27-admin","office_document_url"],
 ["rod27-admin","office_upload_document"],
 ["rod27-admin","office_save_transcription"],
 ["rod27-admin","planning_move"],
 ["rod27-admin","planning_undo"],
 ["rod27-admin","coordinator_document_url"],
 ["rod27-coordinator","bootstrap"],
 ["rod27-coordinator","form"],
 ["rod27-coordinator","save_answer"],
 ["rod27-coordinator","submit"],
 ["rod27-coordinator","save_manifestation"],
 ["rod27-coordinator","submit_manifestation"],
];
(async()=>{
 for(const [fn,action] of jobs){
  const r=await fetch(host+"/"+fn,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,avaliacao_id:"00000000-0000-0000-0000-000000000000"})});
  assert.equal(r.status,401,fn+" "+action+" HTTP "+r.status);
  const data=await r.json();
  assert.notEqual(data.ok,true,"must reject "+fn+" "+action);
 }
 for(const path of ["/secretaria","/planejamento-rodizio.js","/mapa-rodizio.js"]){
  const r=await fetch("https://rod27-ieadern.pages.dev"+path);assert.equal(r.status,200,path);
 }
 const root=await fetch("https://rod27-ieadern.pages.dev/");
 assert.equal(root.status,404,"Cloudflare root should not expose listing");
 console.log("PASS "+jobs.length+" live unauthenticated API access denials + 3 public asset checks + root 404.");
})().catch(err=>{console.error(err);process.exitCode=1});
