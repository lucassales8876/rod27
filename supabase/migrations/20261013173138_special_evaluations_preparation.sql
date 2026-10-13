-- PREPARAÇÃO: não aplicar/ativar em produção antes da confirmação administrativa.
-- Sem criação ou duplicação de fichas; cada designação aponta para uma ficha existente.
create table public.avaliacoes_especiais (
 avaliacao_id uuid primary key references public.avaliacoes_dirigente(id) on delete restrict,
 dirigente_rol_snapshot text not null,
 avaliador_rol text not null references private.obreiros(rol) on delete restrict,
 avaliador_nome text not null,
 avaliador_funcao text not null check (length(btrim(avaliador_funcao)) between 2 and 160),
 autorizado_por uuid not null references auth.users(id) on delete restrict,
 autorizacao_referencia text not null check (length(btrim(autorizacao_referencia)) between 3 and 500),
 designado_em timestamptz not null default now(),
 ativa boolean not null default true,
 estado text not null default 'designada' check (estado in ('designada','em_preenchimento','concluida')),
 respostas_rascunho jsonb not null default '[]' check (jsonb_typeof(respostas_rascunho)='array'),
 origem text check (origem in ('avaliador_designado','papel_secretaria')),
 documento_id uuid references public.documentos_avaliacao(id) on delete restrict,
 registrado_por uuid references auth.users(id) on delete restrict,
 registrado_credencial uuid references public.coordenador_credenciais(id) on delete restrict,
 registrado_nome text,
 registrado_rol text,
 registrado_em timestamptz,
 versao integer not null default 1,
 atualizado_em timestamptz not null default now(),
 check (avaliador_rol <> dirigente_rol_snapshot)
);
create index avaliacoes_especiais_avaliador_idx on public.avaliacoes_especiais(avaliador_rol);
create index avaliacoes_especiais_documento_idx on public.avaliacoes_especiais(documento_id);
create index avaliacoes_especiais_autor_idx on public.avaliacoes_especiais(autorizado_por);
create index avaliacoes_especiais_registrado_idx on public.avaliacoes_especiais(registrado_por);
create index avaliacoes_especiais_credencial_idx on public.avaliacoes_especiais(registrado_credencial);
alter table public.avaliacoes_especiais enable row level security;
revoke all on public.avaliacoes_especiais from public,anon,authenticated;
grant select,insert,update on public.avaliacoes_especiais to service_role;

