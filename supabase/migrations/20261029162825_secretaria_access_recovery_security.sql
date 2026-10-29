BEGIN;
CREATE TABLE public.rod27_secretaria_access_policy (
 id smallint PRIMARY KEY DEFAULT 1 CHECK(id=1), enabled boolean NOT NULL DEFAULT true,
 allow_all boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 0,
 updated_by uuid REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rod27_secretaria_access_grants (
 user_id uuid PRIMARY KEY REFERENCES public.usuarios_admin(user_id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.rod27_recovery_emails (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.usuarios_admin(user_id) ON DELETE CASCADE,
 email text NOT NULL CHECK(length(email)<=254 AND email=lower(trim(email))),
 verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,email)
);
ALTER TABLE public.rod27_secretaria_access_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rod27_secretaria_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rod27_recovery_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rod27_secretaria_access_policy,public.rod27_secretaria_access_grants,public.rod27_recovery_emails FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.rod27_secretaria_access_policy,public.rod27_secretaria_access_grants,public.rod27_recovery_emails TO service_role;
INSERT INTO public.rod27_secretaria_access_policy(id) VALUES(1);
INSERT INTO public.rod27_secretaria_access_grants(user_id) SELECT user_id FROM public.usuarios_admin WHERE papel='superadmin1' AND ativo;

CREATE FUNCTION public.rod27_secretaria_can_access(p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.usuarios_admin a WHERE a.user_id=p_actor AND a.ativo AND
  (a.papel='secretario_geral' OR EXISTS(SELECT 1 FROM public.rod27_secretaria_access_policy p WHERE p.id=1 AND p.enabled
   AND (p.allow_all OR EXISTS(SELECT 1 FROM public.rod27_secretaria_access_grants g WHERE g.user_id=a.user_id)))));
$$;
REVOKE ALL ON FUNCTION public.rod27_secretaria_can_access(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rod27_secretaria_can_access(uuid) TO service_role;

CREATE FUNCTION public.rod27_set_secretaria_access(p_actor uuid,p_enabled boolean,p_allow_all boolean,p_grants jsonb,p_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_before jsonb; v_after jsonb; v_target uuid; v_rev integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.usuarios_admin WHERE user_id=p_actor AND ativo AND papel='secretario_geral')
 THEN RAISE EXCEPTION 'Acesso exclusivo do secretario-geral'; END IF;
 IF p_enabled IS NULL OR p_allow_all IS NULL OR p_grants IS NULL OR jsonb_typeof(p_grants)<>'array'
 THEN RAISE EXCEPTION 'Configuracao invalida'; END IF;
 IF jsonb_array_length(p_grants)>100 THEN RAISE EXCEPTION 'Lista invalida'; END IF;
 SELECT jsonb_build_object('enabled',enabled,'allow_all',allow_all,'revision',revision),revision INTO v_before,v_rev
 FROM public.rod27_secretaria_access_policy WHERE id=1 FOR UPDATE;
 IF v_rev IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Configuracao alterada, atualize'; END IF;
 v_before:=v_before||jsonb_build_object('grants',(SELECT coalesce(jsonb_agg(user_id ORDER BY user_id),'[]'::jsonb) FROM public.rod27_secretaria_access_grants));
 FOR v_target IN SELECT value::uuid FROM jsonb_array_elements_text(p_grants) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.usuarios_admin WHERE user_id=v_target AND ativo AND papel<>'secretario_geral')
  THEN RAISE EXCEPTION 'Conta invalida'; END IF;
 END LOOP;
 UPDATE public.rod27_secretaria_access_policy SET enabled=p_enabled,allow_all=p_allow_all,revision=revision+1,updated_by=p_actor,updated_at=now() WHERE id=1;
 DELETE FROM public.rod27_secretaria_access_grants;
 INSERT INTO public.rod27_secretaria_access_grants(user_id) SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(p_grants);
 v_after:=jsonb_build_object('enabled',p_enabled,'allow_all',p_allow_all,'grants',p_grants,'revision',v_rev+1);
 INSERT INTO public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
 VALUES(p_actor,'secretario_geral','secretaria_access_changed','rod27_secretaria_access_policy','1',jsonb_build_object('before',v_before,'after',v_after));
 RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.rod27_set_secretaria_access(uuid,boolean,boolean,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rod27_set_secretaria_access(uuid,boolean,boolean,jsonb,integer) TO service_role;

CREATE FUNCTION public.rod27_save_recovery_email(p_actor uuid,p_email text,p_remove boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.usuarios_admin WHERE user_id=p_actor AND ativo AND papel='secretario_geral')
 THEN RAISE EXCEPTION 'Acesso exclusivo do secretario-geral'; END IF;
 IF p_email IS NULL OR length(p_email)>254 OR p_email<>lower(trim(p_email)) OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 THEN RAISE EXCEPTION 'Email invalido'; END IF;
 PERFORM 1 FROM public.usuarios_admin WHERE user_id=p_actor FOR UPDATE;
 IF p_remove THEN DELETE FROM public.rod27_recovery_emails WHERE user_id=p_actor AND email=p_email;
 ELSE
  IF (SELECT count(*) FROM public.rod27_recovery_emails WHERE user_id=p_actor)>=5
   AND NOT EXISTS(SELECT 1 FROM public.rod27_recovery_emails WHERE user_id=p_actor AND email=p_email) THEN RAISE EXCEPTION 'Limite de enderecos'; END IF;
  INSERT INTO public.rod27_recovery_emails(user_id,email) VALUES(p_actor,p_email) ON CONFLICT(user_id,email) DO NOTHING;
 END IF;
 INSERT INTO public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
 VALUES(p_actor,'secretario_geral',CASE WHEN p_remove THEN 'recovery_email_removed' ELSE 'recovery_email_pending' END,
 'rod27_recovery_emails',p_actor::text,'{"verified":false}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.rod27_save_recovery_email(uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rod27_save_recovery_email(uuid,text,boolean) TO service_role;

-- Retire every API path for retrieving old PINs. Preserve Vault history and cryptography.
CREATE OR REPLACE FUNCTION public.rod27_get_coordinator_pin(p_cred_id uuid,p_admin uuid)
RETURNS TABLE(rol text,pin text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Consulta de PIN existente desabilitada. Redefinicao obrigatoria.'; END $$;
REVOKE ALL ON FUNCTION public.rod27_get_coordinator_pin(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Preserve legacy attachments, including existing duplicates. Enforce uniqueness for new uploads.
ALTER TABLE public.documentos_avaliacao ADD COLUMN dedup_enforced boolean NOT NULL DEFAULT false;
ALTER TABLE public.documentos_avaliacao ALTER COLUMN dedup_enforced SET DEFAULT true;
CREATE UNIQUE INDEX rod27_new_evaluation_document_unique ON public.documentos_avaliacao(avaliacao_id,sha256) WHERE dedup_enforced;
ALTER TABLE public.documentos_coordenador ADD COLUMN dedup_enforced boolean NOT NULL DEFAULT false;
ALTER TABLE public.documentos_coordenador ALTER COLUMN dedup_enforced SET DEFAULT true;
CREATE UNIQUE INDEX rod27_new_coordinator_document_unique ON public.documentos_coordenador(coordenacao_id,sha256) WHERE dedup_enforced;

INSERT INTO public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
SELECT user_id,papel,'secretaria_access_initialized','rod27_secretaria_access_policy','1',
 '{"enabled":true,"allow_all":false,"superadmin1_authorized":true,"superadmin_authorized":false,"legacy_pin_read_disabled":true}'::jsonb
FROM public.usuarios_admin WHERE papel='secretario_geral' AND ativo;
COMMIT;
