(function(){
"use strict";
const esc=v=>window.e(v);
const profileCache=new Map();
let fetchVersion=0;
function safeUrl(value){
 try{
  const url=new URL(String(value||""));
  return (url.protocol==="https:"||url.protocol==="http:")?url.href:"";
 }catch(_){return "";}
}
function photo(url,name,large){
 const src=safeUrl(url);
 const words=String(name||"").trim().split(/\s+/).filter(Boolean);
 const letters=(words.length>1?words[0][0]+words[words.length-1][0]:(words[0]||"P")[0]).toUpperCase();
 return '<span class="rmap-avatar'+(large?' rmap-avatar-large':'')+'"><span aria-hidden="true">'+esc(letters)+'</span>'+
 (src?'<img src="'+esc(src)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true">':'')+'</span>';
}
function norm(v){return String(v==null?"":v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();}
function key(kind,value){return kind+":"+String(value);}
function expanded(id){
 if(S.mapQuery.trim())return S.mapExpanded[id]!==false;
 return S.mapExpanded[id]===true;
}
function row(id,label,detail,kind,tag,children,canOpen,photoUrl){
 const active=S.mapSelected===id;
 const selected='<button type="button" class="rmap-select" aria-current="'+(active?"true":"false")+'" onclick="mapPick(&quot;'+esc(id)+'&quot;)"><span class="rmap-label">'+(kind==="person"?photo(photoUrl,label,false):"")+'<span><span class="rmap-main">'+esc(label)+'</span>'+
 (detail?'<span class="rmap-sub">'+esc(detail)+'</span>':'')+'</span></span></button>';
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
    const person=church.dirigente?row(key("d",church.id),label,"ROL "+church.dirigente.rol,"person","","",false,church.dirigente.foto_url):
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
function directorPanel(x,church,sector){
 const id=S.mapSelected;
 const state=profileCache.get(id);
 const actual=state?.profile?.obreiro||{};
 const photoSrc=actual.foto_url||x.foto_url;
 let html='<div class="rmap-profilehead">'+photo(photoSrc,actual.nome||x.nome,true)+
 '<div><div class="ey" style="color:var(--gold)">FICHA DO DIRIGENTE</div><h2>'+esc(actual.nome||x.nome||"Dirigente não identificado")+'</h2>'+
 '<div class="rmap-note">ROL '+esc(x.rol||"Não informado")+'</div>'+
 '<span class="rmap-pill">Designação vigente · 2026</span></div></div>'+
 '<div class="rmap-profile-grid">'+field("Cargo","Dirigente")+field("Congregação",church.nome)+
 field("Setor",sector.numero)+field("Área",sector.area)+field("Coordenador",sector.coordenador?.nome)+
 field("Código da congregação",church.codigo)+'</div>';
 const ev=church.avaliacao;
 html+='<section class="rmap-panel-section"><div class="rmap-section-title"><h3>Avaliação referente ao Rodízio 2027</h3>'+
 (ev?'<span class="rmap-pill">'+esc(statusLabel(ev.status))+'</span>':'')+'</div>';
 if(church.avaliacao_ambigua){
  html+='<p class="rmap-note">Foram encontradas referências conflitantes para esta congregação e ROL. A avaliação não será exibida até a conferência.</p>';
 }else if(!ev){
  html+='<p class="rmap-empty">Não há ficha de avaliação vinculada a este dirigente e congregação.</p>';
 }else if(ev.status!=="enviada"){
  html+='<p class="rmap-empty">Aguardando avaliação do coordenador. Situação: '+esc(statusLabel(ev.status))+'.</p>';
 }else if(state?.loading){
  html+='<p class="rmap-empty">Consultando respostas registradas...</p>';
 }else if(state?.evaluation?.ok){
  const answers=state.evaluation.answers||[];
  html+=(answers.length?answers.map((item,i)=>
   '<article class="rmap-answer"><span class="rmap-answer-num">'+(i+1)+'</span><div><strong>'+esc(item.titulo||"Pergunta")+'</strong><p>'+esc(item.resposta||"Sem resposta")+'</p></div></article>').join(""):'<p class="rmap-empty">Não há respostas registradas.</p>');
  const classified=state.evaluation.classification;
  if(classified?.resumo_analitico)html+='<div class="rmap-review"><strong>Resumo da análise administrativa</strong><p>'+esc(classified.resumo_analitico)+'</p></div>';
 }else if(state?.errors?.evaluation){
  html+='<p class="rmap-empty">Não foi possível carregar a avaliação. '+esc(state.errors.evaluation)+'</p>';
 }else{
  html+='<p class="rmap-empty">Carregando avaliação...</p>';
 }
 html+='</section><section class="rmap-panel-section"><div class="rmap-section-title"><h3>PDFs e documentos anexados</h3></div>';
 if(!ev||church.avaliacao_ambigua){
  html+='<p class="rmap-empty">Nenhuma ficha de avaliação correspondente para consultar documentos.</p>';
 }else if(state?.loading){
  html+='<p class="rmap-empty">Verificando arquivos...</p>';
 }else if(state?.errors?.documents){
  html+='<p class="rmap-empty">Não foi possível consultar os anexos. '+esc(state.errors.documents)+'</p>';
 }else{
  const docs=state?.documents?.documentos||[];
  html+=docs.length?docs.map(doc=>
   '<div class="rmap-document"><div><strong>'+esc(doc.nome_original)+'</strong>'+
   '<span class="rmap-sub">'+esc(doc.tipo_mime||"Documento")+' · '+esc(doc.enviado_em?new Date(doc.enviado_em).toLocaleDateString("pt-BR"):"Data não informada")+'</span></div>'+
   '<button type="button" class="btn ghost small" onclick="mapOpenDocument(&quot;'+esc(doc.id)+'&quot;)">Visualizar</button></div>').join(""):
   '<p class="rmap-empty">Nenhum PDF ou documento anexado à avaliação.</p>';
 }
 if(state?.preview){
  const url=safeUrl(state.preview.url);
  if(url)html+='<div class="rmap-document-preview"><div class="rmap-section-title"><strong>'+esc(state.preview.name||"Documento")+'</strong>'+
   '<button type="button" class="btn ghost small" onclick="mapClosePreview()">Fechar visualização</button></div>'+
   (state.preview.mime==="application/pdf"?'<iframe title="Documento PDF" src="'+esc(url)+'" loading="lazy" referrerpolicy="no-referrer"></iframe>':
    state.preview.mime?.startsWith("image/")?'<img src="'+esc(url)+'" alt="Documento anexado">':'')+
   '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" class="rmap-sub">Abrir documento em outra aba</a>'+
   '<p class="rmap-note">Link temporário válido por cinco minutos. A consulta é registrada na auditoria.</p></div>';
 }
 html+='</section>';
 if(ev&&!state?.loading){
  html+='<div class="rmap-panel-actions"><button class="btn ghost small" type="button" onclick="mapReloadProfile()">Atualizar ficha e documentos</button>'+
   (ev.status==="enviada"?'<button class="btn primary small" type="button" onclick="exportDetailed(&quot;evaluation&quot;,&quot;'+esc(ev.id)+'&quot;)">Exportar avaliação</button>':'')+'</div>';
 }
 if(state?.errors?.profile)html+='<p class="rmap-note">Dados adicionais do fichário indisponíveis no momento.</p>';
 return html;
}
function statusLabel(value){
 return ({enviada:"Enviada",em_preenchimento:"Em preenchimento",nao_iniciada:"Não iniciada"})[value]||"Não informada";
}
function details(){
 const obj=matchSelection();
 if(!obj)return'<aside class="rmap-details">Selecione um item.</aside>';
 const x=obj.value||{},sector=obj.sector,church=obj.church;
 if(obj.type==="director"){
  return '<aside class="rmap-details rmap-details-expanded">'+
    directorPanel(x,church,sector)+'</aside>';
 }
 let name="",rows="",hint="",actions="";
 if(obj.type==="root"){
  name="Estrutura de 2026";
  rows=field("Áreas",x.totais.areas)+field("Setores",x.totais.setores)+
   field("Congregações ativas",x.totais.congregacoes)+field("Designações vigentes",x.totais.designacoes)+
   field("Coordenadores identificados",x.totais.coordenadores);
  hint="Abra uma área e selecione um setor, congregação ou dirigente.";
 }else if(obj.type==="area"){
  name="Área "+x.codigo;
  const churches=x.setores.reduce((n,sec)=>n+sec.congregacoes.length,0);
  rows=field("Setores",x.setores.length)+field("Congregações",churches);
 }else if(obj.type==="sector"){
  name="Setor "+x.numero;
  rows=field("Área",x.area)+field("Coordenador",x.coordenador?.nome)+
   field("ROL do coordenador",x.coordenador?.rol)+field("Congregações",x.congregacoes.length);
 }else if(obj.type==="coordinator"){
  name=x.nome||"Coordenador não identificado";
  rows=field("Função","Coordenador")+field("ROL",x.rol)+
   field("Setor",sector.numero)+field("Área",sector.area)+field("Congregações do setor",sector.congregacoes.length);
 }else if(obj.type==="church"){
  name=x.nome;
  rows=field("Setor",x.setor)+field("Área",x.area)+field("Código",x.codigo)+
   field("Dirigente",x.dirigente?.nome)+field("ROL do dirigente",x.dirigente?.rol)+
   field("Situação",x.estado==="identificado"?"Designação identificada":x.estado==="conflito"?"Conflito de designação":"Sem designação");
  if(x.dirigente)actions='<button class="btn primary small" type="button" onclick="mapPick(&quot;'+esc(key("d",x.id))+'&quot;)">Abrir ficha do dirigente</button>';
 }
 return '<aside class="rmap-details"><div class="ey" style="color:var(--gold)">DETALHES DO REGISTRO</div>'+
 '<h2>'+esc(name)+'</h2>'+rows+(hint?'<p class="rmap-note" style="margin-top:13px">'+esc(hint)+'</p>':'')+
 (actions?'<div class="rmap-panel-actions">'+actions+'</div>':'')+'</aside>';
}
function mapContent(){
 if(S.mapBusy&&!S.mapData)return'<div class="rmap-tree">Carregando estrutura cadastrada...</div>';
 if(S.mapError&&!S.mapData)return'<div class="rmap-banner">'+esc(S.mapError)+'</div>';
 if(!S.mapData)return'<div class="rmap-tree"><p class="rmap-note">Use “Atualizar base” para carregar a estrutura.</p></div>';
 const t=S.mapData.totais;
 const stats='<div class="rmap-kpis"><span>'+esc(t.areas)+' áreas</span><span>'+esc(t.setores)+' setores</span><span>'+esc(t.congregacoes)+' congregações</span><span>'+esc(t.coordenadores)+' coordenadores cadastrados</span>'+
 (t.conflitos?'<span style="color:#a53d3d">'+esc(t.conflitos)+' conflitos</span>':'')+'</div>';
 return'<div style="margin-bottom:12px">'+stats+'</div>'+
 '<div class="rmap-work'+(S.mapSelected.startsWith("d:")?" rmap-focused":"")+'"><section class="rmap-tree" aria-label="Árvore do rodízio de 2026">'+mapTree()+'</section>'+details()+'</div>';
}
window.mapMarkup=function(){
 return'<main class="rmap"><div class="rmap-top"><div><h2>Estrutura cadastrada em 2026</h2><p class="rmap-note">Área → Setor → Coordenador → Congregação → Dirigente</p></div>'+
 '<button class="btn ghost small" type="button" onclick="mapFetch()">Atualizar base</button></div>'+
 '<div class="rmap-banner">Esta tela é somente para visualização. Ainda não existe sincronização em tempo real.</div>'+
 '<div class="rmap-toolbar"><input type="search" aria-label="Pesquisar estrutura do Rodízio" value="'+esc(S.mapQuery)+'" placeholder="Pesquisar pessoa, ROL, setor ou congregação" oninput="mapSearch(this.value)">'+
 '<button type="button" class="btn ghost small" onclick="mapExpandAll()">Expandir tudo</button>'+
 '<button type="button" class="btn ghost small" onclick="mapCollapseAll()">Recolher tudo</button></div>'+
 '<div id="rod27-map-body">'+mapContent()+'</div></main>';
};
function repaint(){
 if(S.view!=="map")return;
 const slot=document.getElementById("rod27-map-body");
 if(slot){
  const oldTree=typeof slot.querySelector==="function"?slot.querySelector(".rmap-tree"):null;
  const prior=oldTree?oldTree.scrollTop:0;
  slot.innerHTML=mapContent();
  const tree=typeof slot.querySelector==="function"?slot.querySelector(".rmap-tree"):null;
  if(tree)tree.scrollTop=prior;
 }
}
window.mapFetch=async function(){
 if(S.mapBusy)return;
 S.mapBusy=true;S.mapError=null;repaint();
 try{
  const data=await api("map_2026");
  if(data.ano!==2026||!Array.isArray(data.areas)||!data.somente_leitura)throw new Error("Base de 2026 inválida.");
  if(!S.access)return;
  S.mapData=data;profileCache.clear();fetchVersion++;S.mapExpanded={root:true};
  if(data.areas.length)S.mapExpanded[key("a",data.areas[0].codigo)]=true;
  S.mapSelected="root";
 }catch(err){S.mapError=err.message||"Não foi possível consultar a estrutura.";}
 finally{S.mapBusy=false;repaint();}
};
window.mapToggle=function(id){S.mapExpanded[id]=!expanded(id);repaint();};
window.mapPick=function(id){
 S.mapSelected=id;repaint();
 if(id.startsWith("d:"))loadDirector(id,false);
};
window.mapSearch=function(value){S.mapQuery=value;S.mapSelected="root";repaint();};
async function loadDirector(id,force){
 const selected=matchSelection();
 if(id!==S.mapSelected||selected?.type!=="director")return;
 if(profileCache.has(id)&&!force)return;
 const version=++fetchVersion,rol=String(selected.value?.rol||"");
 const evaluation=selected.church?.avaliacao;
 const data={loading:true,profile:null,documents:null,evaluation:null,errors:{},preview:null};
 profileCache.set(id,data);repaint();
 const promises=[
  rol?api("office_lookup_obreiro",{rol}):Promise.reject(new Error("ROL indisponível")),
  evaluation?api("office_documents",{avaliacao_id:evaluation.id}):Promise.resolve({ok:true,documentos:[]}),
  evaluation?.status==="enviada"?api("evaluation",{avaliacao_id:evaluation.id}):Promise.resolve(null)
 ];
 const labels=["profile","documents","evaluation"];
 const results=await Promise.allSettled(promises);
 if(version!==fetchVersion||id!==S.mapSelected)return;
 results.forEach((result,index)=>{
  const label=labels[index];
  if(result.status==="fulfilled"){data[label]=result.value;}
  else{data.errors[label]=result.reason?.message||"Consulta indisponível";}
 });
 data.loading=false;repaint();
}
window.mapReloadProfile=function(){
 const id=S.mapSelected;
 if(id.startsWith("d:"))loadDirector(id,true);
};
window.mapClosePreview=function(){
 const state=profileCache.get(S.mapSelected);
 if(state){state.preview=null;repaint();}
};
window.mapOpenDocument=async function(docId){
 const id=S.mapSelected,state=profileCache.get(id);
 if(!state||state.loading)return;
 const doc=state.documents?.documentos?.find(x=>String(x.id)===String(docId));
 if(!doc)return;
 try{
  const result=await api("office_document_url",{documento_id:docId});
  if(S.mapSelected!==id)return;
  const url=safeUrl(result.url);
  if(!url)throw new Error("Endereço temporário inválido.");
  state.preview={url,name:doc.nome_original,mime:doc.tipo_mime};
  repaint();
 }catch(err){if(typeof toast==="function")toast(err.message||"Não foi possível abrir o documento.");}
};
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