-- O serviço verifica a identidade; a função revalida sessão/conta e faz alterações
-- e auditoria na mesma transação. Não há endpoint para aprovar a regra.
create or replace function public.rod27_special_command(
 p_action text, p_id uuid, p_user uuid, p_session uuid, p_payload jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_admin boolean := false; v_role text; v_rol text; v_name text; v_cred uuid;
 v_ev public.avaliacoes_dirigente%rowtype; v_sp public.avaliacoes_especiais%rowtype;
 v_old jsonb; v_result jsonb; v_answers jsonb; v_item jsonb;
 v_q public.perguntas_avaliacao%rowtype; v_text text; v_qid uuid;
 v_doc public.documentos_avaliacao%rowtype; v_doc_id uuid;
 v_final boolean; v_origin text; v_actor jsonb; v_evaluator text; v_evaluator_name text;
begin
 if not exists(select 1 from public.configuracoes_sistema_runtime
   where chave='fichas_especiais.aprovacao' and valor->>'aprovada'='true'
   and length(btrim(coalesce(valor->>'referencia','')))>2)
 then raise exception 'Procedimento especial aguarda confirmação do pastor Rubem.'; end if;
 if p_user is not null and p_session is null then
  select a.papel,a.rol,a.nome_exibicao into v_role,v_rol,v_name
   from public.usuarios_admin a where a.user_id=p_user and a.ativo;
  if not found then raise exception 'Conta não autorizada.'; end if;
  v_admin := v_role in ('superadmin','secretario_geral');
 elsif p_session is not null and p_user is null then
  select c.id,c.rol_login,co.coordenador_nome_snapshot into v_cred,v_rol,v_name
   from public.coordenador_sessoes s join public.coordenador_credenciais c on c.id=s.credencial_id
   join public.coordenacoes_setor co on co.id=c.coordenacao_id
   where s.id=p_session and s.revogada_em is null and s.expira_em>now()
   and c.status='ativa' and c.rol_login=co.obreiro_rol;
  if not found then raise exception 'Sessão de coordenador inválida.'; end if;
  v_role := 'avaliador_designado';
 else raise exception 'Identidade inválida.'; end if;
 v_actor := jsonb_build_object('user_id',p_user,'credencial_id',v_cred,'rol',v_rol,'nome',v_name,'papel',v_role);
 if p_action='lookup' then
  if not v_admin then raise exception 'Consulta de ROL restrita à Secretaria.'; end if;
  select jsonb_build_object('rol',rol,'nome',nome) into v_result from private.obreiros where rol=btrim(p_payload->>'rol');
  if not found then raise exception 'ROL não encontrado.'; end if;
  return jsonb_build_object('ok',true,'avaliador',v_result);
 end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'nome',e.dirigente_nome_snapshot,
   'rol',e.dirigente_rol,'congregacao',e.congregacao_nome_snapshot,
   'estado',case when s.ativa then s.estado else 'aguardando_designacao' end,
   'avaliador_rol',case when s.ativa then s.avaliador_rol end,
   'avaliador_nome',case when s.ativa then s.avaliador_nome end) order by e.dirigente_nome_snapshot),'[]')
   into v_result from public.avaliacoes_dirigente e
   join public.ciclos_rodizio c on c.id=e.ciclo_id and c.ano=2027
   left join public.avaliacoes_especiais s on s.avaliacao_id=e.id
   where e.eh_proprio_coordenador and (v_admin or (s.ativa and s.avaliador_rol=v_rol and e.dirigente_rol<>v_rol));
  return jsonb_build_object('ok',true,'can_manage',v_admin,'fichas',v_result);
 end if;
 select e.* into v_ev from public.avaliacoes_dirigente e join public.ciclos_rodizio c on c.id=e.ciclo_id
   where e.id=p_id and c.ano=2027 for update of e;
 if not found or not v_ev.eh_proprio_coordenador then raise exception 'Ficha especial não encontrada.'; end if;
 select * into v_sp from public.avaliacoes_especiais where avaliacao_id=p_id for update;
 if not v_admin and (not coalesce(v_sp.ativa,false) or v_sp.avaliador_rol is distinct from v_rol
   or v_ev.dirigente_rol=v_rol) then raise exception 'Acesso à ficha não autorizado; autoavaliação proibida.'; end if;
 v_old := case when v_sp.avaliacao_id is null then null else to_jsonb(v_sp) end;
 if p_action in ('detail','blank') then
  select jsonb_build_object('ok',true,'avaliacao',to_jsonb(v_ev),'designacao',v_old,
    'can_manage',v_admin,'questions',coalesce((select jsonb_agg(to_jsonb(q) order by q.ordem)
      from public.perguntas_avaliacao q where q.ciclo_id=v_ev.ciclo_id and q.ativa),'[]'),
    'form_status',(select c.status from public.configuracoes_avaliacao c where c.ciclo_id=v_ev.ciclo_id),
    'documentos',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'nome',d.nome_original,'enviado_em',d.enviado_em))
      from public.documentos_avaliacao d where d.avaliacao_id=p_id),'[]')) into v_result;
  insert into public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
    values(p_user,v_role,case when p_action='blank' then 'imprimir_ficha_especial' else 'consultar_ficha_especial' end,
     'avaliacoes_dirigente',p_id::text,jsonb_build_object('ator',v_actor));
  return v_result;
 elsif p_action='history' then
  if not v_admin then raise exception 'Histórico restrito à Secretaria.'; end if;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.criado_em),'[]') into v_result
    from public.auditoria_sistema a where a.entidade_id=p_id::text;
  return jsonb_build_object('ok',true,'historico',v_result);
 elsif p_action='document_access' then
  select * into v_doc from public.documentos_avaliacao where id=(p_payload->>'documento_id')::uuid and avaliacao_id=p_id;
  if not found then raise exception 'Documento não pertence à ficha.'; end if;
  insert into public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
    values(p_user,v_role,'consultar_original_especial','avaliacoes_dirigente',p_id::text,
     jsonb_build_object('ator',v_actor,'documento_id',v_doc.id));
  return jsonb_build_object('ok',true,'path',v_doc.caminho_storage);
 end if;
 if v_ev.status='enviada' then raise exception 'Avaliação enviada: histórico preservado, edição bloqueada.'; end if;
 if p_action='assign' then
  if not v_admin then raise exception 'Designação restrita à Secretaria Geral.'; end if;
  if v_ev.status<>'nao_iniciada' or (v_sp.avaliacao_id is not null and v_sp.estado<>'designada')
    or exists(select 1 from public.respostas_avaliacao where avaliacao_id=p_id)
    then raise exception 'Ficha iniciada exige revisão administrativa; nenhum rascunho será substituído.'; end if;
  v_evaluator := btrim(p_payload->>'rol');
  if v_evaluator=v_ev.dirigente_rol then raise exception 'Autoavaliação proibida.'; end if;
  select nome into v_evaluator_name from private.obreiros where rol=v_evaluator;
  if not found then raise exception 'ROL do avaliador não encontrado.'; end if;
  insert into public.avaliacoes_especiais(avaliacao_id,dirigente_rol_snapshot,avaliador_rol,
    avaliador_nome,avaliador_funcao,autorizado_por,autorizacao_referencia)
  values(p_id,v_ev.dirigente_rol,v_evaluator,v_evaluator_name,btrim(p_payload->>'funcao'),p_user,btrim(p_payload->>'autorizacao'))
  on conflict(avaliacao_id) do update set dirigente_rol_snapshot=excluded.dirigente_rol_snapshot,
    avaliador_rol=excluded.avaliador_rol,avaliador_nome=excluded.avaliador_nome,
    avaliador_funcao=excluded.avaliador_funcao,autorizado_por=p_user,
    autorizacao_referencia=excluded.autorizacao_referencia,designado_em=now(),ativa=true,
    versao=public.avaliacoes_especiais.versao+1,atualizado_em=now();
 elsif p_action='register_document' then
  if v_rol=v_ev.dirigente_rol then raise exception 'Autoavaliação proibida.'; end if;
  if not v_admin or not coalesce(v_sp.ativa,false) then raise exception 'Anexo exige designação e Secretaria autorizada.'; end if;
  if (p_payload->>'path') not like 'aval/'||p_id::text||'/%' then raise exception 'Caminho de documento inválido.'; end if;
  insert into public.documentos_avaliacao(avaliacao_id,caminho_storage,nome_original,tipo_mime,tamanho_bytes,sha256,enviado_por,status_ocr)
   values(p_id,p_payload->>'path',p_payload->>'nome',p_payload->>'mime',(p_payload->>'size')::integer,p_payload->>'sha256',p_user,'nao_processado')
   returning id into v_doc_id;
 elsif p_action='save' then
  if v_rol=v_ev.dirigente_rol then raise exception 'Autoavaliação proibida.'; end if;
  if not coalesce(v_sp.ativa,false) or v_sp.dirigente_rol_snapshot<>v_ev.dirigente_rol then raise exception 'Designação válida é obrigatória.'; end if;
  if (p_payload->>'versao')::integer is distinct from v_sp.versao then raise exception 'Ficha alterada por outra sessão. Recarregue antes de salvar.'; end if;
  v_origin := p_payload->>'origem'; v_final := coalesce((p_payload->>'finalizar')::boolean,false);
  if v_origin='papel_secretaria' then
   if not v_admin then raise exception 'Transcrição restrita à Secretaria.'; end if;
  elsif v_origin='avaliador_designado' then
   if v_rol is distinct from v_sp.avaliador_rol or v_rol=v_ev.dirigente_rol then raise exception 'Somente o avaliador designado pode preencher.'; end if;
  else raise exception 'Origem inválida.'; end if;
  if v_sp.origem is not null and v_sp.origem<>v_origin then raise exception 'Não misture transcrição em papel com preenchimento digital.'; end if;
  if exists(select 1 from public.respostas_avaliacao where avaliacao_id=p_id) then raise exception 'Existem respostas anteriores. Revisão administrativa necessária.'; end if;
  v_doc_id := nullif(p_payload->>'documento_id','')::uuid;
  if v_doc_id is not null and not exists(select 1 from public.documentos_avaliacao where id=v_doc_id and avaliacao_id=p_id)
    then raise exception 'Documento não pertence à ficha.'; end if;
  if v_final and v_origin='papel_secretaria' and v_doc_id is null then raise exception 'Original assinado obrigatório para concluir a transcrição.'; end if;
  v_answers := p_payload->'respostas';
  if jsonb_typeof(v_answers) is distinct from 'array' or jsonb_array_length(v_answers)>80 then raise exception 'Respostas inválidas.'; end if;
  if (select count(*)<>count(distinct x->>'pergunta_id') from jsonb_array_elements(v_answers) x) then raise exception 'Perguntas duplicadas.'; end if;
  for v_item in select value from jsonb_array_elements(v_answers) loop
   v_qid := (v_item->>'pergunta_id')::uuid;
   select * into v_q from public.perguntas_avaliacao where id=v_qid and ciclo_id=v_ev.ciclo_id and ativa;
   if not found then raise exception 'Pergunta não pertence ao formulário.'; end if;
   v_text := btrim(coalesce(v_item->>'resposta',''));
   if length(v_text)>10000 then raise exception 'Resposta excede 10000 caracteres.'; end if;
   if v_q.tipo_resposta='escolha_unica' and v_text<>'' and not (v_q.opcoes @> jsonb_build_array(v_text)) then raise exception 'Opção inválida.'; end if;
  end loop;
  if v_final then
   if not exists(select 1 from public.configuracoes_avaliacao where ciclo_id=v_ev.ciclo_id and status='publicado')
     or not exists(select 1 from public.perguntas_avaliacao where ciclo_id=v_ev.ciclo_id and ativa)
     or exists(select 1 from public.perguntas_avaliacao where ciclo_id=v_ev.ciclo_id and ativa and status<>'publicada')
     then raise exception 'Formulário ainda não publicado.'; end if;
   if exists(select 1 from public.perguntas_avaliacao q where q.ciclo_id=v_ev.ciclo_id and q.ativa and q.obrigatoria
      and not exists(select 1 from jsonb_array_elements(v_answers) x where x->>'pergunta_id'=q.id::text and btrim(coalesce(x->>'resposta',''))<>''))
     then raise exception 'Responda cada pergunta obrigatória.'; end if;
   for v_item in select value from jsonb_array_elements(v_answers) loop
    v_text := btrim(coalesce(v_item->>'resposta','')); if v_text='' then continue; end if;
    select * into v_q from public.perguntas_avaliacao where id=(v_item->>'pergunta_id')::uuid;
    insert into public.respostas_avaliacao(avaliacao_id,pergunta_id,resposta_texto,resposta_opcao)
      values(p_id,v_q.id,case when v_q.tipo_resposta='texto_longo' then v_text end,case when v_q.tipo_resposta='escolha_unica' then v_text end);
   end loop;
  end if;
  update public.avaliacoes_especiais set respostas_rascunho=v_answers,origem=v_origin,documento_id=v_doc_id,
    registrado_por=p_user,registrado_credencial=v_cred,registrado_nome=v_name,registrado_rol=v_rol,registrado_em=now(),
    estado=case when v_final then 'concluida' else 'em_preenchimento' end,versao=versao+1,atualizado_em=now() where avaliacao_id=p_id;
  update public.avaliacoes_dirigente set status=case when v_final then 'enviada' else 'em_preenchimento' end,
    aviso_confirmado_em=coalesce(aviso_confirmado_em,now()),iniciada_em=coalesce(iniciada_em,now()),
    enviada_em=case when v_final then now() else enviada_em end,
    origem_preenchimento=case when v_origin='papel_secretaria' then 'secretaria_transcricao' else 'coordenador' end,
    transcrito_por=case when v_origin='papel_secretaria' then p_user else null end,documento_fonte_id=v_doc_id,atualizado_em=now() where id=p_id;
 else raise exception 'Ação especial desconhecida.'; end if;
 select to_jsonb(s) into v_result from public.avaliacoes_especiais s where s.avaliacao_id=p_id;
 insert into public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
   values(p_user,v_role,'especial_'||p_action,'avaliacoes_dirigente',p_id::text,
     jsonb_build_object('ator',v_actor,'antes',v_old,'depois',v_result,'documento_id',v_doc_id,'finalizar',v_final));
 return jsonb_build_object('ok',true,'designacao',v_result,'documento_id',v_doc_id);
