-- 2026-10-29: limite do ciphertext leva em conta expansão UTF-8 + AES-GCM + base64.
BEGIN;
ALTER TABLE public.manifestacoes_interesse_coordenador
 DROP CONSTRAINT manifestacoes_interesse_justificativa_ck;
ALTER TABLE public.manifestacoes_interesse_coordenador
 ADD CONSTRAINT manifestacoes_interesse_justificativa_ck
 CHECK(justificativa IS NULL
 OR (justificativa LIKE 'r27e1:%' AND length(justificativa)<=20000)
 OR (justificativa NOT LIKE 'r27e1:%' AND length(justificativa)<=4000));
DO $audit$
DECLARE fn text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO fn FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='rod27_salvar_transcricao';
 IF fn IS NULL OR position('if length(v_text)>10000 then' IN fn)=0 THEN
   RAISE EXCEPTION 'Routine rod27_salvar_transcricao changed unexpectedly';
 END IF;
 fn:=replace(fn,'if length(v_text)>10000 then',
 'if (v_text like ''r27e1:%'' and length(v_text)>45000) or (v_text not like ''r27e1:%'' and length(v_text)>10000) then');
 EXECUTE fn;
END $audit$;
COMMIT;
