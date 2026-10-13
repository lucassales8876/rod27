import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { sql,post,authUser,status,fixtures,expect } from './common.mjs';

sql(`truncate public.auditoria_sistema,private.coordinator_pin_vault,public.coordenador_sessoes,
 public.coordenador_credenciais,public.avaliacoes_dirigente,public.paginas_coordenador,
 public.coordenacoes_setor,public.setores,public.ciclos_rodizio,private.obreiros,
 public.configuracoes_sistema_runtime cascade;`);
sql(readFileSync(resolve(fixtures,'fixture-data.sql'),'utf8'));
sql(`insert into private.obreiros values('900004','Avaliador Coordenador Fictício'),('900005','Avaliador Externo Fictício');
 insert into public.setores(numero) values(2);
 insert into public.coordenacoes_setor(ciclo_id,setor_id,obreiro_rol,coordenador_nome_snapshot)
 select c.id,s.id,'900004','Avaliador Coordenador Fictício' from public.ciclos_rodizio c cross join public.setores s where s.numero=2;
 insert into public.coordenador_credenciais(coordenacao_id,rol_login,senha_hash)
 select id,'900004',extensions.crypt('000456',extensions.gen_salt('bf',10)) from public.coordenacoes_setor where obreiro_rol='900004';
 insert into public.paginas_coordenador(coordenacao_id,ciclo_id) select id,ciclo_id from public.coordenacoes_setor where obreiro_rol='900004';
 insert into public.avaliacoes_dirigente(coordenacao_id,ciclo_id,dirigente_rol,eh_proprio_coordenador)
 select id,ciclo_id,'900004',true from public.coordenacoes_setor where obreiro_rol='900004';
 insert into public.configuracoes_avaliacao(ciclo_id,titulo_aviso,texto_aviso) select id,'Aviso fictício','Apenas teste local' from public.ciclos_rodizio;
 insert into public.perguntas_avaliacao(ciclo_id,codigo,categoria,titulo,enunciado,tipo_resposta,ordem,obrigatoria)
 select id,'FICTICIA_1','Teste','Pergunta fictícia obrigatória','Descreva o cenário fictício','texto_longo',1,true from public.ciclos_rodizio;
 insert into public.perguntas_avaliacao(ciclo_id,codigo,categoria,titulo,enunciado,tipo_resposta,ordem,obrigatoria,opcoes)
 select id,'FICTICIA_2','Teste','Pergunta fictícia opcional','Escolha fictícia','escolha_unica',2,false,'["Opção fictícia"]'::jsonb from public.ciclos_rodizio;`);
const admin=await authUser('admin@rod27.test','Ficticio-Apenas-Local-2026!');
const reviewer=await authUser('revisor@rod27.test','Ficticio-Apenas-Local-2026!');
const outsider=await authUser('sem-permissao@rod27.test','Ficticio-Apenas-Local-2026!');
sql(`insert into public.usuarios_admin(user_id,papel,nome_exibicao,rol) values
 ('${admin.user.id}','superadmin','Secretaria Fictícia',null),('${reviewer.user.id}','revisor','Revisor Fictício','900005')
 on conflict(user_id) do update set papel=excluded.papel,nome_exibicao=excluded.nome_exibicao,rol=excluded.rol,ativo=true;`);
