CREATE OR REPLACE FUNCTION private.validar_envio_avaliacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_obrigatorias integer;
  v_respondidas integer;
begin
  if old.status='enviada' then
    raise exception 'Avaliação já enviada e bloqueada para alterações.';
  end if;

  if new.status='enviada' then
    if new.aviso_confirmado_em is null then
      raise exception 'O aviso de irreversibilidade precisa ser confirmado antes do envio.';
    end if;

    select count(*) into v_obrigatorias
    from public.perguntas_avaliacao p
    where p.ciclo_id=new.ciclo_id and p.ativa=true and p.obrigatoria=true;

    select count(*) into v_respondidas
    from public.respostas_avaliacao r
    join public.perguntas_avaliacao p on p.id=r.pergunta_id
    where r.avaliacao_id=new.id
      and p.ciclo_id=new.ciclo_id
      and p.ativa=true
      and p.obrigatoria=true
      and (
        (p.tipo_resposta='texto_longo' and r.resposta_texto is not null and btrim(r.resposta_texto)<>'')
        or
        (p.tipo_resposta='escolha_unica' and r.resposta_opcao is not null)
      );

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

CREATE OR REPLACE FUNCTION private.bloquear_mutacao_resposta_enviada()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_avaliacao_id uuid;
  v_status text;
begin
  v_avaliacao_id := coalesce(new.avaliacao_id,old.avaliacao_id);
  select status into v_status from public.avaliacoes_dirigente where id=v_avaliacao_id;
  if v_status='enviada' then
    raise exception 'Avaliação já enviada e bloqueada para alterações.';
  end if;
  return coalesce(new,old);
end;
$function$;

CREATE OR REPLACE FUNCTION private.marcar_avaliacao_iniciada()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
begin
  update public.avaliacoes_dirigente
     set status=case when status='nao_iniciada' then 'em_preenchimento' else status end,
         iniciada_em=coalesce(iniciada_em,now()),
         atualizado_em=now()
   where id=new.avaliacao_id and status<>'enviada';
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validar_resposta_avaliacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_status text;
  v_ciclo_avaliacao uuid;
  v_ciclo_pergunta uuid;
  v_tipo text;
  v_opcoes jsonb;
begin
  select a.status,a.ciclo_id into v_status,v_ciclo_avaliacao
  from public.avaliacoes_dirigente a
  where a.id=new.avaliacao_id;

  if v_status='enviada' then
    raise exception 'Avaliação já enviada e bloqueada para alterações.';
  end if;

  select p.ciclo_id,p.tipo_resposta,p.opcoes
    into v_ciclo_pergunta,v_tipo,v_opcoes
  from public.perguntas_avaliacao p
  where p.id=new.pergunta_id and p.ativa=true;

  if v_ciclo_pergunta is null or v_ciclo_pergunta<>v_ciclo_avaliacao then
    raise exception 'Pergunta inválida para o ciclo desta avaliação.';
  end if;

  if v_tipo='texto_longo' then
    if new.resposta_texto is null or btrim(new.resposta_texto)='' or new.resposta_opcao is not null then
      raise exception 'Esta pergunta exige resposta textual.';
    end if;
  elsif v_tipo='escolha_unica' then
    if new.resposta_opcao is null or new.resposta_texto is not null
       or not (v_opcoes ? new.resposta_opcao) then
      raise exception 'Opção inválida para esta pergunta.';
    end if;
  end if;

  new.atualizado_em=now();
  return new;
end;
$function$;
CREATE TRIGGER trg_validar_envio_avaliacao BEFORE UPDATE ON public.avaliacoes_dirigente FOR EACH ROW EXECUTE FUNCTION private.validar_envio_avaliacao();
CREATE TRIGGER trg_bloquear_delete_resposta_enviada BEFORE DELETE ON public.respostas_avaliacao FOR EACH ROW EXECUTE FUNCTION private.bloquear_mutacao_resposta_enviada();
CREATE TRIGGER trg_marcar_avaliacao_iniciada AFTER INSERT OR UPDATE ON public.respostas_avaliacao FOR EACH ROW EXECUTE FUNCTION private.marcar_avaliacao_iniciada();
CREATE TRIGGER trg_validar_resposta_avaliacao BEFORE INSERT OR UPDATE ON public.respostas_avaliacao FOR EACH ROW EXECUTE FUNCTION private.validar_resposta_avaliacao();
