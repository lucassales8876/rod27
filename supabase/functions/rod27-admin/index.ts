
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??(()=>{try{return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}").default??""}catch{return""}})();
if(!SUPABASE_URL||!KEY)throw new Error("Rod27 admin credentials unavailable.");
const db=createClient(SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const PAGE_HTML="<!doctype html>\n<html lang=\"pt-BR\"><head>\n<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"robots\" content=\"noindex,nofollow,noarchive\"><meta name=\"theme-color\" content=\"#17223b\">\n<title>Acesso</title>\n<style>\n:root{--n:#17223b;--n2:#26385f;--p:#f5f2ec;--i:#182033;--m:#69707c;--l:#e4ded3;--g:#1f7a55;--a:#9a6418;--r:#a53d3d;--gold:#b7873f}\n*{box-sizing:border-box}body{margin:0;background:var(--p);color:var(--i);font:15px/1.5 system-ui,-apple-system,\"Segoe UI\",sans-serif}button,input,select,textarea{font:inherit}button{cursor:pointer}.shell{max-width:1120px;margin:auto;min-height:100vh;padding-bottom:50px}\n.hero{background:linear-gradient(145deg,var(--n),var(--n2));color:#fff;padding:28px 20px;border-radius:0 0 28px 28px}.ey{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#dbc69d;font-weight:800}.hero h1{margin:5px 0}.hero p{margin:0;opacity:.84}.topline{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.badges{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}.badge{font-size:12px;padding:6px 9px;border-radius:99px;background:#ffffff17;border:1px solid #ffffff20}\nmain{padding:18px}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:15px}.kpi{background:#fff;border:1px solid var(--l);border-radius:17px;padding:14px}.kpi strong{display:block;font-size:24px}.kpi span{font-size:12px;color:var(--m)}\n.sectors{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}.sector{background:#fff;border:1px solid var(--l);border-radius:19px;padding:14px}.sectorHead{display:flex;justify-content:space-between;gap:10px}.sector h3{margin:0}.coord{font-size:13px;color:var(--m);margin:3px 0 11px}.row{display:flex;justify-content:space-between;gap:10px;font-size:13px;margin:5px 0}.bar{height:7px;background:#ece7de;border-radius:99px;overflow:hidden;margin:10px 0}.bar i{display:block;height:100%;background:var(--g)}\n.status{font-size:10px;font-weight:900;text-transform:uppercase;border-radius:99px;padding:5px 7px}.active{background:#dff3e9;color:var(--g)}.off{background:#eef1f5;color:#59616f}.blocked{background:#fff1cf;color:var(--a)}.revoked{background:#f7dfdf;color:var(--r)}\n.actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.btn{border:0;border-radius:11px;padding:9px 12px;font-weight:800}.primary{background:var(--n);color:#fff}.ghost{background:#eee9e1}.danger{background:#f4dddd;color:var(--r)}.small{font-size:12px;padding:7px 9px}\n.login{max-width:430px;margin:90px auto;background:#fff;border:1px solid var(--l);border-radius:23px;padding:25px}.login h2{margin:5px 0}.field{margin:12px 0}.field label{display:block;font-size:12px;font-weight:800;margin-bottom:5px}.field input,.field select,.field textarea{width:100%;border:1px solid #d6d0c6;border-radius:11px;padding:11px}.muted{color:var(--m)}.error{color:var(--r);font-size:13px;min-height:20px}\n.back{position:fixed;inset:0;background:#0c12218a;display:none;align-items:flex-end;justify-content:center;z-index:20}.back.show{display:flex}.modal{width:min(800px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:25px 25px 0 0;padding:19px}.warning{background:#fff8e9;border-left:4px solid var(--gold);padding:11px;border-radius:10px;margin:12px 0}\n.eval{border:1px solid var(--l);border-radius:13px;padding:11px;margin:8px 0;display:grid;grid-template-columns:1fr auto;gap:10px}.eval b{display:block}.eval span{font-size:12px;color:var(--m)}.sent{color:var(--g)}.draft{color:var(--a)}.new{color:var(--m)}\n.answer{background:#f8f6f1;border:1px solid var(--l);border-radius:13px;padding:11px;margin:9px 0}.answer h4{margin:0 0 5px}.answer p{white-space:pre-wrap;margin:0}.classify{border:1px solid var(--l);border-radius:14px;padding:13px;margin-top:15px}.classify h3{margin-top:0}.classGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.linkbox{background:#f6f7fb;border:1px solid #dfe3ed;border-radius:12px;padding:10px;word-break:break-all;font-family:ui-monospace,monospace;font-size:14px;text-align:center}\n.toast{position:fixed;left:50%;bottom:16px;transform:translateX(-50%) translateY(20px);background:var(--n);color:#fff;padding:9px 12px;border-radius:10px;opacity:0;transition:.2s;z-index:50}.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}\n@media(max-width:720px){.summary,.classGrid{grid-template-columns:repeat(2,1fr)}}@media(min-width:720px){.hero{margin-top:18px;border-radius:26px}.back{align-items:center}.modal{border-radius:24px}}\n</style></head><body>\n<div id=\"app\" class=\"shell\"></div><div id=\"back\" class=\"back\"><div id=\"modal\" class=\"modal\"></div></div><div id=\"toast\" class=\"toast\"></div>\n<script>\nvar PROJECT_URL=\"https://zrjxxcytgtjuuinhkfux.supabase.co\",PUBLISHABLE_KEY=\"sb_publishable_p6zUbFwkzvfv_7XUMqhxwA_BjGCxIEh\",S={access:null,refresh:null,admin:null,data:null};\nvar app=document.getElementById(\"app\"),back=document.getElementById(\"back\"),box=document.getElementById(\"modal\");\nfunction e(v){return String(v==null?\"\":v).replace(/[&<>\"']/g,function(x){return{\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",\"\\\"\":\"&quot;\",\"'\":\"&#39;\"}[x]})}\nfunction toast(m){var x=document.getElementById(\"toast\");x.textContent=m;x.classList.add(\"show\");setTimeout(function(){x.classList.remove(\"show\")},2200)}\nfunction saveSession(d){S.access=d.access_token;S.refresh=d.refresh_token;sessionStorage.setItem(\"r27a\",S.access||\"\");sessionStorage.setItem(\"r27r\",S.refresh||\"\")}\nfunction clearSession(){S.access=null;S.refresh=null;sessionStorage.removeItem(\"r27a\");sessionStorage.removeItem(\"r27r\")}\nasync function refresh(){if(!S.refresh)return false;var r=await fetch(PROJECT_URL+\"/auth/v1/token?grant_type=refresh_token\",{method:\"POST\",headers:{\"apikey\":PUBLISHABLE_KEY,\"Content-Type\":\"application/json\"},body:JSON.stringify({refresh_token:S.refresh})});if(!r.ok){clearSession();return false}saveSession(await r.json());return true}\nasync function api(action,p,retry){var r=await fetch(\"https://zrjxxcytgtjuuinhkfux.supabase.co/functions/v1/rod27-admin\",{method:\"POST\",headers:{\"Content-Type\":\"application/json\",\"Authorization\":\"Bearer \"+S.access},body:JSON.stringify(Object.assign({action:action},p||{}))});if(r.status===401&&!retry&&await refresh())return api(action,p,true);var j=await r.json().catch(function(){return{ok:false,error:\"Resposta inválida.\"}});if(r.status===401){clearSession();back.classList.remove(\"show\");loginView(\"Sua sessão expirou. Entre novamente.\");throw new Error(\"Sessão expirada.\")}if(!r.ok||!j.ok)throw new Error(j.error||\"Falha na comunicação.\");return j}\nfunction toggleSenha(btn){\n var fields=(btn.getAttribute(\"data-password-ids\")||\"\").split(\",\").map(function(id){return document.getElementById(id)}).filter(Boolean);\n if(!fields.length)return;\n var reveal=fields[0].type===\"password\";\n fields.forEach(function(input){input.type=reveal?\"text\":\"password\"});\n btn.textContent=reveal?\"Ocultar senha\":\"Mostrar senha\";\n btn.setAttribute(\"aria-pressed\",reveal?\"true\":\"false\");\n}\nfunction loginView(msg){app.innerHTML='<div class=\"login\"><h2>Acesso</h2><div class=\"field\"><label>E-mail</label><input id=\"email\" type=\"email\" autocomplete=\"username\"></div><div class=\"field\"><label>Senha</label><input id=\"pass\" type=\"password\" autocomplete=\"current-password\"><button type=\"button\" data-password-ids=\"pass\" aria-pressed=\"false\" onclick=\"toggleSenha(this)\" style=\"margin-top:8px;padding:6px 0;border:0;background:transparent;color:#273a62;font:inherit;font-size:13px;font-weight:700;cursor:pointer\">Mostrar senha</button></div><div id=\"err\" class=\"error\">'+e(msg||\"\")+'</div><button class=\"btn primary\" style=\"width:100%\" onclick=\"login()\">Entrar</button><p style=\"text-align:center\"><a href=\"#\" onclick=\"recoverLogin();return false\">Esqueci a senha</a></p></div>'}\nwindow.recoverLogin=async function(){\n var email=document.getElementById(\"email\")?.value.trim();\n if(!email){toast(\"Informe o e-mail.\");return}\n try{await fetch(PROJECT_URL+\"/auth/v1/recover?redirect_to=\"+encodeURIComponent(\"https://rod27-ieadern.pages.dev/redefinir-senha\"),{method:\"POST\",headers:{\"apikey\":PUBLISHABLE_KEY,\"Content-Type\":\"application/json\"},body:JSON.stringify({email})})}catch(_){}\n toast(\"Se existir uma conta, as instruções de recuperação serão enviadas.\");\n};\nwindow.login=async function(){var email=document.getElementById(\"email\").value.trim(),password=document.getElementById(\"pass\").value,err=document.getElementById(\"err\");err.textContent=\"Entrando…\";try{var r=await fetch(PROJECT_URL+\"/auth/v1/token?grant_type=password\",{method:\"POST\",headers:{\"apikey\":PUBLISHABLE_KEY,\"Content-Type\":\"application/json\"},body:JSON.stringify({email:email,password:password})}),j=await r.json();if(!r.ok)throw new Error(\"E-mail ou senha inválidos.\");saveSession(j);await boot()}catch(x){err.textContent=x.message}}\nwindow.logout=function(){clearSession();loginView()};\nfunction closeM(){back.classList.remove(\"show\");box.innerHTML=\"\"}window.closeM=closeM;back.addEventListener(\"click\",function(x){if(x.target===back)closeM()});\nfunction credTag(s){if(s===\"ativa\")return'<span class=\"status active\">Ativo</span>';if(s===\"bloqueada\")return'<span class=\"status blocked\">Bloqueado</span>';if(s===\"revogada\")return'<span class=\"status revoked\">Revogado</span>';return'<span class=\"status off\">Sem senha</span>'}\n\nwindow.openManifestations = async function () {\n  try {\n    const r = await api(\"manifestations\");\n    const rows = Array.isArray(r.manifestations) ? r.manifestations : [];\n    const sent = rows.filter(x => x.status === \"enviada\").length;\n    const opts = {\n      mesma_congregacao: \"Permanecer na mesma congregação\",\n      outra_congregacao_mesmo_setor: \"Mudar para outra congregação do mesmo setor\",\n      congregacao_outro_setor: \"Mudar para uma congregação de outro setor\"\n    };\n    let html = '<div class=\"ey\">RODÍZIO 2027 · SECRETARIA</div><h2>Manifestações de Interesse</h2>'\n      + '<p class=\"muted\">' + sent + ' enviadas de ' + rows.length + ' coordenações. Esta seção é separada das avaliações dos dirigentes.</p>';\n    for (const x of rows) {\n      const status = x.status === \"enviada\" ? \"Enviada\" : x.status === \"rascunho\" ? \"Rascunho\" : \"Aguardando\";\n      const state = x.status === \"enviada\" ? \"sent\" : x.status === \"rascunho\" ? \"draft\" : \"new\";\n      const answer = x.deseja_permanecer === true ? \"Sim: \" + (opts[x.opcao_movimentacao] || \"Não informada\")\n        : x.deseja_permanecer === false ? \"Não\" : \"Sem resposta\";\n      const detail = x.justificativa ? '<p><b>Justificativa:</b> ' + e(x.justificativa) + '</p>' : \"\";\n      const date = x.enviada_em ? '<span>Enviada em ' + e(new Date(x.enviada_em).toLocaleString(\"pt-BR\")) + '</span>' : \"\";\n      html += '<div class=\"eval\"><div><b>Setor ' + e(x.setor_numero_snapshot) + ' · ' + e(x.coordenador_nome_snapshot) + '</b>'\n        + '<span>ROL ' + e(x.coordenador_rol_snapshot) + ' · ' + e(x.congregacao_nome_snapshot) + ' · Área ' + e(x.area) + '</span>'\n        + '<p><b>Resposta:</b> ' + e(answer) + '</p>' + detail + date\n        + '</div><span class=\"' + state + '\">' + status + '</span></div>';\n    }\n    html += '<div class=\"actions\"><button class=\"btn ghost\" onclick=\"closeM()\">Fechar</button></div>';\n    box.innerHTML = html;\n    back.classList.add(\"show\");\n  } catch (err) { toast(err.message || \"Não foi possível consultar as manifestações.\"); }\n};\n\nfunction render(){var d=S.data,a=d.admin;app.innerHTML='<section class=\"hero\"><div class=\"topline\"><div><div class=\"ey\">ROD27 · SECRETARIA GERAL</div><h1>Painel do Rodízio 2027</h1><p>'+e(a.nome_exibicao||a.email||\"Administrador\")+' · '+e(a.papel)+'</p></div><button class=\"btn ghost small\" onclick=\"logout()\">Sair</button></div><div class=\"badges\"><span class=\"badge\">'+d.summary.setores+' setores</span><span class=\"badge\">'+d.summary.total+' avaliações</span><span class=\"badge\">'+d.summary.enviadas+' enviadas</span></div><div class=\"actions\">'+((a.papel===\"superadmin\"||a.papel===\"secretario_geral\")?'<button class=\"btn primary small\" type=\"button\" onclick=\"openManifestations()\">Manifestações de interesse</button>':'')+'<button class=\"btn ghost small\" type=\"button\" onclick=\"exportProgress()\">Exportar andamento CSV</button><button class=\"btn primary small\" type=\"button\" onclick=\"exportDetailed(&quot;all&quot;)\">Exportar respostas CSV</button></div></section><main><div class=\"summary\"><div class=\"kpi\"><strong>'+d.summary.enviadas+'</strong><span>Enviadas</span></div><div class=\"kpi\"><strong>'+d.summary.em_preenchimento+'</strong><span>Em andamento</span></div><div class=\"kpi\"><strong>'+d.summary.nao_iniciadas+'</strong><span>Não iniciadas</span></div><div class=\"kpi\"><strong>'+d.summary.credenciais_ativas+'</strong><span>Coordenadores liberados</span></div></div><div class=\"sectors\">'+d.sectors.map(secHtml).join(\"\")+'</div></main>'}\nwindow.exportDetailed=async function(scope,ref){\n try{\n  toast(\"Preparando respostas...\");\n  var args={scope:scope};\n  if(scope===\"sector\")args.setor=Number(ref);\n  if(scope===\"evaluation\")args.avaliacao_id=String(ref);\n  var data=await api(\"export_detailed\",args);\n  var fields=[[\"area\",\"Área\"],[\"setor\",\"Setor\"],[\"coordenador\",\"Coordenador\"],[\"coordenador_rol\",\"ROL coordenador\"],[\"congregacao\",\"Congregação\"],[\"dirigente\",\"Dirigente\"],[\"dirigente_rol\",\"ROL dirigente\"],[\"pergunta_numero\",\"Nº da pergunta\"],[\"pergunta\",\"Pergunta\"],[\"resposta\",\"Resposta\"],[\"enviada_em\",\"Data do envio\"],[\"origem\",\"Origem\"],[\"versao\",\"Versão\"],[\"avaliacao_id\",\"ID avaliação\"]];\n  var cell=function(v){var t=String(v==null?\"\":v).replace(/\\r\\n?/g,\"\\n\");if(/^\\s*[=+\\-@\\t\\r]/.test(t))t=\"'\"+t;return '\"'+t.replace(/\"/g,'\"\"')+'\"';};\n  var rows=[fields.map(x=>x[1])].concat((data.rows||[]).map(x=>fields.map(f=>x[f[0]])));\n  var csv=\"\\uFEFF\"+rows.map(r=>r.map(cell).join(\";\")).join(\"\\r\\n\");\n  var href=URL.createObjectURL(new Blob([csv],{type:\"text/csv;charset=utf-8\"})),a=document.createElement(\"a\");\n  a.href=href;a.download=\"rod27-respostas-\"+scope+(ref?\"-\"+String(ref).replace(/[^a-z0-9-]/gi,\"\"):\"\")+\"-\"+new Date().toISOString().slice(0,10)+\".csv\";\n  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),6000);\n  toast(\"Exportadas \"+data.total_avaliacoes+\" avaliações.\");\n }catch(x){toast(x.message||\"Falha na exportação.\");}\n};\nwindow.exportProgress=function(){\n  if(!S.data||!Array.isArray(S.data.sectors)){toast(\"Aguarde o carregamento dos setores.\");return;}\n  var head=[\"Setor\",\"Área\",\"Avaliações totais\",\"Próprio coordenador\",\"Avaliações dos dirigentes\",\"Não iniciadas\",\"Em preenchimento\",\"Enviadas\",\"Status do acesso\"];\n  var rows=S.data.sectors.map(function(s){return[s.setor,s.area,s.total,s.tratamento_especial,Math.max(0,s.total-(S.data.autoavaliacao_permitida?0:s.tratamento_especial)),s.nao_iniciadas,s.em_preenchimento,s.enviadas,s.credencial_status]});\n  var safe=function(v){var t=String(v==null?\"\":v).replace(/[\\r\\n]/g,\" \");if(/^\\s*[=+\\-@]/.test(t))t=\"'\"+t;return '\"'+t.replace(/\"/g,'\"\"')+'\"'};\n  var csv=\"\\uFEFF\"+[head].concat(rows).map(function(a){return a.map(safe).join(\";\")}).join(\"\\r\\n\");\n  var url=URL.createObjectURL(new Blob([csv],{type:\"text/csv;charset=utf-8\"}));\n  var a=document.createElement(\"a\");a.href=url;a.download=\"rod27-andamento-setores-\"+new Date().toISOString().slice(0,10)+\".csv\";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},5000);\n  toast(\"Relatório CSV gerado. Nenhuma resposta em rascunho foi incluída.\");\n};\nfunction secHtml(s){var usable=s.total-(S.data.autoavaliacao_permitida?0:s.tratamento_especial),p=usable?Math.round(s.enviadas/usable*100):0,can=S.data.admin.papel!==\"revisor\";return'<article class=\"sector\"><div class=\"sectorHead\"><h3>Setor '+s.setor+'</h3>'+credTag(s.credencial_status)+'</div><div class=\"coord\">'+e(s.coordenador)+' · ROL '+e(s.rol)+' · Área '+e(s.area)+'</div><div class=\"row\"><span>Progresso</span><strong>'+s.enviadas+'/'+usable+'</strong></div><div class=\"bar\"><i style=\"width:'+p+'%\"></i></div><div class=\"row\"><span>Em andamento</span><span>'+s.em_preenchimento+'</span></div><div class=\"actions\"><button class=\"btn primary small\" onclick=\"openSector('+s.setor+')\">Abrir setor</button>'+(can?'<button class=\"btn ghost small\" onclick=\"officeChangeCoordinator('+s.setor+')\">Trocar coordenador</button><button class=\"btn ghost small\" onclick=\"resetPin('+s.setor+')\">'+(s.credencial_status===\"nao_configurada\"?\"Liberar acesso\":\"Redefinir senha\")+'</button>':\"\")+(can&&s.credencial_status!==\"revogada\"&&s.credencial_status!==\"nao_configurada\"?'<button class=\"btn danger small\" onclick=\"revoke('+s.setor+')\">Revogar</button>':\"\")+'</div></article>'}\nwindow.openSector=async function(n){try{var d=await api(\"sector\",{setor:n});S.openSectorData=d;box.innerHTML='<div class=\"ey\">SETOR '+n+'</div><h2>'+e(d.coordenador)+'</h2><p class=\"muted\">Área '+e(d.area)+' · '+d.evaluations.length+' dirigentes</p>'+d.evaluations.map(function(x){var st=x.status===\"enviada\"?\"sent\":(x.status===\"em_preenchimento\"?\"draft\":\"new\");return'<div class=\"eval\"><div><b>'+e(x.dirigente_nome_snapshot)+'</b><span>'+e(x.congregacao_nome_snapshot)+'</span></div><div><span class=\"'+st+'\">'+e(x.status.replaceAll(\"_\",\" \"))+'</span>'+(x.status===\"enviada\"?'<br><button class=\"btn ghost small\" onclick=\"openEval(&quot;'+x.id+'&quot;)\">'+(S.data.admin.papel===\"revisor\"?\"Ler avaliação\":\"Ver envio e classificar\")+'</button>':'<br><span class=\"muted\">Aguardando preenchimento</span>')+'<br><button class=\"btn ghost small\" onclick=\"printBlank(&quot;'+x.id+'&quot;)\">Imprimir formulário em branco</button>'+(S.data.admin.papel===\"revisor\"?\"\":(x.status!==\"enviada\"?'<br><button class=\"btn ghost small\" onclick=\"officeEditDirigente(&quot;'+x.id+'&quot;)\">Corrigir dirigente</button><button class=\"btn ghost small\" onclick=\"officeTranscription(&quot;'+x.id+'&quot;)\">Transcrever entrevista em papel / anexar PDF</button>':'<br><button class=\"btn ghost small\" onclick=\"officeViewDocuments(&quot;'+x.id+'&quot;)\">Consultar documento original</button>')) +'</div></div>'}).join(\"\")+'<div class=\"actions\"><button class=\"btn primary\" onclick=\"exportDetailed(&quot;sector&quot;,'+n+')\">Exportar respostas do setor</button><button class=\"btn ghost\" onclick=\"closeM()\">Fechar</button></div>';back.classList.add(\"show\")}catch(x){toast(x.message)}};\nwindow.printBlank=async function(id){\n var d=S.openSectorData,ev=d&&d.evaluations&&d.evaluations.find(function(x){return x.id===id});\n if(!ev){toast(\"Abra primeiro o setor correspondente.\");return}\n var w=window.open(\"\",\"_blank\");\n if(!w){toast(\"Autorize janelas para imprimir o formulário.\");return}\n w.document.title=\"Preparando formulário\";\n w.document.body.textContent=\"Preparando formulário para impressão…\";\n try{\n  var f=await api(\"blank_form\",{setor:d.setor});\n  var q=f.questions||[],coord=(S.data.sectors||[]).find(function(x){return Number(x.setor)===Number(d.setor)})||{};\n  var warning=f.form.status!==\"publicado\";\n  var hdr='<div class=\"header\"><div class=\"brand\">IEADERN · RODÍZIO 2027</div><h1>Formulário de avaliação do dirigente</h1><p>Preenchimento manuscrito pelo coordenador do setor · Versão '+e(f.form.versao)+'</p></div>';\n  var info='<div class=\"meta\"><p><b>Setor:</b> '+e(d.setor)+' · <b>Área:</b> '+e(d.area)+'</p><p><b>Coordenador:</b> '+e(d.coordenador)+' · <b>ROL:</b> '+e(coord.rol||\"\")+'</p><p><b>Dirigente:</b> '+e(ev.dirigente_nome_snapshot)+'</p><p><b>Congregação:</b> '+e(ev.congregacao_nome_snapshot)+'</p></div>';\n  var items=q.map(function(x){\n   var h='<section class=\"q\"><div class=\"qtitle\">'+e(x.ordem)+'. '+e(x.titulo)+(x.obrigatoria?' <span>*</span>':'')+'</div><p>'+e(x.enunciado||\"\")+'</p>';\n   if(x.tipo_resposta===\"escolha_unica\"){h+='<div class=\"options\">'+(x.opcoes||[]).map(function(o){return'<div class=\"option\">□ '+e(o)+'</div>'}).join(\"\")+'</div>';}\n   else {h+='<div class=\"lines\">'+Array(5).fill('<div></div>').join(\"\")+'</div>';}\n   return h+'</section>';\n  }).join(\"\");\n  var html='<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Rod27 · Ficha em branco</title><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font:12px/1.4 Arial,sans-serif;color:#17223b;margin:0}.header{text-align:center;border-bottom:2px solid #17223b;padding-bottom:9px}.brand{font-size:11px;letter-spacing:2px;font-weight:800}.header h1{font-size:19px;margin:4px 0}.header p{margin:0}.meta{border:1px solid #aaa;padding:8px 12px;margin:14px 0}.meta p{margin:3px 0}.q{break-inside:avoid;border-bottom:1px solid #ccc;padding:9px 0}.qtitle{font-weight:800;font-size:13px}.q p{white-space:pre-wrap;margin:6px 0}.lines div{height:24px;border-bottom:1px solid #b6b6b6}.options{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px;margin:9px 0}.option{font-size:12px}.warning{padding:9px;text-align:center;border:2px solid #a53d3d;color:#a53d3d;font-weight:800}.footer{break-inside:avoid;margin-top:24px}.sign{margin-top:55px;border-top:1px solid #222;text-align:center;width:72%;margin-left:auto;margin-right:auto;padding-top:4px}.stamp{font-size:10px;color:#777;margin-top:12px}.printctrl{margin:10px 0;padding:10px;text-align:right;background:#eee}@media print{.printctrl{display:none}}</style></head><body>';\n  html+='<div class=\"printctrl\"><button onclick=\"window.print()\">Imprimir / Salvar em PDF</button></div>';\n  html+=hdr+(warning?'<div class=\"warning\">PRÉVIA DE TESTE · FORMULÁRIO AINDA NÃO PUBLICADO</div>':'')+info+items;\n  html+='<div class=\"footer\"><p><b>Data:</b> _____ / _____ / 20_____ &nbsp; <b>Local:</b> _______________________________</p><div class=\"sign\">Assinatura do coordenador responsável</div><p class=\"stamp\">Documento preenchido em papel. A transcrição posterior deverá identificar o responsável pela digitação e preservar o original assinado.</p></div></body></html>';\n  w.document.open();w.document.write(html);w.document.close();\n }catch(x){w.document.body.textContent=\"Não foi possível preparar a ficha: \"+x.message;toast(x.message)}\n};\nasync function officeLookup(rol){\n var j=await api(\"office_lookup_obreiro\",{rol:String(rol||\"\").trim()});\n return j.obreiro;\n}\nwindow.officeChangeCoordinator=function(n){\n var x=S.data.sectors.find(function(z){return Number(z.setor)===Number(n)});\n if(!x){toast(\"Setor não encontrado.\");return}\n S.pendingCoordinator=null;\n box.innerHTML='<div class=\"ey\">ALTERAÇÃO DE COORDENADOR</div><h2>Setor '+e(n)+'</h2><p>Coordenador atual: <b>'+e(x.coordenador)+'</b> · ROL '+e(x.rol)+'</p><div class=\"warning\">Esta operação altera o ROL do setor, invalida todas as sessões antigas e gera um novo PIN aleatório. Confira os dados antes de confirmar.</div><div class=\"field\"><label>ROL do novo coordenador</label><input id=\"office_coord_rol\" placeholder=\"Informe o ROL\"></div><button class=\"btn ghost\" onclick=\"officePreviewCoordinator('+n+')\">Conferir ROL</button><div id=\"office_coord_preview\" class=\"field\"></div><div class=\"actions\"><button class=\"btn ghost\" onclick=\"closeM()\">Cancelar</button><button class=\"btn primary\" onclick=\"officeConfirmCoordinator('+n+')\">Confirmar substituição</button></div>';\n back.classList.add(\"show\");\n};\nwindow.officePreviewCoordinator=async function(n){\n var input=document.getElementById(\"office_coord_rol\"),node=document.getElementById(\"office_coord_preview\");\n try{\n  var r=await officeLookup(input.value);\n  if(!r||r.rol===S.data.sectors.find(x=>Number(x.setor)===Number(n)).rol)throw new Error(\"Este ROL já é o coordenador do setor.\");\n  S.pendingCoordinator=r;\n  node.innerHTML='<p><b>Conferido no fichário:</b> '+e(r.nome)+' · ROL '+e(r.rol)+'</p>';\n }catch(err){S.pendingCoordinator=null;node.textContent=err.message}\n};\nwindow.officeConfirmCoordinator=async function(n){\n var r=S.pendingCoordinator,current=S.data.sectors.find(x=>Number(x.setor)===Number(n));\n if(!r||String(r.rol)!==document.getElementById(\"office_coord_rol\").value.trim()){toast(\"Confira o ROL primeiro.\");return}\n if(!confirm(\"CONFIRMAR troca do setor \"+n+\"?\\nAntigo: \"+current.coordenador+\" (ROL \"+current.rol+\")\\nNovo: \"+r.nome+\" (ROL \"+r.rol+\")\\nO acesso antigo será invalidado e um PIN novo será criado.\"))return;\n try{\n  var result=await api(\"office_change_coordinator\",{setor:n,rol:r.rol});\n  await boot(true);\n  S.pendingCoordinator=null;\n  box.innerHTML='<div class=\"ey\">COORDENADOR ALTERADO</div><h2>'+e(r.nome)+'</h2><p><b>ROL:</b> '+e(r.rol)+'</p><div class=\"warning\">O ROL e o PIN anteriores perderam o acesso. Este PIN novo é mostrado uma única vez. Entregue-o ao responsável por um canal seguro.</div><div class=\"linkbox\"><span style=\"font-size:27px;letter-spacing:.18em\">'+e(result.pin)+'</span></div><p class=\"muted\">Fichas especiais vinculadas ao novo coordenador: '+e(result.coordenador?.fichas_especiais??\"?\")+'. Confira o tratamento dessas fichas.</p><div class=\"actions\"><button class=\"btn ghost\" onclick=\"closeM()\">Fechar</button></div>';\n  back.classList.add(\"show\");\n }catch(err){toast(err.message)}\n};\nwindow.officeEditDirigente=function(id){\n var x=S.openSectorData&&S.openSectorData.evaluations.find(z=>z.id===id);\n if(!x){toast(\"Ficha não encontrada.\");return}\n if(x.status!==\"nao_iniciada\"){toast(\"Ficha iniciada: correção requer revisão especial.\");return}\n S.pendingPastor=null;\n box.innerHTML='<div class=\"ey\">CORREÇÃO DE DIRIGENTE</div><h2>'+e(x.congregacao_nome_snapshot)+'</h2><p>Dirigente atualmente cadastrado: <b>'+e(x.dirigente_nome_snapshot)+'</b></p><div class=\"field\"><label>ROL correto do dirigente</label><input id=\"office_pastor_rol\" placeholder=\"Informe o ROL\"></div><button class=\"btn ghost\" onclick=\"officePreviewPastor()\">Conferir ROL</button><div id=\"office_pastor_preview\" class=\"field\"></div><div class=\"actions\"><button class=\"btn ghost\" onclick=\"closeM()\">Cancelar</button><button class=\"btn primary\" onclick=\"officeConfirmPastor(&quot;'+e(id)+'&quot;)\">Salvar dirigente correto</button></div>';\n back.classList.add(\"show\");\n};\nwindow.officePreviewPastor=async function(){\n var input=document.getElementById(\"office_pastor_rol\"),node=document.getElementById(\"office_pastor_preview\");\n try{var r=await officeLookup(input.value);S.pendingPastor=r;node.innerHTML='<p><b>ROL identificado:</b> '+e(r.nome)+' · '+e(r.rol)+'</p>'}\n catch(err){S.pendingPastor=null;node.textContent=err.message}\n};\nwindow.officeConfirmPastor=async function(id){\n var r=S.pendingPastor;\n if(!r||r.rol!==document.getElementById(\"office_pastor_rol\").value.trim()){toast(\"Confira o ROL primeiro.\");return}\n if(!confirm(\"Atualizar o dirigente desta congregação para \"+r.nome+\" (ROL \"+r.rol+\")? A ação ficará registrada na auditoria.\"))return;\n try{await api(\"office_replace_dirigente\",{avaliacao_id:id,rol:r.rol});closeM();toast(\"Dirigente corrigido.\");await openSector(S.openSectorData.setor)}\n catch(err){toast(err.message)}\n};\nwindow.officeViewDocuments=async function(id){\n try{\n  var j=await api(\"office_documents\",{avaliacao_id:id}),docs=j.documentos||[];\n  box.innerHTML='<div class=\"ey\">DOCUMENTOS ORIGINAIS</div><h2>Arquivo de auditoria</h2><p class=\"muted\">Cada consulta gera um link temporário de cinco minutos e é registrada na auditoria.</p>'+(docs.length?docs.map(function(d){return'<div class=\"eval\"><div><b>'+e(d.nome_original)+'</b><span>'+e(new Date(d.enviado_em).toLocaleString(\"pt-BR\"))+' · OCR: '+e(d.status_ocr)+'</span></div><button class=\"btn ghost small\" onclick=\"officeOpenDoc(&quot;'+e(d.id)+'&quot;)\">Abrir</button></div>'}).join(\"\"):'<p>Nenhum documento anexado.</p>')+'<div class=\"actions\"><button class=\"btn ghost\" onclick=\"closeM()\">Fechar</button></div>';\n  back.classList.add(\"show\");\n }catch(err){toast(err.message)}\n};\nwindow.officeOpenDoc=async function(docId){\n var w=window.open(\"\",\"_blank\");\n if(!w){toast(\"Autorize uma nova aba para visualizar.\");return}\n w.document.body.textContent=\"Preparando acesso temporário…\";\n try{var j=await api(\"office_document_url\",{documento_id:docId});w.location.assign(j.url)}\n catch(err){w.close();toast(err.message)}\n};\nwindow.officeTranscription=async function(id){\n try{\n  var d=await api(\"office_transcription\",{avaliacao_id:id});\n  S.paperDraft=d;\n  var old=new Map((d.rascunho?.respostas||[]).map(function(x){return[String(x.pergunta_id),String(x.resposta||\"\")]}));\n  var h='<div class=\"ey\">ENTREVISTA EM PAPEL</div><h2>'+e(d.avaliacao.dirigente_nome_snapshot)+'</h2><p>'+e(d.avaliacao.congregacao_nome_snapshot)+'</p><div class=\"warning\">Transcrição administrativa. Identifique o documento original assinado. O sistema não atribuirá esse envio a uma autenticação digital do coordenador. OCR automático ainda não está disponível.</div>';\n  h+='<div class=\"field\"><label>Anexar PDF ou foto do formulário assinado (máx. 8 MB)</label><input id=\"office_file\" type=\"file\" accept=\".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png\"></div><button class=\"btn ghost small\" onclick=\"officeUploadSignedDocument()\">Anexar documento</button>';\n  h+='<div class=\"field\"><label>Documento original utilizado na transcrição</label><select id=\"office_doc_id\"><option value=\"\">Sem documento selecionado</option>';\n  h+=(d.documentos||[]).map(function(x){return'<option value=\"'+e(x.id)+'\" '+(d.rascunho?.documento_id===x.id?'selected':'')+'>'+e(x.nome_original)+' · '+e(new Date(x.enviado_em).toLocaleDateString(\"pt-BR\"))+'</option>'}).join(\"\");\n  h+='</select></div>';\n  h+=(d.perguntas||[]).map(function(q){\n   var value=old.get(String(q.id))||\"\";\n   var input=q.tipo_resposta===\"escolha_unica\"?'<select id=\"paper_'+e(q.id)+'\"><option value=\"\">Selecione</option>'+(q.opcoes||[]).map(function(opt){return'<option value=\"'+e(opt)+'\" '+(value===String(opt)?'selected':'')+'>'+e(opt)+'</option>'}).join(\"\")+'</select>':'<textarea rows=\"4\" id=\"paper_'+e(q.id)+'\">'+e(value)+'</textarea>';\n   return'<div class=\"field\"><label>'+e(q.ordem)+'. '+e(q.titulo)+(q.obrigatoria?' *':'')+' ['+e(q.status)+']</label>'+input+'</div>'\n  }).join(\"\");\n  h+='<div class=\"actions\"><button class=\"btn ghost\" onclick=\"officeSavePaper(false)\">Salvar rascunho</button><button class=\"btn primary\" onclick=\"officeSavePaper(true)\">Concluir e enviar transcrição</button><button class=\"btn ghost\" onclick=\"closeM()\">Cancelar</button></div>';\n  box.innerHTML=h;back.classList.add(\"show\");\n }catch(err){toast(err.message)}\n};\nwindow.officeUploadSignedDocument=async function(){\n var d=S.paperDraft,file=document.getElementById(\"office_file\")?.files?.[0];\n if(!file){toast(\"Selecione um arquivo primeiro.\");return}\n if(file.size>8388608||file.size===0){toast(\"O limite é 8 MB.\");return}\n if(![\"application/pdf\",\"image/jpeg\",\"image/png\"].includes(file.type)){toast(\"Selecione PDF, JPG ou PNG.\");return}\n try{\n  var data=await new Promise(function(ok,fail){var r=new FileReader();r.onload=function(){ok(String(r.result||\"\").split(\",\")[1])};r.onerror=fail;r.readAsDataURL(file)});\n  await api(\"office_upload_document\",{avaliacao_id:d.avaliacao.id,nome:file.name,tipo_mime:file.type,base64:data});\n  toast(\"Documento original guardado no arquivo privado.\");\n  await officeTranscription(d.avaliacao.id);\n }catch(err){toast(err.message)}\n};\nwindow.officeSavePaper=async function(finalizar){\n var d=S.paperDraft;if(!d){toast(\"Formulário não carregado.\");return}\n var respostas=(d.perguntas||[]).map(function(q){var el=document.getElementById(\"paper_\"+q.id);return{pergunta_id:q.id,resposta:el?el.value:\"\"}});\n var documento_id=document.getElementById(\"office_doc_id\")?.value||null;\n if(finalizar){\n  if(!documento_id){toast(\"Anexe e selecione o documento original assinado.\");return}\n  if(!confirm(\"Concluir a transcrição? As respostas serão marcadas como enviadas pela Secretaria, com referência ao original assinado e auditoria.\"))return;\n }\n try{\n  await api(\"office_save_transcription\",{avaliacao_id:d.avaliacao.id,respostas,documento_id,finalizar:!!finalizar});\n  if(finalizar){closeM();toast(\"Transcrição enviada e auditada.\");await boot(true)}\n  else{toast(\"Rascunho da transcrição salvo.\");await officeTranscription(d.avaliacao.id)}\n }catch(err){toast(err.message)}\n};\nfunction sel(name,val){var opts=[\"\",\"pessimo\",\"ruim\",\"mediano\",\"bom\",\"excelente\"],labels={\"\":\"Selecione\",\"pessimo\":\"Péssimo\",\"ruim\":\"Ruim\",\"mediano\":\"Mediano\",\"bom\":\"Bom\",\"excelente\":\"Excelente\"};return'<select id=\"'+name+'\">'+opts.map(function(o){return'<option value=\"'+o+'\" '+(o===val?\"selected\":\"\")+'>'+labels[o]+'</option>'}).join(\"\")+'</select>'}\nwindow.openEval=async function(id){try{var d=await api(\"evaluation\",{avaliacao_id:id}),c=d.classification||{},h='<div class=\"ey\">AVALIAÇÃO ENVIADA</div><h2>'+e(d.evaluation.dirigente_nome_snapshot)+'</h2><p class=\"muted\">'+e(d.evaluation.congregacao_nome_snapshot)+'</p>';h+=d.answers.map(function(a){return'<div class=\"answer\"><h4>'+e(a.titulo)+'</h4><p>'+e(a.resposta)+'</p></div>'}).join(\"\");if(S.data.admin.papel!==\"revisor\")h+='<div class=\"classify\"><h3>Classificação administrativa</h3><p class=\"muted\">Esta classificação é posterior à narrativa e não altera o texto original do coordenador.</p><div class=\"classGrid\"><div class=\"field\"><label>Qualificação</label>'+sel(\"qlf\",c.qualificacao||\"\")+'</div><div class=\"field\"><label>Reputação</label>'+sel(\"rpt\",c.reputacao||\"\")+'</div><div class=\"field\"><label>Capacitação</label>'+sel(\"cpt\",c.capacitacao||\"\")+'</div><div class=\"field\"><label>Engajamento</label>'+sel(\"egj\",c.engajamento||\"\")+'</div></div><div class=\"field\"><label>Resumo / observação da análise</label><textarea id=\"resumo\" rows=\"4\">'+e(c.resumo_analitico||\"\")+'</textarea></div><button class=\"btn primary\" onclick=\"saveClass(&quot;'+id+'&quot;)\">Salvar classificação</button></div>';h+='<div class=\"actions\"><button class=\"btn primary\" onclick=\"exportDetailed(&quot;evaluation&quot;,&quot;'+id+'&quot;)\">Exportar esta avaliação</button><button class=\"btn ghost\" onclick=\"openSector('+d.setor+')\">Voltar ao setor</button></div>';box.innerHTML=h}catch(x){toast(x.message)}};\nwindow.saveClass=async function(id){var p={avaliacao_id:id,qualificacao:document.getElementById(\"qlf\").value,reputacao:document.getElementById(\"rpt\").value,capacitacao:document.getElementById(\"cpt\").value,engajamento:document.getElementById(\"egj\").value,resumo:document.getElementById(\"resumo\").value};if(!p.qualificacao||!p.reputacao||!p.capacitacao||!p.engajamento){toast(\"Classifique as quatro dimensões.\");return}try{await api(\"save_classification\",p);toast(\"Classificação salva.\")}catch(x){toast(x.message)}};\nwindow.resetPin=async function(n){try{var d=await api(\"reset_coordinator_pin\",{setor:n});box.innerHTML='<div class=\"ey\">ACESSO DO COORDENADOR</div><h2>Setor '+n+'</h2><div class=\"warning\"><strong>Guarde esta senha agora.</strong><br>Ela é mostrada somente neste momento. Redefinir novamente invalida todas as sessões anteriores.</div><div class=\"linkbox\"><strong>ROL '+e(d.rol)+'</strong><br><span style=\"font-size:28px;letter-spacing:.18em\">'+e(d.pin)+'</span></div><div class=\"actions\"><button class=\"btn primary\" onclick=\"copyCred(&quot;'+e(d.rol)+'&quot;,&quot;'+e(d.pin)+'&quot;)\">Copiar credenciais</button><button class=\"btn ghost\" onclick=\"closeM()\">Fechar</button></div>';back.classList.add(\"show\");await boot(true)}catch(x){toast(x.message)}};\nwindow.copyCred=async function(r,p){try{await navigator.clipboard.writeText(\"ROL: \"+r+\"\\nSenha: \"+p);toast(\"Credenciais copiadas.\")}catch(x){toast(\"Não foi possível copiar automaticamente.\")}};\nwindow.revoke=async function(n){if(!confirm(\"Revogar o login do coordenador do Setor \"+n+\"?\"))return;try{await api(\"revoke_coordinator\",{setor:n});toast(\"Acesso revogado.\");await boot(true)}catch(x){toast(x.message)}};\nasync function boot(silent){S.access=sessionStorage.getItem(\"r27a\")||S.access;S.refresh=sessionStorage.getItem(\"r27r\")||S.refresh;if(!S.access){loginView();return}try{S.data=await api(\"bootstrap\");S.admin=S.data.admin;render()}catch(x){if(!silent){clearSession();loginView(x.message)}else toast(x.message)}}\nboot();\n</script></body></html>";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type, authorization","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
function fail(message:string,status=400){return json({ok:false,error:message},status)}
function b64url(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
async function hashPin(pin:string){const salt=crypto.getRandomValues(new Uint8Array(16)),iter=210000,key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]),bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:iter},key,256);return "pbkdf2-sha256$"+iter+"$"+b64url(salt)+"$"+b64url(new Uint8Array(bits))}
function genPin(){const limit=Math.floor(4294967296/1000000)*1000000;let x=0;do{x=crypto.getRandomValues(new Uint32Array(1))[0]}while(x>=limit);return String(x%1000000).padStart(6,"0")}
async function resolveAdmin(req:Request){const h=req.headers.get("authorization")??"";if(!h.startsWith("Bearer "))return null;const{data,error}=await db.auth.getUser(h.slice(7).trim());if(error||!data.user)return null;const{data:a}=await db.from("usuarios_admin").select("user_id,papel,nome_exibicao,ativo").eq("user_id",data.user.id).eq("ativo",true).maybeSingle();return a?{user:data.user,admin:a}:null}
function canOperate(ctx:any){return ctx.admin.papel==="superadmin"||ctx.admin.papel==="secretario_geral"}
async function audit(ctx:any,acao:string,entidade:string,id:string,detalhes:any={}){await db.from("auditoria_sistema").insert({user_id:ctx.user.id,papel:ctx.admin.papel,acao,entidade,entidade_id:id,detalhes})}
async function cycle(){const{data,error}=await db.from("ciclos_rodizio").select("id,ano,ano_base,nome,status").eq("ano",2027).single();if(error)throw error;return data}
async function sectorContext(n:number){const c=await cycle();const{data:s}=await db.from("setores").select("id,numero,area").eq("numero",n).single();const{data:coord}=await db.from("coordenacoes_setor").select("id,obreiro_rol,coordenador_nome_snapshot").eq("ciclo_id",c.id).eq("setor_id",s.id).single();const{data:cred}=await db.from("coordenador_credenciais").select("id,rol_login,status,ultimo_login_em,bloqueado_ate").eq("coordenacao_id",coord.id).single();return{c,s,coord,cred}}
async function planningSnapshot(ctx:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const c=await cycle();
 const [{data:state,error:stateErr},{data:slots,error:slotErr},{data:history,error:historyErr}]=await Promise.all([
  db.from("rod27_planejamento").select("ciclo_id,ano,status,revisao,atualizado_em").eq("ciclo_id",c.id).single(),
  db.from("rod27_planejamento_posicoes").select("id,tipo,destino_id,obreiro_rol,nome_snapshot,foto_url_snapshot").eq("ciclo_id",c.id),
  db.from("rod27_planejamento_eventos").select("id,revisao,tipo,acao,autor,antes,depois,observacao,criado_em")
   .eq("ciclo_id",c.id).order("revisao",{ascending:false}).limit(30)
 ]);
 if(stateErr||slotErr||historyErr)throw stateErr??slotErr??historyErr;
 const actors=[...new Set((history??[]).map((x:any)=>x.autor))];
 let names=new Map<string,string>();
 if(actors.length){
  const {data:users,error:userErr}=await db.from("usuarios_admin").select("user_id,nome_exibicao").in("user_id",actors);
  if(!userErr)names=new Map((users??[]).map((u:any)=>[u.user_id,u.nome_exibicao]));
 }
 return{ok:true,ano:2027,planejamento:state,slots:slots??[],
  historico:(history??[]).map((row:any)=>({...row,autor_nome:names.get(row.autor)??"Secretaria"})),
  somente_proposta:true};
}
async function planningMove(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const p={
  p_destino:String(b.destino_id??""),p_rol:String(b.rol??"").trim(),
  p_tipo:String(b.tipo??""),p_revisao:Number(b.revisao),p_autor:ctx.user.id
 };
 if(!/^[a-f0-9-]{36}$/i.test(p.p_destino)||!/^[0-9]{1,12}$/.test(p.p_rol)||
  !["coordenador","dirigente"].includes(p.p_tipo)||!Number.isInteger(p.p_revisao))
  throw new Error("Movimentação inválida.");
 const{data,error}=await db.rpc("rod27_planejamento_mover",p);
 if(error)throw error;
 await audit(ctx,"planejamento_2027_movimentar","rod27_planejamento",String(data?.revisao),{
  tipo:p.p_tipo,destino_id:p.p_destino,rol:p.p_rol,troca:data?.troca===true});
 return data;
}
async function planningUndo(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const rev=Number(b.revisao);
 if(!Number.isInteger(rev)||rev<1)throw new Error("Revisão inválida.");
 const{data,error}=await db.rpc("rod27_planejamento_desfazer",{p_revisao:rev,p_autor:ctx.user.id});
 if(error)throw error;
 await audit(ctx,"planejamento_2027_desfazer","rod27_planejamento",String(data?.revisao),{desfeita:data?.revisao_desfeita});
 return data;
}
async function planningFind(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const term=String(b.busca??"").trim();
 if(term.length<2||term.length>70)throw new Error("Informe pelo menos dois caracteres.");
 let query=db.schema("private").from("obreiros").select("rol,nome,foto_url").order("nome").limit(20);
 if(/^[0-9]+$/.test(term))query=query.ilike("rol",term+"%");
 else query=query.ilike("nome","%"+term.replace(/[%_]/g,"")+"%");
 const{data,error}=await query;
 if(error)throw error;
 return{ok:true,pessoas:data??[]};
}
async function map2026(ctx:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const [{data:sectors,error:se},{data:churches,error:ce},{data:assignments,error:de},
 {data:cycle,error:ye}]=await Promise.all([
  db.from("setores").select("id,numero,area,ativo").eq("ativo",true).order("numero"),
  db.from("congregacoes").select("id,codigo_origem,nome,area,setor,ativo").eq("ativo",true).order("nome"),
  db.from("designacoes").select("id,congregacao_id,obreiro_rol,dirigente_nome_snapshot,dirigente_foto_url_snapshot,vigencia_ano,atual,atualizado_em")
    .eq("vigencia_ano",2026).eq("atual",true),
  db.from("ciclos_rodizio").select("id,ano_base").eq("ano",2027).eq("ano_base",2026).maybeSingle()
 ]);
 if(se||ce||de||ye)throw se??ce??de??ye;
 if(!cycle)throw new Error("Base 2026 de coordenações indisponível.");
 const {data:coords,error:coerr}=await db.from("coordenacoes_setor")
   .select("id,setor_id,obreiro_rol,coordenador_nome_snapshot,ano_base_designacao")
   .eq("ciclo_id",cycle.id).eq("ano_base_designacao",2026);
 if(coerr)throw coerr;
 const {data:evaluations,error:evError}=await db.from("avaliacoes_dirigente")
  .select("id,congregacao_id,dirigente_rol,status,enviada_em,origem_preenchimento")
  .eq("ciclo_id",cycle.id).eq("eh_proprio_coordenador",false);
 if(evError)throw evError;
 const evalIndex=new Map<string,any[]>();
 for(const ev of evaluations??[]){
  const index=ev.congregacao_id+"::"+ev.dirigente_rol;
  const matches=evalIndex.get(index)??[];
  matches.push(ev);evalIndex.set(index,matches);
 }
 const perSector=new Map((sectors??[]).map((x:any)=>[x.id,x]));
 const byArea=new Map<string,any>();
 const byNumber=new Map<number,any>();
 for(const sec of sectors??[]){
  const area=String(sec.area??"Sem área");
  if(!byArea.has(area))byArea.set(area,{codigo:area,setores:[]});
  const item={numero:sec.numero,id:sec.id,area,coordenador:null as any,congregacoes:[] as any[]};
  byArea.get(area).setores.push(item);byNumber.set(sec.numero,item);
 }
 for(const coord of coords??[]){
  const sec=perSector.get(coord.setor_id);
  const item=sec?byNumber.get(sec.numero):null;
  if(item)item.coordenador={id:coord.id,nome:coord.coordenador_nome_snapshot,rol:coord.obreiro_rol,
    foto_url:(assignments??[]).find((x:any)=>x.obreiro_rol===coord.obreiro_rol)?.dirigente_foto_url_snapshot??null,
    fonte:"Coordenações do Rod27, ano-base 2026"};
 }
 const byChurch=new Map<string,any[]>();
 for(const entry of assignments??[]){
  const list=byChurch.get(entry.congregacao_id)??[];
  list.push(entry);
  byChurch.set(entry.congregacao_id,list);
 }
 let absent=0,conflicts=0;
 for(const church of churches??[]){
  const parent=byNumber.get(church.setor);
  if(!parent)continue;
  const list=byChurch.get(church.id)??[];
  if(list.length===0)absent++;
  if(list.length>1)conflicts++;
  const first=list.length===1?list[0]:null;
  const linked=first?(evalIndex.get(church.id+"::"+first.obreiro_rol)??[]):[];
  const matched=linked.length===1?linked[0]:null;
  parent.congregacoes.push({
   id:church.id,codigo:church.codigo_origem,nome:church.nome,area:parent.area,setor:church.setor,
   dirigente:first?{nome:first.dirigente_nome_snapshot,rol:first.obreiro_rol,
     foto_url:first.dirigente_foto_url_snapshot,atualizado_em:first.atualizado_em}:null,
   estado:list.length===1?"identificado":list.length>1?"conflito":"sem_designacao",
   quantidade_designacoes:list.length,
   avaliacao:matched?{id:matched.id,status:matched.status,enviada_em:matched.enviada_em,
    origem:matched.origem_preenchimento,ciclo:2027}:null,
   avaliacao_ambigua:linked.length>1
  });
 }
 const romanValue=(input:string)=>{
  const digits:Record<string,number>={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
  if(/^\d+$/.test(input))return Number(input);
  const u=input.toUpperCase().trim();if(!/^[IVXLCDM]+$/.test(u))return 99999;
  let total=0;for(let i=0;i<u.length;i++){const n=digits[u[i]];total+=n<(digits[u[i+1]]??0)?-n:n}
  return total;
 };
 const collator=new Intl.Collator("pt-BR",{sensitivity:"base",numeric:true});
 const areas=[...byArea.values()].sort((a,b)=>romanValue(a.codigo)-romanValue(b.codigo)||collator.compare(a.codigo,b.codigo));
 for(const area of areas)for(const sector of area.setores){
  sector.congregacoes.sort((a:any,b:any)=>collator.compare(a.nome,b.nome));
 }
 return {
  ok:true,ano:2026,consulta_em:new Date().toISOString(),somente_leitura:true,
  fonte:"Dirigentes: designações vigentes de 2026 no Rod27. Coordenadores: ano-base 2026 registrado nas coordenações do Rodízio 2027. Sem consulta em tempo real ao Propósito.",
  totais:{areas:areas.length,setores:sectors?.length??0,congregacoes:churches?.length??0,
    designacoes:assignments?.length??0,coordenadores:coords?.length??0,
    sem_designacao:absent,conflitos:conflicts},
  areas
 };
}
async function coordinatorContext(setor:number,rol:string){
 if(!Number.isInteger(setor)||setor<1||setor>42||!/^[0-9]{1,12}$/.test(rol))throw new Error("Identificação de coordenação inválida.");
 const c=await cycle();
 const {data:sector,error:sErr}=await db.from("setores").select("id,numero,area").eq("numero",setor).eq("ativo",true).single();
 if(sErr||!sector)throw new Error("Setor não encontrado.");
 const {data:coord,error:cErr}=await db.from("coordenacoes_setor")
   .select("id,ciclo_id,obreiro_rol,coordenador_nome_snapshot,setor_id,ano_base_designacao")
   .eq("setor_id",sector.id).eq("ciclo_id",c.id).eq("obreiro_rol",rol).maybeSingle();
 if(cErr||!coord||coord.ano_base_designacao!==2026)throw new Error("Esta coordenação não corresponde à base de 2026.");
 return{c,sector,coord};
}
async function coordinatorProfile(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const {c,sector,coord}=await coordinatorContext(Number(b.setor),String(b.rol??"").trim());
 const [{data:people,error:pe},{data:manifest,error:me},{data:docs,error:de}]=await Promise.all([
  db.rpc("rod27_obreiro_resumo",{p_rol:coord.obreiro_rol}),
  db.from("manifestacoes_interesse_coordenador")
   .select("status,deseja_permanecer,opcao_movimentacao,justificativa,criado_em,atualizado_em,enviada_em,congregacao_nome_snapshot")
   .eq("ciclo_id",c.id).eq("coordenacao_id",coord.id)
   .eq("coordenador_rol_snapshot",coord.obreiro_rol).maybeSingle(),
  db.from("documentos_coordenador")
   .select("id,nome_original,tipo_mime,tamanho_bytes,enviado_em,sha256")
   .eq("coordenacao_id",coord.id).eq("ciclo_id",c.id)
   .eq("obreiro_rol",coord.obreiro_rol).order("enviado_em",{ascending:false})
 ]);
 if(pe||me||de)throw pe??me??de;
 return{ok:true,ano_base:2026,ciclo_manifestacao:2027,
  coordenador:{id:coord.id,rol:coord.obreiro_rol,nome:people?.[0]?.nome??coord.coordenador_nome_snapshot,
   foto_url:people?.[0]?.foto_url??null,setor:sector.numero,area:sector.area},
  manifestacao:manifest??null,documentos:docs??[]};
}
async function coordinatorUpload(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const {c,coord}=await coordinatorContext(Number(b.setor),String(b.rol??"").trim());
 const nome=String(b.nome??"").trim().replace(/[\r\n\t]/g," ").slice(0,160);
 if(!nome)throw new Error("Informe o nome do documento.");
 const mime=String(b.tipo_mime??"");
 if(!["application/pdf","image/jpeg","image/png"].includes(mime))throw new Error("Envie PDF, JPG ou PNG.");
 const encoded=String(b.base64??"");
 if(!encoded||encoded.length>11185000||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new Error("Arquivo inválido ou maior que 8 MB.");
 const bin=atob(encoded),bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 if(bytes.length===0||bytes.length>8388608)throw new Error("O documento deve ter no máximo 8 MB.");
 const isPdf=bytes.length>4&&bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70,
  isJpeg=bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
  isPng=bytes.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 if(!((mime==="application/pdf"&&isPdf)||(mime==="image/jpeg"&&isJpeg)||(mime==="image/png"&&isPng)))throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("");
 const ext=mime==="application/pdf"?"pdf":mime==="image/jpeg"?"jpg":"png";
 const path="coordenador/"+c.id+"/"+coord.id+"/"+crypto.randomUUID()+"."+ext;
 const {error:storageError}=await db.storage.from("rod27-documentos").upload(path,bytes,{contentType:mime,upsert:false,cacheControl:"private"});
 if(storageError)throw storageError;
 const{data:doc,error:insertError}=await db.from("documentos_coordenador").insert({
  coordenacao_id:coord.id,ciclo_id:c.id,obreiro_rol:coord.obreiro_rol,
  caminho_storage:path,nome_original:nome,tipo_mime:mime,tamanho_bytes:bytes.length,
  sha256,enviado_por:ctx.user.id
 }).select("id").single();
 if(insertError||!doc){
  await db.storage.from("rod27-documentos").remove([path]);
  throw insertError??new Error("Falha ao registrar documento.");
 }
 await audit(ctx,"anexar_documento_coordenador","documentos_coordenador",doc.id,
   {coordenacao_id:coord.id,ciclo_id:c.id,rol:coord.obreiro_rol,sha256,tamanho:bytes.length});
 return{ok:true,documento_id:doc.id,sha256};
}
async function coordinatorDocumentUrl(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Acesso restrito à Secretaria.");
 const {c,coord}=await coordinatorContext(Number(b.setor),String(b.rol??"").trim());
 const id=String(b.documento_id??"");
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error("Documento inválido.");
 const{data:doc,error}=await db.from("documentos_coordenador")
  .select("id,caminho_storage").eq("id",id).eq("coordenacao_id",coord.id)
  .eq("ciclo_id",c.id).eq("obreiro_rol",coord.obreiro_rol).maybeSingle();
 if(error||!doc)throw new Error("Documento indisponível para esta coordenação.");
 const {data, error:signedError}=await db.storage.from("rod27-documentos").createSignedUrl(doc.caminho_storage,300);
 if(signedError||!data?.signedUrl)throw new Error("Não foi possível abrir o documento.");
 await audit(ctx,"consultar_documento_coordenador","documentos_coordenador",id,{coordenacao_id:coord.id});
 return{ok:true,url:data.signedUrl,expira_segundos:300};
}
async function bootstrap(ctx:any){const c=await cycle();const{data:selfSetting}=await db.from("configuracoes_sistema_runtime").select("valor").eq("chave","avaliacao.autoavaliacao.permitida").maybeSingle();const autoavaliacao_permitida=selfSetting?.valor?.permitida===true;const[{data:coords},{data:secs},{data:creds},{data:evals}]=await Promise.all([db.from("coordenacoes_setor").select("id,setor_id,obreiro_rol,coordenador_nome_snapshot").eq("ciclo_id",c.id),db.from("setores").select("id,numero,area"),db.from("coordenador_credenciais").select("coordenacao_id,rol_login,status,ultimo_login_em"),db.from("avaliacoes_dirigente").select("coordenacao_id,status,eh_proprio_coordenador").eq("ciclo_id",c.id).eq("eh_proprio_coordenador",false)]);const sm=new Map((secs??[]).map((x:any)=>[x.id,x])),cm=new Map((creds??[]).map((x:any)=>[x.coordenacao_id,x])),em=new Map<string,any[]>();for(const x of evals??[]){const a=em.get(x.coordenacao_id)??[];a.push(x);em.set(x.coordenacao_id,a)}const rows=(coords??[]).map((x:any)=>{const s=sm.get(x.setor_id),cr=cm.get(x.id),ee=em.get(x.id)??[];return{setor:s.numero,area:s.area,coordenador:x.coordenador_nome_snapshot,rol:x.obreiro_rol,total:ee.length,tratamento_especial:0,nao_iniciadas:ee.filter(z=>z.status==="nao_iniciada").length,em_preenchimento:ee.filter(z=>z.status==="em_preenchimento").length,enviadas:ee.filter(z=>z.status==="enviada").length,credencial_status:cr?.status??"nao_configurada",ultimo_login_em:cr?.ultimo_login_em??null}}).sort((a,b)=>a.setor-b.setor);return{ok:true,autoavaliacao_permitida,admin:{email:ctx.user.email,papel:ctx.admin.papel,nome_exibicao:ctx.admin.nome_exibicao},summary:{setores:rows.length,total:rows.reduce((n,x)=>n+x.total,0),nao_iniciadas:rows.reduce((n,x)=>n+x.nao_iniciadas,0),em_preenchimento:rows.reduce((n,x)=>n+x.em_preenchimento,0),enviadas:rows.reduce((n,x)=>n+x.enviadas,0),credenciais_ativas:rows.filter(x=>x.credencial_status==="ativa").length},sectors:rows}}
async function manifestations(ctx:any){if(!canOperate(ctx))throw new Error("Sem permissão.");const c=await cycle();const[{data:coords,error:cErr},{data:secs,error:sErr},{data:churches,error:gErr},{data:owners,error:oErr},{data:rows,error:mErr}]=await Promise.all([db.from("coordenacoes_setor").select("id,setor_id,obreiro_rol,coordenador_nome_snapshot").eq("ciclo_id",c.id),db.from("setores").select("id,numero,area"),db.from("congregacoes").select("id,nome,setor"),db.from("avaliacoes_dirigente").select("coordenacao_id,congregacao_id,congregacao_nome_snapshot,dirigente_rol,dirigente_nome_snapshot").eq("ciclo_id",c.id).eq("eh_proprio_coordenador",true),db.from("manifestacoes_interesse_coordenador").select("id,coordenacao_id,coordenador_rol_snapshot,coordenador_nome_snapshot,setor_numero_snapshot,congregacao_nome_snapshot,deseja_permanecer,opcao_movimentacao,justificativa,status,criado_em,atualizado_em,enviada_em").eq("ciclo_id",c.id)]);if(cErr||sErr||gErr||oErr||mErr)throw cErr??sErr??gErr??oErr??mErr;const sm=new Map((secs??[]).map((x:any)=>[x.id,x])),gm=new Map((churches??[]).map((x:any)=>[x.id,x])),om=new Map((owners??[]).map((x:any)=>[x.coordenacao_id,x])),mm=new Map((rows??[]).map((x:any)=>[x.coordenacao_id,x]));const list=(coords??[]).map((x:any)=>{const sec=sm.get(x.setor_id),own=om.get(x.id),church=gm.get(own?.congregacao_id),m=mm.get(x.id);if(!sec||!own||!church||own.dirigente_rol!==x.obreiro_rol||own.dirigente_nome_snapshot!==x.coordenador_nome_snapshot||own.congregacao_nome_snapshot!==church.nome||church.setor!==sec.numero)throw new Error("Identificação de coordenação ou setor inconsistente.");return{id:m?.id??null,status:m?.status??"pendente",coordenador_rol_snapshot:x.obreiro_rol,coordenador_nome_snapshot:x.coordenador_nome_snapshot,setor_numero_snapshot:sec.numero,area:sec.area,congregacao_id:own.congregacao_id,congregacao_nome_snapshot:own.congregacao_nome_snapshot,deseja_permanecer:m?.deseja_permanecer??null,opcao_movimentacao:m?.opcao_movimentacao??null,justificativa:m?.justificativa??null,criado_em:m?.criado_em??null,atualizado_em:m?.atualizado_em??null,enviada_em:m?.enviada_em??null}}).sort((a,b)=>a.setor_numero_snapshot-b.setor_numero_snapshot);return{ok:true,manifestations:list}}async function sector(n:number){const x=await sectorContext(n);const{data:e,error}=await db.from("avaliacoes_dirigente").select("id,congregacao_nome_snapshot,dirigente_nome_snapshot,dirigente_foto_url_snapshot,status,eh_proprio_coordenador,iniciada_em,enviada_em").eq("ciclo_id",x.c.id).eq("coordenacao_id",x.coord.id).eq("eh_proprio_coordenador",false).order("congregacao_nome_snapshot");if(error)throw error;return{ok:true,setor:x.s.numero,area:x.s.area,coordenador:x.coord.coordenador_nome_snapshot,evaluations:e??[]}}
async function evaluation(id:string){const{data:e,error}=await db.from("avaliacoes_dirigente").select("id,ciclo_id,coordenacao_id,congregacao_nome_snapshot,dirigente_nome_snapshot,status,enviada_em,eh_proprio_coordenador,formulario_versao,formulario_snapshot").eq("id",id).eq("eh_proprio_coordenador",false).maybeSingle();if(error||!e||e.status!=="enviada")return null;const[{data:q},{data:a},{data:c}]=await Promise.all([db.from("perguntas_avaliacao").select("id,titulo,ordem").eq("ciclo_id",e.ciclo_id).eq("ativa",true).eq("status","publicada").order("ordem"),db.from("respostas_avaliacao").select("pergunta_id,resposta_texto,resposta_opcao").eq("avaliacao_id",e.id),db.from("classificacoes_avaliacao").select("*").eq("avaliacao_id",e.id).maybeSingle()]);const am=new Map((a??[]).map((z:any)=>[z.pergunta_id,z]));const answerQuestions=Array.isArray(e.formulario_snapshot?.questions)?e.formulario_snapshot.questions:(q??[]);const answers=answerQuestions.map((z:any)=>{const r=am.get(z.id);return{titulo:z.titulo,resposta:r?.resposta_texto??r?.resposta_opcao??""}});const{data:co}=await db.from("coordenacoes_setor").select("setor_id").eq("id",e.coordenacao_id).single();const{data:s}=await db.from("setores").select("numero").eq("id",co.setor_id).single();return{ok:true,evaluation:e,answers,classification:c,setor:s.numero}}

async function exportDetailed(ctx:any,b:any){
 if(!canOperate(ctx))throw Error("Acesso restrito.");
 const mode=String(b.scope??"all");
 if(!["all","sector","evaluation"].includes(mode))throw Error("Escopo inválido.");
 const sectorId=Number(b.setor),evalId=String(b.avaliacao_id??"");
 if(mode==="sector"&&(!Number.isInteger(sectorId)||sectorId<1||sectorId>42))throw Error("Setor inválido.");
 if(mode==="evaluation"&&!/^[a-f0-9-]{36}$/i.test(evalId))throw Error("Avaliação inválida.");
 const c=await cycle();
 const [{data:secs,error:serr},{data:coords,error:cerr},{data:published,error:perr}]=await Promise.all([
  db.from("setores").select("id,numero,area"),
  db.from("coordenacoes_setor").select("id,setor_id,obreiro_rol,coordenador_nome_snapshot").eq("ciclo_id",c.id),
  db.from("perguntas_avaliacao").select("id,titulo,enunciado,ordem,codigo").eq("ciclo_id",c.id).eq("ativa",true).eq("status","publicada").order("ordem")
 ]);
 if(serr||cerr||perr)throw serr??cerr??perr;
 const sm=new Map((secs??[]).map((x:any)=>[x.id,x]));
 const cm=new Map((coords??[]).map((x:any)=>[x.id,x]));
 let evaluations:any[]=[];
 for(let page=0;page<25;page++){
  let q=db.from("avaliacoes_dirigente").select("id,ciclo_id,coordenacao_id,dirigente_rol,dirigente_nome_snapshot,congregacao_nome_snapshot,status,enviada_em,formulario_versao,formulario_snapshot,origem_preenchimento").eq("ciclo_id",c.id).eq("status","enviada").eq("eh_proprio_coordenador",false).order("id").range(page*400,(page+1)*400-1);
  if(mode==="evaluation")q=q.eq("id",evalId);
  const {data,error}=await q;
  if(error)throw error;
  evaluations.push(...(data??[]));
  if((data??[]).length<400)break;
 }
 if(mode==="evaluation"&&!evaluations.length)throw Error("Nenhuma avaliação enviada foi encontrada.");
 const evals=evaluations.filter((ev:any)=>{
  const co=cm.get(ev.coordenacao_id),sec=sm.get(co?.setor_id);
  return co&&sec&&(mode!=="sector"||sec.numero===sectorId);
 });
 const answerMap=new Map<string,any[]>();
 for(let i=0;i<evals.length;i+=10){
  const ids=evals.slice(i,i+10).map((x:any)=>x.id);
  const {data,error}=await db.from("respostas_avaliacao").select("avaliacao_id,pergunta_id,resposta_texto,resposta_opcao").in("avaliacao_id",ids).limit(1000);
  if(error)throw error;
  for(const r of data??[]){const list=answerMap.get(r.avaliacao_id)??[];list.push(r);answerMap.set(r.avaliacao_id,list);}
 }
 const rows:any[]=[];
 for(const ev of evals){
  const co=cm.get(ev.coordenacao_id),sec=sm.get(co.setor_id);
  const questions=Array.isArray(ev.formulario_snapshot?.questions)?ev.formulario_snapshot.questions:(published??[]);
  const answers=new Map((answerMap.get(ev.id)??[]).map((x:any)=>[x.pergunta_id,x]));
  for(const q of questions){
   const answer:any=answers.get(q.id);
   rows.push({
    area:sec.area,setor:sec.numero,coordenador:co.coordenador_nome_snapshot,coordenador_rol:co.obreiro_rol,
    congregacao:ev.congregacao_nome_snapshot,dirigente:ev.dirigente_nome_snapshot,dirigente_rol:ev.dirigente_rol,
    avaliacao_id:ev.id,versao:ev.formulario_versao,origem:ev.origem_preenchimento,
    enviada_em:ev.enviada_em,pergunta_numero:q.ordem,pergunta:q.enunciado||q.titulo,
    resposta:answer?.resposta_texto??answer?.resposta_opcao??""
   });
  }
 }
 const areaNumber=(a:any)=>{const n=String(a??"").match(/\d+/);return n?Number(n[0]):999;};
 rows.sort((a,b)=>areaNumber(a.area)-areaNumber(b.area)||Number(a.setor)-Number(b.setor)||
 String(a.congregacao).localeCompare(String(b.congregacao),"pt-BR")||
 Number(a.pergunta_numero)-Number(b.pergunta_numero));
 return{ok:true,scope:mode,rows,total_avaliacoes:evals.length,total_respostas:rows.length};
}
async function resetPin(ctx:any,n:number){if(!canOperate(ctx))throw new Error("Sem permissão.");const x=await sectorContext(n),pin=genPin(),hash=await hashPin(pin);const{data,error}=await db.rpc("rod27_reset_coordinator_pin",{p_cred_id:x.cred.id,p_pin:pin,p_hash:hash,p_admin:ctx.user.id});if(error)throw error;return{ok:true,setor:n,rol:data?.[0]?.rol??x.coord.obreiro_rol,pin}}
async function revoke(ctx:any,n:number){if(!canOperate(ctx))throw new Error("Sem permissão.");const x=await sectorContext(n);await db.from("coordenador_sessoes").update({revogada_em:new Date().toISOString()}).eq("credencial_id",x.cred.id).is("revogada_em",null);const{error}=await db.from("coordenador_credenciais").update({status:"revogada"}).eq("id",x.cred.id);if(error)throw error;await audit(ctx,"revoke_coordinator","coordenador_credenciais",x.cred.id,{setor:n});return{ok:true}}
async function saveClass(ctx:any,b:any){if(!canOperate(ctx))throw new Error("Sem permissão.");const evaluationId=String(b.avaliacao_id??"").trim();if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(evaluationId))throw new Error("Avaliação inválida.");const currentCycle=await cycle();const{data:targetEval,error:targetError}=await db.from("avaliacoes_dirigente").select("status").eq("id",evaluationId).eq("ciclo_id",currentCycle.id).maybeSingle();if(targetError||!targetEval||targetEval.status!=="enviada")throw new Error("A avaliação precisa estar enviada para classificação.");const allowed=["pessimo","ruim","mediano","bom","excelente"];for(const k of["qualificacao","reputacao","capacitacao","engajamento"])if(!allowed.includes(String(b[k])))throw new Error("Classificação inválida.");const payload={avaliacao_id:evaluationId,status:"validada",qualificacao:b.qualificacao,reputacao:b.reputacao,capacitacao:b.capacitacao,engajamento:b.engajamento,resumo_analitico:String(b.resumo??"").trim()||null,validado_por:ctx.user.id,validado_em:new Date().toISOString(),atualizado_em:new Date().toISOString()};const{error}=await db.from("classificacoes_avaliacao").upsert(payload,{onConflict:"avaliacao_id"});if(error)throw error;await audit(ctx,"classify_evaluation","avaliacoes_dirigente",payload.avaliacao_id,{qualificacao:b.qualificacao,reputacao:b.reputacao,capacitacao:b.capacitacao,engajamento:b.engajamento});return{ok:true}}
async function blankForm(ctx:any,b:any){
 const current=await cycle();
 const [{data:questions,error:qErr},{data:form,error:fErr}]=await Promise.all([
  db.from("perguntas_avaliacao").select("id,ordem,codigo,titulo,enunciado,tipo_resposta,opcoes,obrigatoria,status,ativa").eq("ciclo_id",current.id).eq("ativa",true).eq("status","publicada").order("ordem"),
  db.from("configuracoes_avaliacao").select("status,versao,titulo_aviso,texto_aviso").eq("ciclo_id",current.id).order("versao",{ascending:false}).limit(1).maybeSingle()
 ]);
 if(qErr||fErr)throw qErr??fErr;
 if(!questions?.length)throw new Error("Não há perguntas cadastradas.");
 let sectorInfo:any=null;
 const num=Number(b.setor);
 if(Number.isInteger(num)&&num>0&&num<=42){
  const sectorData=await sectorContext(num);
  sectorInfo={numero:sectorData.s.numero,area:sectorData.s.area,coordenador:sectorData.coord.coordenador_nome_snapshot,rol:sectorData.coord.obreiro_rol};
 }
 return{ok:true,form:{status:form?.status??"rascunho",versao:form?.versao??1,title:form?.titulo_aviso??"",notice:form?.texto_aviso??""},sector:sectorInfo,questions};
}

async function officeLookup(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Sem autorização para editar.");
 const rol=String(b.rol??"").trim();
 if(!/^[0-9]{1,12}$/.test(rol))throw new Error("Informe um ROL numérico válido.");
 const {data,error}=await db.rpc("rod27_obreiro_resumo",{p_rol:rol});
 if(error)throw error;
 if(!data?.length)throw new Error("ROL não encontrado no fichário.");
 return{ok:true,obreiro:data[0]};
}
async function officeReplacePastor(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Sem autorização para editar.");
 const id=String(b.avaliacao_id??"");
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error("Avaliação inválida.");
 const {data,error}=await db.rpc("rod27_substituir_dirigente",{p_avaliacao_id:id,p_novo_rol:String(b.rol??""),p_admin:ctx.user.id});
 if(error)throw error;
 return{ok:true,obreiro:data?.[0]};
}
async function officeChangeCoordinator(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Sem autorização para editar.");
 const setor=Number(b.setor),rol=String(b.rol??"").trim();
 if(!Number.isInteger(setor)||setor<1||setor>42||!/^[0-9]{1,12}$/.test(rol))throw new Error("Setor ou ROL inválido.");
 const pin=genPin(),hash=await hashPin(pin);
 const {data,error}=await db.rpc("rod27_change_coordinator_with_pin",{p_setor:setor,p_novo_rol:rol,p_novo_hash:hash,p_novo_pin:pin,p_admin:ctx.user.id});
 if(error)throw error;
 return{ok:true,coordenador:data?.[0],pin};
}
async function requireCurrentEval(id:string){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error("ID de avaliação inválido.");
 const c=await cycle();
 const {data,error}=await db.from("avaliacoes_dirigente").select("id,ciclo_id,coordenacao_id,congregacao_nome_snapshot,dirigente_nome_snapshot,status,origem_preenchimento,dirigente_rol,eh_proprio_coordenador").eq("id",id).eq("ciclo_id",c.id).eq("eh_proprio_coordenador",false).maybeSingle();
 if(error||!data)throw new Error("Ficha não encontrada no ciclo 2027.");
 return data;
}
async function officeDocuments(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Permissão insuficiente para consultar rascunhos e documentos originais.");
 const evalId=String(b.avaliacao_id??"");
 await requireCurrentEval(evalId);
 const {data,error}=await db.from("documentos_avaliacao").select("id,nome_original,tipo_mime,tamanho_bytes,sha256,enviado_em,status_ocr").eq("avaliacao_id",evalId).order("enviado_em",{ascending:false});
 if(error)throw error;
 return{ok:true,documentos:data??[]};
}
async function officeDocumentUrl(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Permissão insuficiente para consultar rascunhos e documentos originais.");
 const id=String(b.documento_id??"");
 if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error("Documento inválido.");
 const{data:doc,error}=await db.from("documentos_avaliacao").select("id,caminho_storage,avaliacao_id").eq("id",id).maybeSingle();
 if(error||!doc)throw new Error("Documento não encontrado.");
 await requireCurrentEval(doc.avaliacao_id);
 const {data, error:signErr}=await db.storage.from("rod27-documentos").createSignedUrl(doc.caminho_storage,300);
 if(signErr||!data?.signedUrl)throw signErr??new Error("Não foi possível abrir o documento.");
 await audit(ctx,"consultar_documento","documentos_avaliacao",id,{avaliacao_id:doc.avaliacao_id});
 return{ok:true,url:data.signedUrl,expira_segundos:300};
}
async function officeUploadDocument(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Sem autorização para anexar.");
 const evalId=String(b.avaliacao_id??"");
 await requireCurrentEval(evalId);
 const nome=String(b.nome??"documento").trim().replace(/[\\r\\n\\t]/g," ").slice(0,160);
 const mime=String(b.tipo_mime??"");
 if(!["application/pdf","image/jpeg","image/png"].includes(mime))throw new Error("Envie PDF, JPG ou PNG.");
 const encoded=String(b.base64??"");
 if(!encoded||encoded.length>11185000||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new Error("Documento inválido ou maior que 8 MB.");
 const bin=atob(encoded),bytes=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 if(bytes.length===0||bytes.length>8388608)throw new Error("O documento deve ter no máximo 8 MB.");
 const isPdf=bytes.length>4&&bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70,
       isJpeg=bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,
       isPng=bytes.length>8&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
 if(!((mime==="application/pdf"&&isPdf)||(mime==="image/jpeg"&&isJpeg)||(mime==="image/png"&&isPng)))throw new Error("Tipo real do arquivo não corresponde à extensão.");
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("");
 const ext=mime==="application/pdf"?"pdf":mime==="image/jpeg"?"jpg":"png";
 const path="aval/"+evalId+"/"+crypto.randomUUID()+"."+ext;
 const{error:uploadError}=await db.storage.from("rod27-documentos").upload(path,bytes,{contentType:mime,upsert:false,cacheControl:"private"});
 if(uploadError)throw uploadError;
 const{data:doc,error:dbErr}=await db.from("documentos_avaliacao").insert({avaliacao_id:evalId,caminho_storage:path,nome_original:nome,tipo_mime:mime,tamanho_bytes:bytes.length,sha256:hash,enviado_por:ctx.user.id,status_ocr:"nao_processado"}).select("id").single();
 if(dbErr||!doc){await db.storage.from("rod27-documentos").remove([path]);throw dbErr??new Error("Falha ao cadastrar o documento.");}
 await audit(ctx,"upload_documento_assinado","documentos_avaliacao",doc.id,{avaliacao_id:evalId,sha256:hash,tamanho:bytes.length});
 return{ok:true,documento_id:doc.id,sha256:hash};
}
async function officeTranscription(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Permissão insuficiente para consultar rascunhos e documentos originais.");
 const ev=await requireCurrentEval(String(b.avaliacao_id??""));
 if(ev.status==="enviada")throw new Error("A ficha já foi enviada; consulte a avaliação.");
 const [{data:questions,error:qErr},{data:draft,error:dErr},{data:docs,error:docErr}]=await Promise.all([
  db.from("perguntas_avaliacao").select("id,titulo,enunciado,tipo_resposta,opcoes,ordem,obrigatoria,status").eq("ciclo_id",ev.ciclo_id).eq("ativa",true).eq("status","publicada").order("ordem"),
  db.from("transcricoes_secretaria").select("respostas,documento_id,transcrito_por,atualizado_em").eq("avaliacao_id",ev.id).maybeSingle(),
  db.from("documentos_avaliacao").select("id,nome_original,tipo_mime,tamanho_bytes,enviado_em").eq("avaliacao_id",ev.id).order("enviado_em",{ascending:false})
 ]);
 if(qErr||dErr||docErr)throw qErr??dErr??docErr;
 return{ok:true,avaliacao:ev,perguntas:questions??[],rascunho:draft,documentos:docs??[]};
}
async function officeSaveTranscription(ctx:any,b:any){
 if(!canOperate(ctx))throw new Error("Sem autorização para transcrever.");
 const ev=await requireCurrentEval(String(b.avaliacao_id??""));
 if(ev.status==="enviada")throw new Error("A ficha já foi enviada.");
 const respostas=Array.isArray(b.respostas)?b.respostas:[];
 if(respostas.length>80)throw new Error("Quantidade de respostas inválida.");
 const doc=b.documento_id?String(b.documento_id):null;
 if(doc&&!/^[a-f0-9-]{36}$/i.test(doc))throw new Error("Documento inválido.");
 const{data,error}=await db.rpc("rod27_salvar_transcricao",{p_avaliacao:ev.id,p_admin:ctx.user.id,p_respostas:respostas,p_documento:doc,p_finalizar:b.finalizar===true});
 if(error)throw error;
 return{ok:true,resultado:data?.[0]};
}
async function handle(req:Request){const ctx=await resolveAdmin(req);if(!ctx)return fail("Sessão inválida ou conta não autorizada.",401);let b:any;try{b=await req.json()}catch{return fail("Requisição inválida.",400)};try{switch(String(b.action??"")){case"bootstrap":return json(await bootstrap(ctx));case"map_2026":return json(await map2026(ctx));case"planning_snapshot":return json(await planningSnapshot(ctx));case"planning_move":return json(await planningMove(ctx,b));case"planning_undo":return json(await planningUndo(ctx,b));case"planning_find":return json(await planningFind(ctx,b));case"coordinator_profile":return json(await coordinatorProfile(ctx,b));case"coordinator_document_upload":return json(await coordinatorUpload(ctx,b));case"coordinator_document_url":return json(await coordinatorDocumentUrl(ctx,b));case"manifestations":return json(await manifestations(ctx));case"export_detailed":return json(await exportDetailed(ctx,b));case"blank_form":return json(await blankForm(ctx,b));case"office_lookup_obreiro":return json(await officeLookup(ctx,b));case"office_replace_dirigente":return json(await officeReplacePastor(ctx,b));case"office_change_coordinator":return json(await officeChangeCoordinator(ctx,b));case"office_documents":return json(await officeDocuments(ctx,b));case"office_document_url":return json(await officeDocumentUrl(ctx,b));case"office_upload_document":return json(await officeUploadDocument(ctx,b));case"office_transcription":return json(await officeTranscription(ctx,b));case"office_save_transcription":return json(await officeSaveTranscription(ctx,b));case"sector":return json(await sector(Number(b.setor)));case"evaluation":{const d=await evaluation(String(b.avaliacao_id??""));return d?json(d):fail("Avaliação não encontrada.",404)}case"reset_coordinator_pin":return json(await resetPin(ctx,Number(b.setor)));case"revoke_coordinator":return json(await revoke(ctx,Number(b.setor)));case"save_classification":return json(await saveClass(ctx,b));default:return fail("Ação desconhecida.",400)}}catch(e){console.error(e);return fail(e instanceof Error?e.message:"Falha administrativa.",500)}}
Deno.serve(async(req:Request)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method==="GET")return new Response(PAGE_HTML,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Frame-Options":"DENY","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});if(req.method==="POST")return handle(req);return new Response("Method not allowed",{status:405,headers:cors})});