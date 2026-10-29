-- ROD27-29OCT2026: Niveis administrativos. Controle: superadmin1/superadmin;
-- Secretaria: superadmin1/secretario_geral. Nao altera dados de rodizio.
BEGIN;
ALTER TABLE public.usuarios_admin DROP CONSTRAINT usuarios_admin_papel_check;
ALTER TABLE public.usuarios_admin ADD CONSTRAINT usuarios_admin_papel_check
 CHECK (papel = ANY(ARRAY['superadmin1','superadmin','secretario_geral','revisor']::text[]));
CREATE UNIQUE INDEX IF NOT EXISTS rod27_only_one_superadmin1
 ON public.usuarios_admin (papel) WHERE papel='superadmin1';
DO $$
DECLARE f record; src text; changed integer:=0;
BEGIN
 FOR f IN
 SELECT p.oid,p.proname
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f'
 AND p.proname IN (
 'rod27_get_coordinator_pin','rod27_issue_joint_audit_grant',
 'rod27_planejamento_desfazer','rod27_planejamento_mover',
 'rod27_remove_audit_entry','rod27_remove_audit_entry_joint',
 'rod27_reset_coordinator_pin','rod27_salvar_transcricao',
 'rod27_substituir_dirigente','rod27_trocar_coordenador')
 LOOP
  src:=pg_get_functiondef(f.oid);
  IF position('''superadmin''' in src)>0 THEN
   EXECUTE replace(src,'''superadmin''','''superadmin1''');
   changed:=changed+1;
  END IF;
 END LOOP;
 IF changed<>10 THEN
  RAISE EXCEPTION 'Expected 10 role-checked functions; got %', changed;
 END IF;
END $$;
UPDATE public.usuarios_admin SET papel='superadmin1'
 WHERE user_id='1c12b58c-bd28-49f8-89e2-7ebd07121e4d'
 AND nome_exibicao='Lucas Sales' AND papel='superadmin';
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.usuarios_admin
    WHERE user_id='1c12b58c-bd28-49f8-89e2-7ebd07121e4d' AND papel='superadmin1')
 THEN RAISE EXCEPTION 'Principal account migration failed';END IF;
 IF NOT EXISTS (SELECT 1 FROM public.usuarios_admin
    WHERE user_id='daf76448-1a77-45ba-88d3-504afae7d628' AND papel='superadmin')
 THEN RAISE EXCEPTION 'Propozzito must remain control-only superadmin';END IF;
 IF NOT EXISTS (SELECT 1 FROM public.usuarios_admin
    WHERE user_id='9273af4c-890d-4c19-bc57-6a973b350d6b' AND papel='secretario_geral')
 THEN RAISE EXCEPTION 'Secretary role changed unexpectedly';END IF;
END $$;
COMMIT;
