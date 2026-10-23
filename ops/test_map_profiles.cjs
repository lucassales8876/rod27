const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const escape=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const body={innerHTML:""};
const fixture={ok:true,ano:2026,somente_leitura:true,totais:{areas:1,setores:1,congregacoes:1,coordenadores:1,designacoes:1,conflitos:0},
 areas:[{codigo:"I",setores:[{numero:1,area:"I",coordenador:{nome:"Coordenação",rol:"1100"},
 congregacoes:[{id:"a4cf8fbc-7177-4b14-928e-c3e28d1479e9",nome:"Congregação Teste",codigo:13,
 dirigente:{nome:"Dirigente de Teste",rol:"2200",foto_url:"https://example.com/foto.jpg"},estado:"identificado",
 avaliacao:{id:"ff4d959f-687e-4b3c-9a70-faaad8483559",status:"enviada",ciclo:2027}}]}]}]};
const actions=[];
global.window={e:escape};
global.S={view:"map",access:"mock",mapData:null,mapBusy:false,mapError:null,mapExpanded:{},mapQuery:"",mapSelected:"root"};
global.document={getElementById:id=>id==="rod27-map-body"?body:null};
global.api=async (action,arg)=>{
 actions.push(action);
 if(action==="map_2026")return fixture;
 if(action==="office_lookup_obreiro")return{ok:true,obreiro:{rol:arg.rol,nome:"Dirigente completo",foto_url:"https://example.com/foto2.jpg"}};
 if(action==="office_documents")return{ok:true,documentos:[{id:"doc1",nome_original:"Arquivo.pdf",tipo_mime:"application/pdf",enviado_em:"2026-10-23T12:00:00Z"}]};
 if(action==="evaluation")return{ok:true,answers:[{titulo:"Pergunta real",resposta:"Resposta de teste!"}],classification:null};
 if(action==="office_document_url")return{ok:true,url:"https://example.com/signed.pdf"};
 throw Error("Unexpected action "+action);
};
vm.runInThisContext(fs.readFileSync("mapa-rodizio.js","utf8"));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 assert.match(window.mapMarkup(),/Esta tela é somente para visualização. Ainda não existe sincronização em tempo real./);
 assert.doesNotMatch(window.mapMarkup(),/Dirigentes: designações/);
 await window.mapFetch();
 window.mapExpandAll();
 assert.match(body.innerHTML,/foto.jpg/);
 window.mapPick("d:a4cf8fbc-7177-4b14-928e-c3e28d1479e9");
 await flush();await flush();
 assert.match(body.innerHTML,/rmap-focused/);
 assert.match(body.innerHTML,/Dirigente completo/);
 assert.match(body.innerHTML,/foto2.jpg/);
 assert.match(body.innerHTML,/Pergunta real/);
 assert.match(body.innerHTML,/Resposta de teste!/);
 assert.match(body.innerHTML,/Arquivo.pdf/);
 assert(actions.includes("office_documents"));
 await window.mapOpenDocument("doc1");
 assert.match(body.innerHTML,/<iframe/);
 assert.match(body.innerHTML,/signed.pdf/);
 assert.equal(actions.filter(x=>x==="office_document_url").length,1);
 window.mapClosePreview();
 assert.doesNotMatch(body.innerHTML,/signed.pdf/);
 window.mapPick("root");
 assert.doesNotMatch(body.innerHTML,/rmap-focused/);
 console.log("PASS: avisos, fotos, ficha expandida, respostas, documentos, PDF em painel, retorno à árvore");
})().catch(err=>{console.error(err);process.exitCode=1});
