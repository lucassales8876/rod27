const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const encode=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pane={innerHTML:""};
const file={name:"Ficha impressa.pdf",type:"application/pdf",size:32,arrayBuffer:async()=>Uint8Array.from(Buffer.from("%PDF-1.4 fake coordinator test bytes")).buffer};
const actions=[];
global.window={e:encode};
global.S={view:"map",access:"session",mapData:null,mapBusy:false,mapError:null,mapExpanded:{},mapQuery:"",mapSelected:"root"};
global.document={getElementById:id=>id==="rod27-map-body"?pane:id==="rmap-coord-upload"?{files:[file]}:null};
global.btoa=s=>Buffer.from(s,"binary").toString("base64");
global.toast=()=>{};
const fixture={ok:true,ano:2026,somente_leitura:true,totais:{areas:1,setores:1,congregacoes:1,coordenadores:1,designacoes:1,conflitos:0},
 areas:[{codigo:"I",setores:[{numero:1,area:"I",coordenador:{id:"uuid",nome:"Coordenador Teste",rol:"1100",foto_url:"https://example.com/coord.jpg"},
 congregacoes:[{id:"church",nome:"Congregação 1",codigo:1,dirigente:{nome:"Coordenador Teste",rol:"1100",foto_url:"https://example.com/coord.jpg"},estado:"identificado"}]}]}]};
global.api=async (action,payload)=>{
 actions.push({action,payload});
 switch(action){
 case "map_2026":return fixture;
 case "coordinator_profile":return{ok:true,coordenador:{id:"uuid",nome:"Nome da ficha",rol:"1100",foto_url:"https://example.com/ficha.jpg",setor:1,area:"I"},
   manifestacao:{status:"enviada",deseja_permanecer:true,opcao_movimentacao:"mesma_congregacao",justificativa:"Permanecer no local",enviada_em:"2026-10-23T12:00:00Z"},
   documentos:[{id:"doc",nome_original:"Registro.pdf",tipo_mime:"application/pdf",enviado_em:"2026-10-23T12:00:00Z"}]};
 case "coordinator_document_url":return{ok:true,url:"https://example.com/doc_signed.pdf"};
 case "coordinator_document_upload":assert.equal(payload.rol,"1100");assert.equal(payload.setor,1);assert.equal(payload.nome,"Ficha impressa.pdf");assert(payload.base64.length>8);return{ok:true,documento_id:"id"};
 default:throw Error("Unexpected action "+action);
 }
};
vm.runInThisContext(fs.readFileSync("mapa-rodizio.js","utf8"));
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 await window.mapFetch();window.mapExpandAll();
 assert.match(pane.innerHTML,/coord.jpg/);
 window.mapPick("k:1");
 await tick();await tick();
 assert.match(pane.innerHTML,/rmap-focused/);
 assert.match(pane.innerHTML,/FICHA DO COORDENADOR/);
 assert.match(pane.innerHTML,/ficha.jpg/);
 assert.match(pane.innerHTML,/Manifestação de interesse/);
 assert.match(pane.innerHTML,/Permanecer no local/);
 assert.match(pane.innerHTML,/Registro.pdf/);
 assert.match(pane.innerHTML,/Anexar PDF ou formulário digitalizado/);
 await window.mapOpenCoordinatorDoc("doc");
 assert.match(pane.innerHTML,/doc_signed.pdf/);
 window.mapClosePreview();assert.doesNotMatch(pane.innerHTML,/doc_signed.pdf/);
 await window.mapUploadCoordinatorDoc();await tick();await tick();
 assert(actions.some(x=>x.action==="coordinator_document_upload"));
 assert.equal(actions.filter(x=>x.action==="coordinator_profile").length,2);
 window.mapPick("root");assert.doesNotMatch(pane.innerHTML,/rmap-focused/);
 console.log("PASS: foto do coordenador, manifestação, layout, documentos, PDF e upload simulados");
})().catch(err=>{console.error(err);process.exitCode=1});