end;
$$;
revoke all on function public.rod27_special_command(text,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.rod27_special_command(text,uuid,uuid,uuid,jsonb) to service_role;

create or replace function private.rod27_special_reclassification() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_changed integer;
begin
 if old.status<>'enviada' and (old.eh_proprio_coordenador is distinct from new.eh_proprio_coordenador
   or old.dirigente_rol is distinct from new.dirigente_rol) then
  update public.avaliacoes_especiais set ativa=false,versao=versao+1,atualizado_em=now() where avaliacao_id=new.id and ativa;
  get diagnostics v_changed = row_count;
  insert into public.auditoria_sistema(papel,acao,entidade,entidade_id,detalhes)
   values('sistema','reclassificar_ficha_especial','avaliacoes_dirigente',new.id::text,
     jsonb_build_object('especial_anterior',old.eh_proprio_coordenador,'especial_nova',new.eh_proprio_coordenador,
       'rol_anterior',old.dirigente_rol,'rol_novo',new.dirigente_rol,'designacao_anterior_inativada',v_changed>0));
 end if;
 return new;
end;
$$;
revoke all on function private.rod27_special_reclassification() from public,anon,authenticated;
create trigger rod27_special_reclassification after update of eh_proprio_coordenador,dirigente_rol
 on public.avaliacoes_dirigente for each row execute function private.rod27_special_reclassification();