const secret=(body,token=admin.access_token)=>post('/functions/v1/rod27-special',body,{Authorization:'Bearer '+token});
const coordinator=body=>post('/functions/v1/rod27-coordinator',body);
const owner=await coordinator({action:'login',rol:'900001',senha:'000123'});expect(owner,200,'login fictício do titular');
const evaluator=await coordinator({action:'login',rol:'900004',senha:'000456'});expect(evaluator,200,'login fictício do avaliador');
const byCoordinator=(token,body)=>post('/functions/v1/rod27-special',body,{'x-rod27-session':token});
const ownerAction=body=>post('/functions/v1/rod27-coordinator',body,{'x-rod27-session':owner.data.session_token});
const ids=JSON.parse(sql(`select jsonb_object_agg(dirigente_rol,id) from public.avaliacoes_dirigente;`));
const questions=JSON.parse(sql(`select jsonb_object_agg(codigo,id) from public.perguntas_avaliacao;`));
const required={pergunta_id:questions.FICTICIA_1,resposta:'Relato inteiramente fictício para teste.'};
const optional={pergunta_id:questions.FICTICIA_2,resposta:'Opção fictícia'};
expect(await secret({action:'list'}),409,'regra bloqueada por padrão');
sql(`insert into public.configuracoes_sistema_runtime values('fichas_especiais.aprovacao','{"aprovada":true,"referencia":"AUTORIZAÇÃO FICTÍCIA APENAS LOCAL"}');`);
expect(await post('/functions/v1/rod27-special',{action:'list'}),401,'acesso anônimo');
expect(await secret({action:'list',p_user:admin.user.id},outsider.access_token),403,'identidade não pode ser forjada');
assert.equal(sql(`select has_function_privilege('authenticated','public.rod27_special_command(text,uuid,uuid,uuid,jsonb)','execute')::text`),'false');
assert.equal(sql(`select has_table_privilege('authenticated','public.avaliacoes_especiais','select')::text`),'false');
const direct=await fetch(status.API_URL+'/rest/v1/avaliacoes_especiais',{headers:{apikey:status.PUBLISHABLE_KEY,Authorization:'Bearer '+outsider.access_token}});
assert.equal(direct.status,403,'tabela protegida contra acesso direto');
const initial=await secret({action:'list'});expect(initial,200,'lista administrativa');assert.equal(initial.data.fichas.length,2);
assert.ok(initial.data.fichas.every(f=>f.estado==='aguardando_designacao'));
expect(await ownerAction({action:'confirm_notice',avaliacao_id:ids['900001']}),409,'coordenador inicia autoavaliação');
expect(await ownerAction({action:'save_answer',avaliacao_id:ids['900001'],codigo:'FICTICIA_1',resposta:'Tentativa fictícia'}),409,'coordenador responde autoavaliação');
expect(await byCoordinator(owner.data.session_token,{action:'detail',avaliacao_id:ids['900001']}),403,'titular acessa área especial');
expect(await secret({action:'assign',avaliacao_id:ids['900001'],rol:'900001',funcao:'Função fictícia',autorizacao:'Despacho fictício'}),403,'designação do próprio titular');
expect(await secret({action:'assign',avaliacao_id:ids['900001'],rol:'900004',funcao:'Função fictícia',autorizacao:'Despacho fictício'},reviewer.access_token),403,'revisor tenta designar');
const assigned=await secret({action:'assign',avaliacao_id:ids['900001'],rol:'900004',funcao:'Supervisor fictício',autorizacao:'Despacho local fictício'});
expect(assigned,200,'designação autorizada fictícia');assert.equal(assigned.data.designacao.avaliador_nome,'Avaliador Coordenador Fictício');
const evalAction=body=>byCoordinator(evaluator.data.session_token,{avaliacao_id:ids['900001'],...body});
expect(await evalAction({action:'save',versao:1,origem:'papel_secretaria',respostas:[required]}),403,'avaliador tenta transcrever como Secretaria');
const draft=await evalAction({action:'save',versao:1,origem:'avaliador_designado',respostas:[required]});expect(draft,200,'avaliador salva rascunho');
expect(await evalAction({action:'save',versao:1,origem:'avaliador_designado',respostas:[required]}),409,'edição com versão antiga');
expect(await evalAction({action:'save',versao:2,origem:'avaliador_designado',finalizar:true,respostas:[required]}),409,'perguntas em rascunho impedem envio');
sql(`update public.configuracoes_avaliacao set status='publicado';update public.perguntas_avaliacao set status='publicada';`);
expect(await evalAction({action:'save',versao:2,origem:'avaliador_designado',finalizar:true,respostas:[optional]}),409,'opcional não substitui obrigatória');
expect(await evalAction({action:'save',versao:2,origem:'avaliador_designado',respostas:[required,required]}),409,'perguntas duplicadas');
expect(await evalAction({action:'save',versao:2,origem:'avaliador_designado',finalizar:true,respostas:[required,optional]}),200,'envio pelo avaliador designado');
expect(await evalAction({action:'save',versao:3,origem:'avaliador_designado',respostas:[required]}),409,'avaliação enviada bloqueada');
console.log('PASS autorização, autoavaliação, autoria digital, rascunho, publicação e concorrência');

