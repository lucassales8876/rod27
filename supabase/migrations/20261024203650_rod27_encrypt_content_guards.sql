-- Ciphertext AES-GCM (r27e1:) is validated by the application before encrypting.
-- The original submitted text/option is never stored by Rod27 Edge handlers.
do $$
declare fn text;
begin
 select pg_get_functiondef(p.oid) into fn
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname='validar_resposta_avaliacao';
 if fn is null or position('or not (v_opcoes ? new.resposta_opcao)' in fn)=0 then
  raise exception 'Formato do validador de respostas mudou. Nao aplicar migracao.';
 end if;
 fn:=replace(fn,
 'or not (v_opcoes ? new.resposta_opcao)',
 'or not ((v_opcoes ? new.resposta_opcao) or (current_user = ''service_role'' and new.resposta_opcao ~ ''^r27e1:[A-Za-z0-9+/=]+$''))');
 execute fn;
end $$;
alter table public.manifestacoes_interesse_coordenador
  drop constraint manifestacoes_interesse_justificativa_ck;
alter table public.manifestacoes_interesse_coordenador
  add constraint manifestacoes_interesse_justificativa_ck
  check (justificativa is null or
    (justificativa like 'r27e1:%' and length(justificativa) <= 12000)
    or (justificativa not like 'r27e1:%' and length(justificativa) <= 4000));
alter table public.manifestacoes_interesse_coordenador
  drop constraint manifestacoes_interesse_enviada_ck;
alter table public.manifestacoes_interesse_coordenador
  add constraint manifestacoes_interesse_enviada_ck check (
    status <> 'enviada'
    or (deseja_permanecer is null and opcao_movimentacao is null
        and justificativa like 'r27e1:%')
    or ((deseja_permanecer is true and opcao_movimentacao is not null
      and (opcao_movimentacao='mesma_congregacao'
         or nullif(btrim(justificativa),'') is not null))
     or (deseja_permanecer is false and opcao_movimentacao is null
      and nullif(btrim(justificativa),'') is not null))
  );

-- A funcao de transcricao administrativa valida o texto ANTES de receber ciphertext.
-- Preserva outras validacoes e restricoes existentes.
do $$
declare fn text;
begin
 select pg_get_functiondef(p.oid) into fn
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='rod27_salvar_transcricao';
 if fn is null or position('and length(v_text)>0 and not (v_q.opcoes @> jsonb_build_array(v_text))' in fn)=0 then
  raise exception 'Formato da rotina de transcricao mudou. Nao aplicar migracao.';
 end if;
 fn:=replace(fn,
 'and length(v_text)>0 and not (v_q.opcoes @> jsonb_build_array(v_text))',
 'and length(v_text)>0 and v_text not like ''r27e1:%'' and not (v_q.opcoes @> jsonb_build_array(v_text))');
 execute fn;
end $$;
