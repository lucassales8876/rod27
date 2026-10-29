-- Authorized by institutional administrator in chat 2026-10-29.
-- Prerequisite: verified local encrypted backup; exact expected counts from inventory.
-- No official entities, accounts, PINs, documents or other sectors are deleted.
BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE public.avaliacoes_dirigente,public.respostas_avaliacao,public.classificacoes_avaliacao,
 public.transcricoes_secretaria,public.manifestacoes_interesse_coordenador,public.documentos_avaliacao,
 public.documentos_coordenador IN EXCLUSIVE MODE;
CREATE TEMP TABLE cleanup_targets ON COMMIT DROP AS
 SELECT a.id,a.coordenacao_id FROM public.avaliacoes_dirigente a
 JOIN public.coordenacoes_setor cs ON cs.id=a.coordenacao_id
 JOIN public.setores s ON s.id=cs.setor_id JOIN public.ciclos_rodizio c ON c.id=a.ciclo_id
 WHERE c.ano=2027 AND s.numero IN(1,2);
CREATE TEMP TABLE cleanup_invariants(table_name text,hash text) ON COMMIT DROP;
DO $$ DECLARE t text; h text; BEGIN
 FOREACH t IN ARRAY ARRAY['congregacoes','coordenacoes_setor','usuarios_admin','designacoes',
 'rod27_planejamento_posicoes','rod27_planejamento','rod27_planejamento_eventos','coordenador_credenciais','coordenador_sessoes',
 'documentos_avaliacao','documentos_coordenador'] LOOP
  EXECUTE format('SELECT md5(coalesce(string_agg(row_to_json(r)::text,chr(10) ORDER BY row_to_json(r)::text),'''')) FROM public.%I r',t) INTO h;
  INSERT INTO cleanup_invariants VALUES(t,h);
 END LOOP;
END $$;
CREATE TEMP TABLE cleanup_obreiros ON COMMIT DROP AS SELECT * FROM private.obreiros;
CREATE TEMP TABLE cleanup_other_evaluations ON COMMIT DROP AS
 SELECT * FROM public.avaliacoes_dirigente WHERE id NOT IN(SELECT id FROM cleanup_targets);
CREATE TEMP TABLE cleanup_other_responses ON COMMIT DROP AS
 SELECT * FROM public.respostas_avaliacao WHERE avaliacao_id NOT IN(SELECT id FROM cleanup_targets);
CREATE TEMP TABLE cleanup_other_classifications ON COMMIT DROP AS
 SELECT * FROM public.classificacoes_avaliacao WHERE avaliacao_id NOT IN(SELECT id FROM cleanup_targets);
CREATE TEMP TABLE cleanup_other_manifests ON COMMIT DROP AS
 SELECT * FROM public.manifestacoes_interesse_coordenador WHERE coordenacao_id NOT IN(SELECT coordenacao_id FROM cleanup_targets);
DO $$ BEGIN
 IF (SELECT count(*) FROM cleanup_targets)<>11
 OR (SELECT count(*) FROM public.respostas_avaliacao WHERE avaliacao_id IN(SELECT id FROM cleanup_targets))<>36
 OR (SELECT count(*) FROM public.classificacoes_avaliacao WHERE avaliacao_id IN(SELECT id FROM cleanup_targets))<>1
 OR (SELECT count(*) FROM public.transcricoes_secretaria WHERE avaliacao_id IN(SELECT id FROM cleanup_targets))<>0
 OR (SELECT count(*) FROM public.manifestacoes_interesse_coordenador WHERE coordenacao_id IN(SELECT coordenacao_id FROM cleanup_targets))<>1
 OR EXISTS(SELECT 1 FROM public.documentos_avaliacao WHERE avaliacao_id IN(SELECT id FROM cleanup_targets))
 OR EXISTS(SELECT 1 FROM public.documentos_coordenador WHERE coordenacao_id IN(SELECT coordenacao_id FROM cleanup_targets))
 THEN RAISE EXCEPTION 'Inventory changed. Abort and take a new backup.'; END IF;
END $$;
-- Disable only immutable-submission guards, under table locks, in this transaction.
ALTER TABLE public.avaliacoes_dirigente DISABLE TRIGGER trg_validar_envio_avaliacao;
ALTER TABLE public.avaliacoes_dirigente DISABLE TRIGGER rod27_freeze_form_on_start_trg;
ALTER TABLE public.respostas_avaliacao DISABLE TRIGGER trg_bloquear_delete_resposta_enviada;
DELETE FROM public.classificacoes_avaliacao WHERE avaliacao_id IN(SELECT id FROM cleanup_targets);
DELETE FROM public.respostas_avaliacao WHERE avaliacao_id IN(SELECT id FROM cleanup_targets);
DELETE FROM public.transcricoes_secretaria WHERE avaliacao_id IN(SELECT id FROM cleanup_targets);
DELETE FROM public.manifestacoes_interesse_coordenador WHERE coordenacao_id IN(SELECT coordenacao_id FROM cleanup_targets);
UPDATE public.avaliacoes_dirigente SET status='nao_iniciada',aviso_confirmado_em=NULL,iniciada_em=NULL,enviada_em=NULL,
 origem_preenchimento='coordenador',transcrito_por=NULL,documento_fonte_id=NULL,formulario_versao=NULL,formulario_snapshot=NULL,atualizado_em=now()
 WHERE id IN(SELECT id FROM cleanup_targets);
ALTER TABLE public.avaliacoes_dirigente ENABLE TRIGGER trg_validar_envio_avaliacao;
ALTER TABLE public.avaliacoes_dirigente ENABLE TRIGGER rod27_freeze_form_on_start_trg;
ALTER TABLE public.respostas_avaliacao ENABLE TRIGGER trg_bloquear_delete_resposta_enviada;
DO $$ DECLARE x record; h text; BEGIN
 FOR x IN SELECT * FROM cleanup_invariants LOOP
  EXECUTE format('SELECT md5(coalesce(string_agg(row_to_json(r)::text,chr(10) ORDER BY row_to_json(r)::text),'''')) FROM public.%I r',x.table_name) INTO h;
  IF h IS DISTINCT FROM x.hash THEN RAISE EXCEPTION 'Unexpected change in %',x.table_name; END IF;
 END LOOP;
 IF EXISTS((SELECT * FROM cleanup_obreiros EXCEPT SELECT * FROM private.obreiros) UNION ALL (SELECT * FROM private.obreiros EXCEPT SELECT * FROM cleanup_obreiros))
 OR EXISTS((SELECT * FROM cleanup_other_evaluations EXCEPT SELECT * FROM public.avaliacoes_dirigente)
 UNION ALL (SELECT * FROM public.avaliacoes_dirigente WHERE id NOT IN(SELECT id FROM cleanup_targets) EXCEPT SELECT * FROM cleanup_other_evaluations))
 OR EXISTS((SELECT * FROM cleanup_other_responses EXCEPT SELECT * FROM public.respostas_avaliacao)
 UNION ALL (SELECT * FROM public.respostas_avaliacao WHERE avaliacao_id NOT IN(SELECT id FROM cleanup_targets) EXCEPT SELECT * FROM cleanup_other_responses))
 OR EXISTS((SELECT * FROM cleanup_other_classifications EXCEPT SELECT * FROM public.classificacoes_avaliacao)
 UNION ALL (SELECT * FROM public.classificacoes_avaliacao WHERE avaliacao_id NOT IN(SELECT id FROM cleanup_targets) EXCEPT SELECT * FROM cleanup_other_classifications))
 OR EXISTS((SELECT * FROM cleanup_other_manifests EXCEPT SELECT * FROM public.manifestacoes_interesse_coordenador)
 UNION ALL (SELECT * FROM public.manifestacoes_interesse_coordenador WHERE coordenacao_id NOT IN(SELECT coordenacao_id FROM cleanup_targets) EXCEPT SELECT * FROM cleanup_other_manifests))
 THEN RAISE EXCEPTION 'Other sectors changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.avaliacoes_dirigente WHERE id IN(SELECT id FROM cleanup_targets)
  AND (status<>'nao_iniciada' OR formulario_snapshot IS NOT NULL OR enviada_em IS NOT NULL))
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid IN('public.avaliacoes_dirigente'::regclass,'public.respostas_avaliacao'::regclass) AND tgenabled='D')
 THEN RAISE EXCEPTION 'Reset incomplete'; END IF;
END $$;
INSERT INTO public.auditoria_sistema(papel,acao,entidade,entidade_id,detalhes)
VALUES('institutional_admin','cleanup_confirmed_tests','ciclo_2027','setores_1_2',
 '{"sectors":[1,2],"evaluations_reset":11,"responses_deleted":36,"classifications_deleted":1,"manifestations_deleted":1,"documents_deleted":0,"backup":"local_dpapi_20261029","other_sectors_unchanged":true}'::jsonb);
COMMIT;
SELECT 'PASS: 11 fichas disponiveis; 36 respostas, 1 classificacao e 1 manifestacao de teste removidas; documentos e demais setores inalterados' result;
