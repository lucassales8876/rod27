(function(){
"use strict";
// Planejamento de 2027 é uma proposta isolada. Nunca grava nas designações de 2026.
const h=v=>window.e(v);
const planState=()=>{if(!S.plan)S.plan={data:null,busy:false,error:null,selected:null,expanded:{root:true},query:"",findTerm:"",findResults:[],finding:false,findError:null,chosen:null,armed:null,saving:false};return S.plan;};
const id=(tipo,destino)=>tipo+":"+destino;
const entries=()=>new Map((planState().data?.slots||[]).map(x=>[id(x.tipo,x.destino_id),x]));
const findSlot=(tipo,destino)=>entries().get(id(tipo,destino));
const fmt=d=>{try{return d?new Date(d).toLocaleString("pt-BR"):"Não informado";}catch(_){return "Não informado";}};
const img=(url,nome)=>{
 let src="";try{const u=new URL(String(url||""));if(["https:","http:"].includes(u.protocol))src=u.href;}catch(_){}
 const initials=String(nome||"?").trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"?";
 return '<span class="rplan-avatar"><span>'+h(initials)+'</span>'+(src?'<img src="'+h(src)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true">':"")+'</span>';
};
const chosenSlot=()=>{const p=planState();return p.selected?entries().get(p.selected):null;};
function branch(k,label,sub,body,person,kind){
 const p=planState(),open=!!p.query.trim()||p.expanded[k]===true,active=p.selected===k;
 const isSlot=kind==="coordenador"||kind==="dirigente";
 const canDrag=isSlot&&person?.obreiro_rol;
 const tag=isSlot?'<span class="rmap-pill">'+(kind==="coordenador"?"Coordenador":"Dirigente")+'</span>':"";
 const personLine=isSlot?img(person?.foto_url_snapshot,person?.nome_snapshot)+"<span class='rplan-person'><strong>"+h(person?.nome_snapshot||"Vaga sem indicação")+"</strong><small>"+h(person?.obreiro_rol?"ROL "+person.obreiro_rol:"Sem ROL")+"</small></span>":'<span class="rplan-person"><strong>'+h(label)+'</strong><small>'+h(sub||"")+'</small></span>';
 const handler=isSlot?' ondragover="planAllowDrop(event,&quot;'+h(kind)+'&quot;)" ondrop="planDrop(event,&quot;'+h(kind)+'&quot;,&quot;'+h(person?.destino_id||'')+'&quot;)"':'';
 const grab=canDrag?'<button type="button" draggable="true" class="rplan-grab" aria-label="Arrastar '+h(person.nome_snapshot)+'" title="Arraste para outro destino ou clique para escolher destino" ondragstart="planDrag(event,&quot;'+h(kind)+'&quot;,&quot;'+h(person.obreiro_rol)+'&quot;)" onclick="planArm(&quot;'+h(kind)+'&quot;,&quot;'+h(person.obreiro_rol)+'&quot;)">⇅</button>':"";
 const button='<button class="rplan-entry'+(active?" rplan-active":"")+'" type="button"'+
  ''+
  (isSlot?' onclick="planPick(&quot;'+h(k)+'&quot;)"':' onclick="planToggle(&quot;'+h(k)+'&quot;)"')+
  '>'+personLine+tag+'</button>';
 return '<div class="rplan-node">'+
  '<div class="rplan-line"'+handler+'>'+grab+button+(body?'<button class="rmap-arrow" type="button" aria-label="'+(open?"Recolher ":"Expandir ")+h(label)+'" aria-expanded="'+open+'" onclick="planToggle(&quot;'+h(k)+'&quot;)">'+(open?"−":"+")+'</button>':"")+'</div>'+
  (body&&open?'<div class="rmap-nest">'+body+'</div>':"")+'</div>';
}
function tree(){
 const p=planState(),map=S.mapData,slots=entries(),q=String(p.query||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 if(!map)return'<p class="rmap-empty">Aguardando a estrutura de 2026 para desenhar os destinos de 2027.</p>';
 let areas="";
 for(const area of map.areas||[]){
  let sectors="";
  for(const sec of area.setores||[]){
   const co=slots.get(id("coordenador",sec.id));
   const churches=(sec.congregacoes||[]).filter(c=>!q||[c.nome,c.codigo,c.dirigente?.nome,slots.get(id("dirigente",c.id))?.nome_snapshot,slots.get(id("dirigente",c.id))?.obreiro_rol].some(v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(q)));
   const sectorMatch=[sec.numero,"setor "+sec.numero,co?.nome_snapshot,co?.obreiro_rol].some(v=>String(v||"").toLowerCase().includes(q));
   if(q&&!sectorMatch&&!churches.length)continue;
   const child=branch(id("coordenador",sec.id),"Coordenador",null,"",co,"coordenador")+
    (sectorMatch?sec.congregacoes:churches).map(c=>branch("church:"+c.id,c.nome,"Código "+(c.codigo||""),branch(id("dirigente",c.id),"Dirigente",null,"",slots.get(id("dirigente",c.id)),"dirigente"),null,"church")).join("");
   sectors+=branch("sector:"+sec.id,"Setor "+sec.numero,sec.congregacoes.length+" congregações",child,null,"sector");
  }
  if(sectors)areas+=branch("area:"+area.codigo,"Área "+area.codigo,area.setores.length+" setores",sectors,null,"area");
 }
 return areas?branch("root","IEADERN","Mapa proposto para 2027",areas,null,"root"):'<p class="rmap-empty">Nenhum resultado para a busca.</p>';
}
function detail(){
 const p=planState(),slot=chosenSlot();
 if(!slot)return'<aside class="rmap-details rplan-details"><div class="ey">PLANEJAMENTO · 2027</div><h2>Selecione um destino</h2><p class="rmap-note">Abra uma área, um setor e escolha o coordenador ou dirigente que deseja planejar. Arraste um obreiro para outra posição ou pesquise pelo ROL ou nome.</p><p class="rmap-empty">As mudanças ficam apenas no planejamento. A estrutura oficial de 2026 não é alterada.</p></aside>';
 const source=(p.data.slots||[]).find(x=>x.tipo===slot.tipo&&x.obreiro_rol===p.chosen?.rol);
 const chosen=p.chosen;
 const body='<div class="rmap-profilehead">'+img(slot.foto_url_snapshot,slot.nome_snapshot)+
  '<div><div class="ey">DESTINO SELECIONADO</div><h2>'+h(slot.nome_snapshot||"Vaga sem indicação")+'</h2><p class="rmap-note">'+h(slot.obreiro_rol?"ROL "+slot.obreiro_rol:"Vaga sem obreiro")+'</p></div></div>'+
  '<div class="rmap-profile-grid"><div class="rmap-field"><span>Função planejada</span><strong>'+h(slot.tipo==="coordenador"?"Coordenador de setor":"Dirigente de congregação")+'</strong></div>'+
  '<div class="rmap-field"><span>Situação</span><strong>Proposta 2027 · Revisão '+h(p.data.planejamento.revisao)+'</strong></div></div>'+
  (slot.obreiro_rol?'<div class="rmap-panel-actions"><button class="btn ghost small" type="button" onclick="planArm(&quot;'+h(slot.tipo)+'&quot;,&quot;'+h(slot.obreiro_rol)+'&quot;)">Mover este obreiro para outro destino</button></div>':'')+
  (p.armed?'<div class="rmap-banner">Movimentação selecionada: ROL '+h(p.armed.rol)+' · '+h(p.armed.tipo)+'. Clique no destino desejado, ou cancele. <button class="btn ghost small" type="button" onclick="planCancelArm()">Cancelar</button></div>':'')+
  '<section class="rmap-panel-section"><h3>Selecionar obreiro para esta posição</h3><p class="rmap-note">Pesquise pelo nome ou ROL. Uma pessoa que já ocupe outra posição da mesma função será trocada automaticamente com o ocupante atual.</p>'+
  '<div class="rplan-search"><input id="rplan-find" type="search" aria-label="Buscar obreiro por nome ou ROL" placeholder="Nome ou ROL (mínimo 2 caracteres)" value="'+h(p.findTerm)+'" oninput="planFindTerm(this.value)" onkeydown="if(event.key===&quot;Enter&quot;){event.preventDefault();planFind()}">'+
  '<button class="btn ghost small" type="button" onclick="planFind()" '+(p.finding?"disabled":"")+'>Buscar</button></div>'+
  (p.finding?'<p class="rmap-note">Consultando fichário...</p>':"")+
  (p.findError?'<p class="rmap-empty" role="alert">'+h(p.findError)+'</p>':"")+
  '<div class="rplan-results">'+p.findResults.map(x=>'<button class="rplan-result'+(chosen?.rol===x.rol?" selected":"")+'" type="button" onclick="planChoose(&quot;'+h(x.rol)+'&quot;)">'+img(x.foto_url,x.nome)+'<span><strong>'+h(x.nome)+'</strong><small>ROL '+h(x.rol)+'</small></span></button>').join("")+'</div>'+
  (chosen?'<div class="rplan-chosen"><strong>Selecionado: '+h(chosen.nome)+' · ROL '+h(chosen.rol)+'</strong>'+
   (source?'<p class="rmap-note">Já consta em outra posição do planejamento. Será realizada uma troca.</p>':
    slot.obreiro_rol?'<p class="rmap-note">A pessoa atual deixará esta posição no planejamento.</p>':'')+
   '<button class="btn primary" type="button" onclick="planConfirmMove()" '+(p.saving?"disabled":"")+'>Confirmar alteração</button></div>':"")+
  '</section></aside>';
 return '<aside class="rmap-details rplan-details">'+body+'</aside>';
}
function history(){
 const p=planState(),ev=p.data?.historico||[];
 return '<section class="rplan-history"><div class="rmap-section-title"><h3>Histórico de alterações</h3><span class="rmap-pill">Últimas '+ev.length+' revisões</span></div>'+
 (ev.length?ev.slice(0,12).map(x=>'<div class="rplan-event"><strong>Revisão '+h(x.revisao)+' · '+h(x.acao==="desfazer"?"Desfazer":"Movimentação")+'</strong><span>'+h(x.tipo==="coordenador"?"Coordenador":"Dirigente")+' · '+h(x.autor_nome||"Secretaria")+' · '+h(fmt(x.criado_em))+'</span></div>').join(""):'<p class="rmap-note">Nenhuma alteração realizada. O mapa ainda reflete a base de 2026.</p>')+
 '</section>';
}
function markup(){
 const p=planState(),ready=!!p.data&&!!S.mapData,rev=p.data?.planejamento?.revisao??0;
 return '<main class="rmap rplan">'+window.rodizioYearPicker()+
 '<div class="rmap-top"><div><h2>Mapa de planejamento · 2027</h2><p class="rmap-note">Áreas → Setores → Coordenadores → Congregações → Dirigentes</p></div>'+
 '<button class="btn ghost small" type="button" onclick="planningFetch(true)" '+(p.busy?"disabled":"")+'>Atualizar planejamento</button></div>'+
 '<div class="rmap-banner">Planejamento provisório de 2027. Alterações não modificam o Rodízio vigente de 2026, avaliações, credenciais ou designações oficiais.</div>'+
 (p.error?'<p class="rmap-empty" role="alert">'+h(p.error)+'</p>':"")+
 (!ready?'<p class="rmap-empty">'+(p.busy?"Carregando estrutura e posições do planejamento...":"Planejamento indisponível. Tente atualizar.")+'</p>':
 '<div class="rmap-kpis rplan-kpis"><span>253 congregações previstas</span><span>42 setores</span><span>Revisão '+h(rev)+'</span><span>Somente proposta</span></div>'+
 '<div class="rmap-toolbar"><input type="search" aria-label="Filtrar mapa planejado" placeholder="Buscar setor, congregação ou obreiro" value="'+h(p.query)+'" oninput="planQuery(this.value)">'+
 '<button class="btn ghost small" type="button" onclick="planExpandAll()">Expandir tudo</button>'+
 '<button class="btn ghost small" type="button" onclick="planCollapseAll()">Recolher tudo</button>'+
 '<button class="btn ghost small" type="button" onclick="planUndo()" '+(rev<1||p.saving?"disabled":"")+'>Desfazer última alteração</button></div>'+
 '<div id="rod27-plan-body"><div class="rmap-work rmap-focused"><section class="rmap-tree rplan-tree" aria-label="Árvore de planejamento 2027">'+tree()+'</section>'+detail()+'</div>'+history()+'</div>')+
 '</main>';
}
function repaint(){
 if(S.view!=="map"||S.mapYear!=="2027")return;
 const node=document.getElementById("rod27-plan-body");
 if(!node){render();return;}
 const old=node.querySelector(".rplan-tree"),scroll=old?old.scrollTop:0;
 node.innerHTML='<div class="rmap-work rmap-focused"><section class="rmap-tree rplan-tree" aria-label="Árvore de planejamento 2027">'+tree()+'</section>'+detail()+'</div>'+history();
 const next=node.querySelector(".rplan-tree");if(next)next.scrollTop=scroll;
}
window.planningMarkup=markup;
window.planningFetch=async function(force){
 const p=planState();if(p.busy)return;
 if(p.data&&!force&&S.mapData){repaint();return;}
 p.busy=true;p.error=null;if(S.view==="map"&&S.mapYear==="2027")render();
 try{
  const results=await Promise.all([api("planning_snapshot"),S.mapData?Promise.resolve(S.mapData):api("map_2026")]);
  if(!results[0]?.ok||results[0].ano!==2027||!Array.isArray(results[0].slots)||!results[0].somente_proposta)throw new Error("Planejamento inválido.");
  if(!results[1]?.somente_leitura||results[1].ano!==2026)throw new Error("Estrutura de referência inválida.");
  if(!S.access)return;
  p.data=results[0];S.mapData=results[1];
  if(!p.selected||!entries().has(p.selected))p.selected=null;
  p.chosen=null;p.findResults=[];p.findError=null;
  if(!Object.keys(p.expanded).length)p.expanded={root:true};
 }catch(err){p.error=err.message||"Falha ao consultar o planejamento.";}
 finally{p.busy=false;if(S.view==="map"&&S.mapYear==="2027")render();}
};
window.planArm=function(tipo,rol){
 const p=planState();p.armed={tipo,rol};toast("Selecione o destino no mapa.");repaint();
};
window.planCancelArm=function(){planState().armed=null;repaint();};
window.planPick=function(k){
 const p=planState(),slot=entries().get(k);if(!slot)return;
 p.selected=k;p.chosen=null;p.findResults=[];p.findError=null;p.findTerm="";
 const armed=p.armed;
 if(armed&&armed.tipo===slot.tipo){
  p.armed=null;repaint();move(armed.rol);return;
 }
 repaint();
};
window.planToggle=function(k){const p=planState();p.expanded[k]=!p.expanded[k];repaint();};
window.planQuery=function(q){planState().query=q;repaint();};
window.planExpandAll=function(){
 const p=planState();p.expanded={root:true};
 for(const a of S.mapData?.areas||[]){p.expanded["area:"+a.codigo]=true;for(const s of a.setores){p.expanded["sector:"+s.id]=true;for(const c of s.congregacoes)p.expanded["church:"+c.id]=true;}}
 repaint();
};
window.planCollapseAll=function(){planState().expanded={root:true};repaint();};
window.planFindTerm=function(v){const p=planState();p.findTerm=v;p.chosen=null;};
window.planFind=async function(){
 const p=planState(),q=p.findTerm.trim();if(p.finding)return;
 if(q.length<2){p.findError="Informe pelo menos dois caracteres.";repaint();return;}
 p.finding=true;p.findError=null;p.findResults=[];p.chosen=null;repaint();
 try{const data=await api("planning_find",{busca:q});if(p.findTerm.trim()!==q)return;p.findResults=data.pessoas||[];if(!p.findResults.length)p.findError="Nenhum obreiro encontrado.";}
 catch(err){p.findError=err.message||"Falha na pesquisa.";}
 finally{p.finding=false;repaint();}
};
window.planChoose=function(rol){
 const p=planState();const person=p.findResults.find(x=>String(x.rol)===String(rol));
 if(!person)return;p.chosen=person;repaint();
};
async function move(rol){
 const p=planState(),slot=chosenSlot();if(!slot||p.saving||!p.data)return;
 const person=String(rol||"").trim();if(!/^[0-9]{1,12}$/.test(person)){toast("ROL inválido.");return;}
 if(person===slot.obreiro_rol){toast("Este obreiro já ocupa a posição.");return;}
 const other=p.data.slots.find(x=>x.tipo===slot.tipo&&x.obreiro_rol===person);
 const message=other?"Confirmar troca no planejamento de 2027? As duas posições trocarão seus ocupantes.":"Confirmar indicação no planejamento de 2027? O ocupante atual deste destino será substituído na proposta.";
 if(!window.confirm(message+" Nenhuma designação oficial de 2026 será alterada."))return;
 p.saving=true;repaint();
 try{
  await api("planning_move",{destino_id:slot.id,tipo:slot.tipo,rol:person,revisao:p.data.planejamento.revisao});
  toast("Planejamento atualizado.");p.chosen=null;
  await window.planningFetch(true);
 }catch(err){toast(err.message||"Não foi possível salvar.");p.error=err.message||"Erro ao salvar. Atualize o planejamento.";if(S.view==="map"&&S.mapYear==="2027")render();}
 finally{p.saving=false;repaint();}
}
window.planConfirmMove=function(){const p=planState();if(p.chosen)move(p.chosen.rol);};
window.planUndo=async function(){
 const p=planState(),rev=p.data?.planejamento?.revisao;
 if(p.saving||!Number.isInteger(rev)||rev<1)return;
 if(!window.confirm("Desfazer a última alteração do planejamento 2027? A operação será registrada no histórico."))return;
 p.saving=true;repaint();
 try{await api("planning_undo",{revisao:rev});toast("Última alteração desfeita.");await window.planningFetch(true);}
 catch(err){toast(err.message||"Não foi possível desfazer.");p.error=err.message||"Erro ao desfazer. Atualize o planejamento.";if(S.view==="map"&&S.mapYear==="2027")render();}
 finally{p.saving=false;repaint();}
};
window.planDrag=function(ev,tipo,rol){
 if(!ev.dataTransfer)return;ev.dataTransfer.effectAllowed="move";
 ev.dataTransfer.setData("text/plain",JSON.stringify({rod27:true,tipo,rol}));
};
window.planAllowDrop=function(ev,tipo){if(["coordenador","dirigente"].includes(tipo)){ev.preventDefault();if(ev.dataTransfer)ev.dataTransfer.dropEffect="move";}};
window.planDrop=function(ev,tipo,destino){
 ev.preventDefault();ev.stopPropagation?.();
 let payload;try{payload=JSON.parse(ev.dataTransfer.getData("text/plain"));}catch(_){return;}
 if(!payload?.rod27||payload.tipo!==tipo||!/^[0-9]{1,12}$/.test(String(payload.rol||"")))return;
 const slot=findSlot(tipo,destino);if(!slot)return;
 const p=planState();p.selected=id(tipo,destino);p.chosen=null;p.armed=null;repaint();move(payload.rol);
};
})();
