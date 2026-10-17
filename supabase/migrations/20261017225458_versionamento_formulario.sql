-- Versionamento seguro Rod27: perguntas editáveis pela Secretaria,
-- sem reinterpretar respostas de avaliações anteriormente iniciadas.

alter table public.avaliacoes_dirigente
 add column if not exists formulario_versao integer,
 add column if not exists formulario_snapshot jsonb;

alter table public.avaliacoes_dirigente
 drop constraint if exists avaliacoes_formulario_versao_ck;
alter table public.avaliacoes_dirigente
 add constraint avaliacoes_formulario_versao_ck
 check (formulario_versao is null or formulario_versao > 0);

-- Snapshot criado na primeira confirmação do aviso ou início administrativo.
create or replace function private.rod27_freeze_form_on_start()
returns trigger language plpgsql set search_path = ''
as $function$
declare
  v_config public.configuracoes_avaliacao%rowtype;
  v_questions jsonb;
begin
  if old.formulario_snapshot is not null then
    -- Impede mutação acidental do snapshot durante atualizações posteriores.
    new.formulario_snapshot := old.formulario_snapshot;
    new.formulario_versao := old.formulario_versao;
    return new;
  end if;
  if new.aviso_confirmado_em is null and new.status='nao_iniciada' then return new; end if;

  select * into v_config from public.configuracoes_avaliacao
    where ciclo_id=new.ciclo_id order by versao desc limit 1 for share;
  if not found or v_config.status<>'publicado' then
    raise exception 'Não existe formulário publicado para iniciar a avaliação.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.ordem),'[]'::jsonb)
    into v_questions
  from (
    select id,codigo,categoria,titulo,enunciado,tipo_resposta,
           opcoes,obrigatoria,ordem,status,ativa
    from public.perguntas_avaliacao
    where ciclo_id=new.ciclo_id and ativa=true and status='publicada'
    order by ordem
  ) q;

  if jsonb_array_length(v_questions)=0 then
    raise exception 'Formulário sem perguntas publicadas.';
  end if;

  new.formulario_versao:=v_config.versao;
  new.formulario_snapshot:=jsonb_build_object(
    'config',jsonb_build_object(
      'versao',v_config.versao,'status',v_config.status,
      'titulo_aviso',v_config.titulo_aviso,
      'texto_aviso',v_config.texto_aviso,
      'permite_edicao_apos_envio',v_config.permite_edicao_apos_envio),
    'questions',v_questions);
  return new;
end;
$function$;
drop trigger if exists rod27_freeze_form_on_start_trg on public.avaliacoes_dirigente;
create trigger rod27_freeze_form_on_start_trg before update on public.avaliacoes_dirigente
 for each row execute function private.rod27_freeze_form_on_start();

-- Publicar pergunta ou editar material já publicado cria uma nova versão
-- para futuras avaliações, dentro da MESMA transação do ajuste.
create or replace function private.rod27_bump_published_form_version()
returns trigger language plpgsql set search_path = ''
as $function$
declare v_cycle uuid;
begin
  if tg_op='UPDATE' then
    if old.status<>'publicada' and new.status<>'publicada' then return new; end if;
    if (to_jsonb(new)-'atualizado_em'-'criado_em')
        is not distinct from
       (to_jsonb(old)-'atualizado_em'-'criado_em')
    then return new; end if;
    v_cycle:=new.ciclo_id;
  else
    if new.status<>'publicada' then return new; end if;
    v_cycle:=new.ciclo_id;
  end if;

  update public.configuracoes_avaliacao
    set versao=versao+1,atualizado_em=now()
  where id=(
    select id from public.configuracoes_avaliacao
      where ciclo_id=v_cycle and status='publicado'
      order by versao desc limit 1
  );
  return new;
end;
$function$;
drop trigger if exists rod27_bump_published_form_version_trg on public.perguntas_avaliacao;
create trigger rod27_bump_published_form_version_trg
 after insert or update on public.perguntas_avaliacao
 for each row execute function private.rod27_bump_published_form_version();

-- Validação de envio usa o formulário congelado da avaliação, não a
-- versão que estiver publicada no momento do envio.
create or replace function private.validar_envio_avaliacao()
returns trigger language plpgsql set search_path = 'public','private','pg_temp'
as $function$
declare v_obrigatorias integer; v_respondidas integer;
begin
 if old.status='enviada' then
  raise exception 'Avaliação já enviada e bloqueada para alterações.';
 end if;
 if new.status='enviada' then
  if not exists(
    select 1 from public.configuracoes_avaliacao ca
    where ca.ciclo_id=new.ciclo_id and ca.status='publicado'
  ) then raise exception 'Formulário ainda não publicado.'; end if;
  if new.aviso_confirmado_em is null then
   raise exception 'O aviso de irreversibilidade precisa ser confirmado antes do envio.';
  end if;
  if new.formulario_snapshot is not null
       and jsonb_typeof(new.formulario_snapshot->'questions')='array' then
   select count(*) into v_obrigatorias
   from jsonb_array_elements(new.formulario_snapshot->'questions') q
   where coalesce((q->>'obrigatoria')::boolean,false)=true;

   select count(*) into v_respondidas
   from jsonb_array_elements(new.formulario_snapshot->'questions') q
   join public.respostas_avaliacao r
     on r.avaliacao_id=new.id and r.pergunta_id::text=q->>'id'
   where coalesce((q->>'obrigatoria')::boolean,false)=true
     and (
       (q->>'tipo_resposta'='texto_longo'
         and nullif(btrim(r.resposta_texto),'') is not null)
       or (q->>'tipo_resposta'='escolha_unica'
         and r.resposta_opcao is not null)
     );
  else
   -- Compatibilidade com fichas históricas anteriores ao snapshot.
   select count(*) into v_obrigatorias from public.perguntas_avaliacao p
   where p.ciclo_id=new.ciclo_id and p.ativa=true
     and p.status='publicada' and p.obrigatoria=true;
   select count(*) into v_respondidas
     from public.respostas_avaliacao r
     join public.perguntas_avaliacao p on p.id=r.pergunta_id
     where r.avaliacao_id=new.id and p.ciclo_id=new.ciclo_id
       and p.ativa=true and p.status='publicada' and p.obrigatoria=true
       and (
         (p.tipo_resposta='texto_longo'
           and nullif(btrim(r.resposta_texto),'') is not null)
         or (p.tipo_resposta='escolha_unica' and r.resposta_opcao is not null)
       );
  end if;
  if v_respondidas<>v_obrigatorias then
   raise exception 'A avaliação possui perguntas obrigatórias sem resposta.';
  end if;
  new.enviada_em=coalesce(new.enviada_em,now());
  new.atualizado_em=now();
 else
  new.atualizado_em=now();
 end if;
 return new;
end;
$function$;