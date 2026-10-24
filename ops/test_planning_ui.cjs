const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const h=v=>String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const original={ano:2026,somente_leitura:true,areas:[{codigo:"I",setores:[{id:"sector-uuid",numero:1,area:"I",congregacoes:[{id:"church-uuid",nome:"Congregação Teste",codigo:"100",dirigente:{rol:"101",nome:"Pessoa Um"}}]}]}]};
const baseline=JSON.stringify(original);
let plan={ok:true,ano:2027,somente_proposta:true,planejamento:{revisao:0},historico:[],slots:[
{id:"slot-1",tipo:"dirigente",destino_id:"church-uuid",obreiro_rol:"101",nome_snapshot:"Pessoa Um",foto_url_snapshot:"https://example.com/1.jpg"},
{id:"slot-2",tipo:"coordenador",destino_id:"sector-uuid",obreiro_rol:"201",nome_snapshot:"Coordenador",foto_url_snapshot:"https://example.com/2.jpg"}
]};
const calls=[],notices=[],app={innerHTML:""};
global.S={access:"session",view:"map",mapYear:"2027",mapData:original,plan:null};
global.window={e:h,confirm:()=>true,rodizioYearPicker:()=>'<nav>2026 | 2027</nav>'};
global.document={getElementById:()=>null};
global.toast=m=>notices.push(m);
global.render=()=>{app.innerHTML=window.planningMarkup();};
global.api=async (action,payload)=>{
 calls.push({action,payload});
 if(action==="planning_snapshot")return JSON.parse(JSON.stringify(plan));
 if(action==="planning_find")return{ok:true,pessoas:[{rol:"102",nome:"Pessoa Dois",foto_url:"https://example.com/3.jpg"},{rol:"201",nome:"Coordenador"}]};
 if(action==="planning_move"){
  assert.equal(payload.tipo,"dirigente");assert.equal(payload.destino_id,"slot-1");
  assert.equal(payload.rol,"102");assert.equal(payload.revisao,plan.planejamento.revisao);
  plan.slots[0].obreiro_rol="102";plan.slots[0].nome_snapshot="Pessoa Dois";plan.planejamento.revisao++;
  plan.historico.unshift({revisao:plan.planejamento.revisao,acao:"movimentar",tipo:"dirigente",autor_nome:"Secretaria"});
  return{ok:true,revisao:plan.planejamento.revisao};
 }
 if(action==="planning_undo"){
  assert.equal(payload.revisao,plan.planejamento.revisao);
  plan.slots[0].obreiro_rol="101";plan.slots[0].nome_snapshot="Pessoa Um";plan.planejamento.revisao++;
  plan.historico.unshift({revisao:plan.planejamento.revisao,acao:"desfazer",tipo:"dirigente",autor_nome:"Secretaria"});
  return{ok:true,revisao:plan.planejamento.revisao};
 }
 throw Error("Ação inesperada: "+action);
};
vm.runInThisContext(fs.readFileSync("planejamento-rodizio.js","utf8"));
(async()=>{
 await window.planningFetch(true);
 assert.match(app.innerHTML,/Planejamento provisório de 2027/);
 assert.match(app.innerHTML,/Área I/);
 window.planExpandAll();
 assert.match(app.innerHTML,/Pessoa Um/);
 assert.match(app.innerHTML,/Coordenador/);
 assert.match(app.innerHTML,/ondrop="planDrop\(event,&quot;dirigente&quot;,&quot;church-uuid&quot;\)"/);
 window.planPick("dirigente:church-uuid");
 assert.match(app.innerHTML,/Selecionar obreiro/);
 window.planFindTerm("Pessoa");
 await window.planFind();
 assert.match(app.innerHTML,/Pessoa Dois/);
 window.planChoose("102");
 assert.match(app.innerHTML,/Confirmar alteração/);
 await window.planConfirmMove();
 await new Promise(r=>setImmediate(r));
 assert.equal(plan.planejamento.revisao,1);
 assert.equal(plan.slots[0].obreiro_rol,"102");
 assert.match(app.innerHTML,/Revisão 1/);
 await window.planUndo();
 assert.equal(plan.planejamento.revisao,2);
 assert.equal(plan.slots[0].obreiro_rol,"101");
 assert.equal(JSON.stringify(original),baseline,"Base 2026 deve ficar imutável");
 assert(!calls.some(x=>/office_replace|office_change|save_classification|evaluation/.test(x.action)));
 window.planDrop({preventDefault(){},dataTransfer:{getData:()=>JSON.stringify({rod27:true,tipo:"coordenador",rol:"201"})}},"dirigente","church-uuid");
 assert.equal(plan.planejamento.revisao,2,"Drag de outro tipo não deve alterar planejamento");
 console.log("PASS: alternância visual 2027, árvore, fotos, pesquisa, confirmação, revisão, desfazer, drag por tipo e isolamento 2026");
})().catch(e=>{console.error(e);process.exitCode=1;});
