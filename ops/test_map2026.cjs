const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const panel={innerHTML:""};
global.window={e:safe};
global.document={getElementById:id=>id==="rod27-map-body"?panel:null};
global.S={view:"map",access:"mock-token",mapData:null,mapBusy:false,mapError:null,
 mapExpanded:{},mapQuery:"",mapSelected:"root"};
global.api=async action=>{
 assert.equal(action,"map_2026");
 return {ok:true,ano:2026,somente_leitura:true,totais:{areas:1,setores:1,congregacoes:2,coordenadores:1,designacoes:2,conflitos:0},
 areas:[{codigo:"I",setores:[{numero:1,area:"I",coordenador:{nome:"Coordenador Teste",rol:"0100"},
 congregacoes:[{id:"uuid-a",nome:"Nova Congregação A",codigo:101,dirigente:{nome:"Dirigente Alfa",rol:"0200"},estado:"identificado"},
 {id:"uuid-b",nome:"Outra Congregação",codigo:102,dirigente:{nome:"Dirigente Beta",rol:"0300"},estado:"identificado"}]}]}]};
};
vm.runInThisContext(fs.readFileSync("mapa-rodizio.js","utf8"));
(async()=>{
 assert.match(window.mapMarkup(),/Estrutura cadastrada em 2026/);
 await window.mapFetch();
 assert.equal(S.mapData.ano,2026);
 assert.match(panel.innerHTML,/Área I/);
 assert.match(panel.innerHTML,/Setor 1/);
 window.mapExpandAll();
 assert.match(panel.innerHTML,/Dirigente Alfa/);
 assert.match(panel.innerHTML,/Dirigente Beta/);
 window.mapPick("d:uuid-a");
 assert.match(panel.innerHTML,/ROL/);
 assert.match(panel.innerHTML,/0200/);
 window.mapSearch("beta");
 assert.match(panel.innerHTML,/Dirigente Beta/);
 assert.doesNotMatch(panel.innerHTML,/Dirigente Alfa/);
 window.mapSearch("");
 window.mapCollapseAll();
 assert.doesNotMatch(panel.innerHTML,/Dirigente Beta/);
 assert.match(panel.innerHTML,/IEADERN/);
 console.log("PASS: loaded 2026, expand, collapse, filter, select, details");
})().catch(err=>{console.error(err);process.exit(1)});