expect(await secret({action:'assign',avaliacao_id:ids['900004'],rol:'900005',funcao:'Pastor fictício',autorizacao:'Despacho local fictício em papel'}),200,'designação para papel');
const blank=await secret({action:'blank',avaliacao_id:ids['900004']});expect(blank,200,'formulário em branco');assert.equal(blank.data.designacao.avaliador_rol,'900005');
// PDF válido, gerado exclusivamente com conteúdo fictício.
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>','<< /Length 61 >>\nstream\nBT /F1 12 Tf 50 750 Td (Formulario ficticio assinado) Tj ET\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
let pdf='%PDF-1.4\n',offsets=[0];for(const [i,o] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const bytes=Buffer.from(pdf),upload={action:'upload',avaliacao_id:ids['900004'],nome:'Original-ficticio-assinado.pdf',tipo_mime:'application/pdf',base64:bytes.toString('base64')};
expect(await secret({...upload,base64:Buffer.from('arquivo inválido').toString('base64')}),409,'tipo real de arquivo');
const uploaded=await secret(upload);expect(uploaded,200,'Secretaria anexa original');const doc=uploaded.data.documento_id;assert.ok(doc);
expect(await secret(upload,reviewer.access_token),403,'avaliador não pode anexar como Secretaria');
const legacy=await post('/functions/v1/rod27-admin',{action:'office_save_transcription',avaliacao_id:ids['900004'],respostas:[required],documento_id:doc,finalizar:true},{Authorization:'Bearer '+admin.access_token});
assert.notEqual(legacy.status,200,'transcrição comum não pode contornar a regra especial');
expect(await evalAction({action:'document_url',documento_id:doc}),409,'documento de outra ficha');
const url=await secret({action:'document_url',avaliacao_id:ids['900004'],documento_id:doc});expect(url,200,'consulta auditada do original');
const localUrl=new URL(url.data.url);assert.ok(['kong','127.0.0.1'].includes(localUrl.hostname));
const original=await fetch(status.API_URL+localUrl.pathname+localUrl.search);assert.equal(original.status,200);assert.equal(createHash('sha256').update(Buffer.from(await original.arrayBuffer())).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
const path=sql(`select caminho_storage from public.documentos_avaliacao where id='${doc}'`);
assert.notEqual((await fetch(status.API_URL+'/storage/v1/object/public/rod27-documentos/'+path)).status,200,'original não pode ser público');
expect(await secret({action:'save',avaliacao_id:ids['900004'],versao:1,origem:'papel_secretaria',finalizar:true,respostas:[required]}),409,'original assinado obrigatório');
expect(await secret({action:'save',avaliacao_id:ids['900004'],versao:1,origem:'papel_secretaria',documento_id:doc,respostas:[required]}),200,'transcrição rascunho');
expect(await secret({action:'save',avaliacao_id:ids['900004'],versao:2,origem:'papel_secretaria',documento_id:doc,finalizar:true,respostas:[required]}),200,'conclusão da transcrição');
assert.equal(sql(`select transcrito_por='${admin.user.id}' and documento_fonte_id='${doc}' and origem_preenchimento='secretaria_transcricao' from public.avaliacoes_dirigente where id='${ids['900004']}'`),'t');
const history=await secret({action:'history',avaliacao_id:ids['900004']});expect(history,200,'histórico');
assert.ok(history.data.historico.some(x=>x.acao==='especial_save'&&x.detalhes.ator.user_id===admin.user.id&&x.detalhes.depois.avaliador_rol==='900005'&&x.detalhes.depois.registrado_em));
assert.ok(history.data.historico.some(x=>x.acao==='consultar_original_especial'));
console.log('PASS papel, identidade do avaliador/transcritor, original privado, consulta e histórico');

// Troca com candidato em preenchimento: respostas anteriores são preservadas.
sql(`insert into public.respostas_avaliacao(avaliacao_id,pergunta_id,resposta_texto) values('${ids['900002']}','${questions.FICTICIA_1}','Rascunho anterior fictício preservado');`);
const sentSnapshot=sql(`select to_jsonb(e) from public.avaliacoes_dirigente e where id='${ids['900001']}'`);
const sentAnswers=sql(`select jsonb_agg(to_jsonb(r) order by id) from public.respostas_avaliacao r where avaliacao_id='${ids['900001']}'`);
const changed=await post('/functions/v1/rod27-admin',{action:'office_change_coordinator',setor:1,rol:'900002'},{Authorization:'Bearer '+admin.access_token});expect(changed,200,'troca local com ficha em preenchimento');
assert.equal(sql(`select eh_proprio_coordenador from public.avaliacoes_dirigente where id='${ids['900002']}'`),'t');
assert.equal(sql(`select resposta_texto from public.respostas_avaliacao where avaliacao_id='${ids['900002']}'`),'Rascunho anterior fictício preservado');
assert.equal(sql(`select to_jsonb(e) from public.avaliacoes_dirigente e where id='${ids['900001']}'`),sentSnapshot);
assert.equal(sql(`select jsonb_agg(to_jsonb(r) order by id) from public.respostas_avaliacao r where avaliacao_id='${ids['900001']}'`),sentAnswers);
expect(await secret({action:'assign',avaliacao_id:ids['900002'],rol:'900004',funcao:'Supervisor fictício',autorizacao:'Despacho local'}),409,'protege rascunho de origem anterior');
// Troca com candidato ainda não iniciado.
const next=await post('/functions/v1/rod27-admin',{action:'office_change_coordinator',setor:1,rol:'900003'},{Authorization:'Bearer '+admin.access_token});expect(next,200,'troca local com ficha não iniciada');
assert.equal(sql(`select eh_proprio_coordenador from public.avaliacoes_dirigente where id='${ids['900002']}'`),'f');
assert.equal(sql(`select eh_proprio_coordenador from public.avaliacoes_dirigente where id='${ids['900003']}'`),'t');
assert.equal(sql(`select count(*) from public.avaliacoes_dirigente`),'4');
assert.equal(sql(`select count(*) from public.auditoria_sistema where acao='trocar_coordenador'`),'2');
assert.equal(sql(`select count(*) from public.auditoria_sistema where acao='reclassificar_ficha_especial'`),'3');
expect(await byCoordinator(owner.data.session_token,{action:'list'}),401,'sessão anterior revogada após troca');
console.log('PASS reclassificação não iniciada/em preenchimento, respostas e envios preservados, sem duplicar fichas');
expect(await secret({action:'assign',avaliacao_id:ids['900003'],rol:'900004',funcao:'Supervisor fictício',autorizacao:'Despacho fictício'}),200,'designação antes da troca');
expect(await byCoordinator(evaluator.data.session_token,{action:'save',avaliacao_id:ids['900003'],versao:1,origem:'avaliador_designado',respostas:[required]}),200,'rascunho especial antes da troca');
const draftBefore=sql(`select respostas_rascunho from public.avaliacoes_especiais where avaliacao_id='${ids['900003']}'`);
expect(await post('/functions/v1/rod27-admin',{action:'office_change_coordinator',setor:1,rol:'900002'},{Authorization:'Bearer '+admin.access_token}),200,'troca inativa designação anterior');
assert.equal(sql(`select ativa from public.avaliacoes_especiais where avaliacao_id='${ids['900003']}'`),'f');
assert.equal(sql(`select respostas_rascunho from public.avaliacoes_especiais where avaliacao_id='${ids['900003']}'`),draftBefore);
expect(await byCoordinator(evaluator.data.session_token,{action:'detail',avaliacao_id:ids['900003']}),409,'acesso designado cessa após reclassificação');
console.log('PASS designação inativada após troca; rascunho e histórico preservados');
