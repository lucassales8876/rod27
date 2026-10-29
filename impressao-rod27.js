/* ROD27 - Impressao A4 em PDF unico, 100% no browser. Nenhuma gravacao no banco. */
(function(){
"use strict";
function safe(v){return String(v==null?"":v).replace(/[\u0000-\u001f\u007f]/g," ").replace(/[\u2013\u2014]/g,"-").replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u2022/g,"-").replace(/[^\u0020-\u00ff]/g,"?").trim();}
function html(v){return String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));}
const A4=[595.28,841.89],M=44,W=A4[0]-2*M;
async function buildPdf(result){
 if(!window.PDFLib)throw Error("Biblioteca de PDF não carregou. Atualize a página.");
 const {PDFDocument,StandardFonts,rgb}=window.PDFLib;
 const pdf=await PDFDocument.create();
 pdf.setTitle("Rodízio 2027 | "+(result.tipo==="manifestacao"?"Manifestações de Interesse":"Avaliações em Branco"));
 pdf.setAuthor("Secretaria Geral IEADERN - ROD27");
 const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.12,.18,.29),muted=rgb(.38,.43,.53),gold=rgb(.6,.44,.23),line=rgb(.8,.82,.86);
 let page=null,y=0,head="",ctx="";
 function start(title,meta){
  page=pdf.addPage(A4);y=A4[1]-48;head=title;ctx=meta;
  page.drawText("IEADERN  |  SECRETARIA GERAL  |  RODÍZIO 2027",{x:M,y,size:9,font:bold,color:gold});y-=27;
  page.drawText(safe(title),{x:M,y,size:16,font:bold,color:ink});y-=18;
  const pieces=wrap(meta,font,9,W);
  for(const v of pieces){page.drawText(v,{x:M,y,size:9,font,color:muted});y-=12;}
  y-=8;page.drawLine({start:{x:M,y},end:{x:M+W,y},thickness:1,color:line});y-=19;
 }
 function space(need){
  if(y-need<69)start(head+" (continuação)",ctx);
 }
 function wrap(text,f,size,width){
  const out=[];let current="";
  const words=safe(text).split(/\s+/).filter(Boolean);
  for(let word of words){
   while(f.widthOfTextAtSize(word,size)>width){
    let n=1;while(n<word.length&&f.widthOfTextAtSize(word.slice(0,n+1),size)<=width)n++;
    if(current){out.push(current);current="";}
    out.push(word.slice(0,n));word=word.slice(n);
   }
   const next=current?current+" "+word:word;
   if(current&&f.widthOfTextAtSize(next,size)>width){out.push(current);current=word;}else current=next;
  }
  if(current)out.push(current);
  return out.length?out:[""];
 }
 function text(value,{size=10,strong=false,color=ink,before=0,after=5,indent=0}={}){
  const f=strong?bold:font;const rows=wrap(value,f,size,W-indent);
  space(before+rows.length*(size+4)+after);y-=before;
  for(const row of rows){page.drawText(row,{x:M+indent,y,size,font:f,color});y-=size+4;}
  y-=after;
 }
 function blankLines(n=4){
  space(n*21+12);
  for(let i=0;i<n;i++){y-=16;page.drawLine({start:{x:M+6,y},end:{x:M+W-8,y},thickness:.6,color:line});y-=5;}
  y-=7;
 }
 function check(textValue){
  const rows=wrap(textValue,font,9,W-28);space(Math.max(20,rows.length*12+4));
  page.drawRectangle({x:M+7,y:y-1,width:9,height:9,borderColor:muted,borderWidth:1});
  for(let j=0;j<rows.length;j++){page.drawText(rows[j],{x:M+25,y:y-j*12,size:9,font,color:ink});}
  y-=Math.max(22,rows.length*12+5);
 }
 function beginAssessment(sec,ev){
  start("FORMULÁRIO DE AVALIAÇÃO EM BRANCO","Setor "+sec.setor+" | Área "+sec.area+" | Coordenador: "+sec.coordenador+" | ROL: "+(sec.rol||""));
  text("Dirigente: "+ev.dirigente+" | ROL: "+(ev.rol||""),{strong:true,size:11});
  text("Congregação: "+ev.congregacao,{size:10,after:16});
  text("Preenchimento manuscrito. Não é uma avaliação enviada pelo sistema.",{size:9,color:muted,after:12});
  for(let i=0;i<(result.perguntas||[]).length;i++){
   const q=result.perguntas[i],name=(q.ordem||i+1)+". "+q.titulo;
   space(50);text(name,{size:10,strong:true,after:3});
   if(q.enunciado)text(q.enunciado,{size:9.5,color:muted,after:10});
   if(q.tipo_resposta==="escolha_unica"){
    for(const option of q.opcoes||[])check(option);
   }else blankLines(4);
  }
  space(65);y-=16;
  text("Data: ____/____/______       Assinatura do coordenador: ___________________________________",{size:9});
 }
 function beginManifestation(sec){
  start("MANIFESTAÇÃO DE INTERESSE EM BRANCO","Setor "+sec.setor+" | Área "+sec.area+" | Ciclo do Rodízio 2027");
  text("Coordenador: "+sec.coordenador,{size:12,strong:true});
  text("ROL: "+(sec.rol||"")+"     Setor: "+sec.setor+"     Área: "+sec.area,{size:10,after:22});
  text("1. Deseja permanecer no próximo Rodízio?",{strong:true,after:12});check("Sim");check("Não");y-=10;
  text("2. Se desejar permanecer, qual sua preferência?",{strong:true,after:10});
  check("Permanecer na mesma congregação");
  check("Mudar para outra congregação do mesmo setor");
  check("Mudar para uma congregação de outro setor");
  y-=9;
  text("3. Justificativa / motivo da preferência, mudança ou saída:",{strong:true,after:8});
  blankLines(9);y-=20;
  text("Data: ____/____/______",{size:10,after:22});
  text("Assinatura do coordenador: __________________________________________",{size:10});
  text("Documento físico, a ser preenchido e assinado pelo próprio coordenador.",{size:9,color:muted,before:20});
 }
 for(const sec of result.setores||[]){
  if(result.tipo==="manifestacao")beginManifestation(sec);
  else for(const ev of sec.avaliacoes||[])beginAssessment(sec,ev);
  if(pdf.getPageCount()%8===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 if(!pdf.getPageCount())throw Error("Não há documentos para os setores selecionados.");
 const pages=pdf.getPages();
 pages.forEach((p,i)=>{
  const t="ROD27 | "+(i+1)+" de "+pages.length;
  p.drawLine({start:{x:M,y:53},end:{x:M+W,y:53},thickness:.6,color:line});
  p.drawText(t,{x:M,y:38,size:8,font,color:muted});
 });
 return new Blob([await pdf.save({useObjectStreams:true})],{type:"application/pdf"});
}
function download(blob,filename){
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),120000);
}
window.exportBlankBatch=async function(tipo,setores){
 if(!["manifestacao","avaliacao"].includes(tipo))throw Error("Tipo inválido");
 const data=Array.isArray(setores)?setores.map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=42):[];
 if(!data.length){if(typeof toast==="function")toast("Selecione ao menos um setor.");return}
 const label=tipo==="manifestacao"?"manifestações":"formulários";
 try{
  if(typeof toast==="function")toast("Preparando PDF único de "+label+"...");
  const response=await api("blank_batch",{tipo,setores:[...new Set(data)]});
  const pdf=await buildPdf(response);
  download(pdf,"ROD27_2027_"+tipo+"_setores_"+data.slice().sort((a,b)=>a-b).join("-")+".pdf");
  if(typeof toast==="function")toast("PDF único gerado para "+data.length+" setores.");
 }catch(error){if(typeof toast==="function")toast("Não foi possível exportar: "+error.message);throw error;}
};
window.openBulkActions=function(){
 box.innerHTML='<div class="ey">ROD27 · SECRETARIA</div><h2>Ações em massa</h2><p class="muted">Reúna os documentos selecionados em um único PDF A4 para impressão. Nada será enviado ou alterado no banco.</p>'+
 '<div class="actions"><button class="btn primary" onclick="openBulkSelect(&quot;avaliacao&quot;)">Imprimir formulários de avaliação em branco</button>'+
 '<button class="btn ghost" onclick="openBulkSelect(&quot;manifestacao&quot;)">Imprimir manifestações de interesse em branco</button></div>'+
 '<div class="actions"><button class="btn ghost" onclick="closeM()">Fechar</button></div>';
 back.classList.add("show");
};
window.openBulkSelect=function(tipo){
 const sectors=(S.data?.sectors||[]).slice().sort((a,b)=>a.setor-b.setor);
 const heading=tipo==="manifestacao"?"Manifestações de interesse":"Formulários de avaliação";
 box.innerHTML='<div class="ey">AÇÕES EM MASSA</div><h2>'+html(heading)+'</h2><p class="muted">Escolha os setores. Cada documento será identificado com o setor e o responsável correspondente.</p>'+
 '<div class="actions"><button class="btn ghost small" onclick="bulkToggle(true)">Selecionar todos</button><button class="btn ghost small" onclick="bulkToggle(false)">Desmarcar todos</button></div>'+
 '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:8px;max-height:52vh;overflow:auto;margin:14px 0">'+
 sectors.map(x=>'<label style="display:flex;align-items:flex-start;gap:8px;padding:9px;border:1px solid var(--l);border-radius:9px;font-size:12px"><input type="checkbox" class="bulkSector" value="'+Number(x.setor)+'" checked> Setor '+Number(x.setor)+' · '+html(x.coordenador)+'</label>').join("")+
 '</div><div class="actions"><button id="bulkExportBtn" class="btn primary" onclick="bulkExport(&quot;'+tipo+'&quot;)">Exportar PDF único</button><button class="btn ghost" onclick="openBulkActions()">Voltar</button></div>';
 back.classList.add("show");
};
window.bulkToggle=function(v){document.querySelectorAll(".bulkSector").forEach(el=>{el.checked=!!v})};
window.bulkExport=async function(tipo){
 const chosen=[...document.querySelectorAll(".bulkSector:checked")].map(x=>Number(x.value));
 if(!chosen.length){toast("Selecione ao menos um setor.");return;}
 const btn=document.getElementById("bulkExportBtn");if(btn){btn.disabled=true;btn.textContent="Gerando PDF...";}
 try{await window.exportBlankBatch(tipo,chosen)}
 catch(e){/* already reported */}
 finally{if(btn){btn.disabled=false;btn.textContent="Exportar PDF único";}}
};
})();
