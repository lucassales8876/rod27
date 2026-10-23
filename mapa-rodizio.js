(function(){
"use strict";
const esc=v=>window.e(v);
function norm(v){return String(v==null?"":v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function key(kind,value){return kind+":"+String(value);}
function expanded(id){
 if(S.mapQuery.trim())return S.mapExpanded[id]!==false;
 return S.mapExpanded[id]===true;
}
function row(id,label,detail,kind,tag,children,canOpen){
 const active=S.mapSelected===id;
 const selected='<button type="button" class="rmap-select" aria-current="'+(active?"true":"false")+'" onclick="mapPick(&quot;'+esc(id)+'&quot;)"><span class="rmap-main">'+esc(label)+'</span>'+
 (detail?'<span class="rmap-sub">'+esc(detail)+'</span>':'')+'</button>';
 const right=canOpen?'<button type="button" class="rmap-arrow" aria-label="'+(expanded(id)?"Recolher":"Expandir")+' '+esc(label)+'" aria-expanded="'+expanded(id)+'" onclick="mapToggle(&quot;'+esc(id)+'&quot;)">'+(expanded(id)?"−":"+")+'</button>':'';
 return '<div class="rmap-item rmap-'+kind+'"><div class="rmap-line">'+selected+
 (tag?'<span class="rmap-pill">'+esc(tag)+'</span>':'')+right+'</div>'+
 (canOpen&&expanded(id)?'<div class="rmap-nest" role="group">'+(children||'<p class="rmap-note">Nenhum registro.</p>')+'</div>':'')+'</div>';
}
function churchMatches(c,q){
 return !q||[c.nome,c.codigo,c.dirigente?.nome,c.dirigente?.rol].some(z=>norm(z).includes(q));
}
function sectorMatches(s,q){
 return !q||[s.numero,"setor "+s.numero,s.coordenador?.nome,s.coordenador?.rol].some(z=>norm(z).includes(q))||
 s.congregacoes.some(c=>churchMatches(c,q));
}
function areaMatches(a,q){
 return !q||[a.codigo,"area "+a.codigo,"área "+a.codigo].some(z=>norm(z).includes(q));
}
function mapTree(){
 const d=S.mapData,q=norm(S.mapQuery),all=[];
 for(const area of d.areas||[]){
  const areaFull=areaMatches(area,q),visible=area.setores.filter(s=>areaFull||sectorMatches(s,q));
  if(!visible.length)continue;
  let sectors="";
  for(const sector of visible){
   const mainMatch=areaFull||!q||[sector.numero,"setor "+sector.numero,sector.coordenador?.nome,sector.coordenador?.rol].some(v=>norm(v).includes(q));
   const visibleChurches=mainMatch?sector.congregacoes:sector.congregacoes.filter(c=>churchMatches(c,q));
   let churches="";
   for(const church of visibleChurches){
    const label=church.estado==="conflito"?"Designação em conflito":church.dirigente?.nome||"Dirigente não informado";
    const person=church.dirigente?row(key("d",church.id),label,"ROL "+church.dirigente.rol,"person","","",false):
       row(key("d",church.id),label,"Verificar cadastro","person","Atenção","",false);
    const note=church.estado==="conflito"?" · dados divergentes":church.estado==="sem_designacao"?" · sem dirigente":"";
    churches+=row(key("c",church.id),church.nome,
     (church.codigo!=null?"Código "+church.codigo:"Congregação")+note,"church","",person,true);
   }
   let coordinator=row(key("k",sector.numero),
    sector.coordenador?.nome||"Coordenador não identificado",
    sector.coordenador?.rol?"ROL "+sector.coordenador.rol:"Dados não informados",
    "coord","",churches,true);
   sectors+=row(key("s",sector.numero),"Setor "+sector.numero,
    sector.congregacoes.length+" congregações","sector","",coordinator,true);
  }
  all.push(row(key("a",area.codigo),"Área "+area.codigo,
   area.setores.length+" setores","area",visible.length===area.setores.length?undefined:visible.length+" resultado(s)",sectors,true));
 }
 if(!all.length)return'<div class="rmap-banner">Nenhuma correspondência encontrada. Tente outro nome, ROL, congregação ou setor.</div>';
 return row("root","IEADERN","Estrutura ministerial cadastrada em 2026","root",d.totais.congregacoes+" congregações",all.join(""),true);
}
function matchSelection(){
 const d=S.mapData,id=S.mapSelected||"root";
 if(!d)return null;
 if(id==="root")return{type:"root",value:d};
 for(const area of d.areas||[]){
  if(id===key("a",area.codigo))return{type:"area",value:area};
  for(const sector of area.setores){
   if(id===key("s",sector.numero))return{type:"sector",value:sector};
   if(id===key("k",sector.numero))return{type:"coordinator",value:sector.coordenador,sector};
   for(const church of sector.congregacoes){
    if(id===key("c",church.id))return{type:"church",value:church,sector};
    if(id===key("d",church.id))return{type:"director",value:church.dirigente,church,sector};
   }
  }
 }
 return{type:"root",value:d};
}
function field(label,value){return'<div class="rmap-field"><span>'+esc(label)+'</span><strong>'+esc(value==null?"Não informado":value)+'</strong></div>';}
function details(){
 const obj=matchSelection();
 if(!obj)return'<div class="rmap-details">Selecione um item.</div>';
 const x=obj.value||{},s=obj.sector,c=obj.church;
 let name="",rows="",hint="";
 if(obj.type==="root"){
  name="Estrutura de 2026";
  rows=field("Áreas",x.totais.areas)+field("Setores",x.totais.setores)+field("Congregações ativas",x.totais.congregacoes)+
   field("Designações vigentes",x.totais.designacoes)+field("Coordenadores identificados",x.totais.coordenadores);
  hint="Abra uma área e selecione um setor, congregação ou dirigente para consultar seus dados.";
 }else if(obj.type==="area"){
  name="Área "+x.codigo;
  const churches=x.setores.reduce((n,sec)=>n+sec.congregacoes.length,0);
  rows=field("Setores",x.setores.length)+field("Congregações",churches);
 }else if(obj.type==="sector"){
  name="Setor "+x.numero;
  rows=field("Área",x.area)+field("Coordenador",x.coordenador?.nome)+field("ROL do coordenador",x.coordenador?.rol)+
   field("Congregações",x.congregacoes.length);
  hint="A coordenação é apresentada conforme o ano-base 2026 registrado no Rod27.";
 }else if(obj.type==="coordinator"){
  name=x.nome||"Coordenador não identificado";
  rows=field("Função","Coordenador")+field("ROL",x.rol)+field("Setor",s.numero)+field("Área",s.area)+field("Congregações do setor",s.congregacoes.length);
  hint="Fonte da coordenação: ano-base 2026 do cadastro do Rod27.";
 }else if(obj.type==="church"){
  name=x.nome;
  rows=field("Setor",x.setor)+field("Área",x.area)+field("Código",x.codigo)+field("Dirigente",x.dirigente?.nome)+
   field("ROL do dirigente",x.dirigente?.rol)+field("Situação",x.estado==="identificado"?"Designação identificada":x.estado==="conflito"?"Conflito de designação":"Sem designação");
 }else if(obj.type==="director"){
  name=x.nome||"Dirigente não informado";
  rows=field("Função","Dirigente")+field("ROL",x.rol)+field("Congregação",c.nome)+field("Setor",s.numero)+field("Área",s.area);
  hint=x.atualizado_em?"Atualização registrada: "+new Date(x.atualizado_em).toLocaleDateString("pt-BR"):"";
 }
 return'<aside class="rmap-details"><div class="ey" style="color:var(--gold)">DETALHES DO REGISTRO</div><h2>'+esc(name)+'</h2>'+rows+
 (hint?'<p class="rmap-note" style="margin-top:13px">'+esc(hint)+'</p>':'')+
 '<div class="rmap-banner" style="margin-top:16px">Consulta de 2026. Movimentações e planejamento de 2027 serão disponibilizados em uma etapa posterior.</div></aside>';
}
function mapContent(){
 if(S.mapBusy&&!S.mapData)return'<div class="rmap-tree">Carregando estrutura cadastrada...</div>';
 if(S.mapError&&!S.mapData)return'<div class="rmap-banner">'+esc(S.mapError)+'</div>';
 if(!S.mapData)return'<div class="rmap-tree"><p class="rmap-note">Use “Atualizar base” para carregar a estrutura.</p></div>';
 const t=S.mapData.totais;
 const stats='<div class="rmap-kpis"><span>'+esc(t.areas)+' áreas</span><span>'+esc(t.setores)+' setores</span><span>'+esc(t.congregacoes)+' congregações</span><span>'+esc(t.coordenadores)+' coordenadores cadastrados</span>'+
 (t.conflitos?'<span style="color:#a53d3d">'+esc(t.conflitos)+' conflitos</span>':'')+'</div>';
 return'<div style="margin-bottom:12px">'+stats+'</div>'+
 '<div class="rmap-work"><section class="rmap-tree" aria-label="Árvore do rodízio de 2026">'+mapTree()+'</section>'+details()+'</div>';
}
window.mapMarkup=function(){
 return'<main class="rmap"><div class="rmap-top"><div><h2>Estrutura cadastrada em 2026</h2><p class="rmap-note">Área → Setor → Coordenador → Congregação → Dirigente</p></div>'+
 '<button class="btn ghost small" type="button" onclick="mapFetch()">Atualizar base</button></div>'+
 '<div class="rmap-banner">Visualização somente para consulta. Dirigentes: designações vigentes de 2026; coordenadores: ano-base 2026 do Rod27. Ainda não existe sincronização em tempo real com o Propósito.</div>'+
 '<div class="rmap-toolbar"><input type="search" aria-label="Pesquisar estrutura do Rodízio" value="'+esc(S.mapQuery)+'" placeholder="Pesquisar pessoa, ROL, setor ou congregação" oninput="mapSearch(this.value)">'+
 '<button type="button" class="btn ghost small" onclick="mapExpandAll()">Expandir tudo</button>'+
 '<button type="button" class="btn ghost small" onclick="mapCollapseAll()">Recolher tudo</button></div>'+
 '<div id="rod27-map-body">'+mapContent()+'</div></main>';
};
function repaint(){
 if(S.view!=="map")return;
 const slot=document.getElementById("rod27-map-body");
 if(slot)slot.innerHTML=mapContent();
}
window.mapFetch=async function(){
 if(S.mapBusy)return;
 S.mapBusy=true;S.mapError=null;repaint();
 try{
  const data=await api("map_2026");
  if(data.ano!==2026||!Array.isArray(data.areas)||!data.somente_leitura)throw new Error("Base de 2026 inválida.");
  if(!S.access)return;
  S.mapData=data;S.mapExpanded={root:true};
  if(data.areas.length)S.mapExpanded[key("a",data.areas[0].codigo)]=true;
  S.mapSelected="root";
 }catch(err){S.mapError=err.message||"Não foi possível consultar a estrutura.";}
 finally{S.mapBusy=false;repaint();}
};
window.mapToggle=function(id){S.mapExpanded[id]=!expanded(id);repaint();};
window.mapPick=function(id){S.mapSelected=id;repaint();};
window.mapSearch=function(value){S.mapQuery=value;S.mapSelected="root";repaint();};
window.mapExpandAll=function(){
 if(!S.mapData)return;
 S.mapExpanded={root:true};
 for(const a of S.mapData.areas){
  S.mapExpanded[key("a",a.codigo)]=true;
  for(const s of a.setores){
   S.mapExpanded[key("s",s.numero)]=true;
   S.mapExpanded[key("k",s.numero)]=true;
   for(const c of s.congregacoes)S.mapExpanded[key("c",c.id)]=true;
  }
 }
 repaint();
};
window.mapCollapseAll=function(){S.mapExpanded={};repaint();};
})();
