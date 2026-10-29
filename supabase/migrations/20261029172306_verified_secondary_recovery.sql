BEGIN;
CREATE TABLE public.rod27_recovery_challenges (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 recovery_email_id uuid NOT NULL REFERENCES public.rod27_recovery_emails(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 send_accepted_at timestamptz, consumed_at timestamptz
);
CREATE TABLE public.rod27_recovery_rate (
 bucket text PRIMARY KEY CHECK(bucket ~ '^[a-f0-9]{64}$'),
 started_at timestamptz NOT NULL DEFAULT now(), last_at timestamptz NOT NULL DEFAULT now(), requests integer NOT NULL DEFAULT 1
);
ALTER TABLE public.rod27_recovery_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rod27_recovery_rate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rod27_recovery_challenges,public.rod27_recovery_rate FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.rod27_recovery_challenges,public.rod27_recovery_rate TO service_role;
CREATE UNIQUE INDEX rod27_verified_recovery_address_unique ON public.rod27_recovery_emails(email) WHERE verified_at IS NOT NULL;

CREATE FUNCTION public.rod27_issue_recovery_confirmation(p_actor uuid,p_email_id uuid,p_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.usuarios_admin WHERE user_id=p_actor AND ativo AND papel='secretario_geral') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 PERFORM 1 FROM public.rod27_recovery_emails WHERE id=p_email_id AND user_id=p_actor AND verified_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Endereco indisponivel'; END IF;
 IF EXISTS(SELECT 1 FROM public.rod27_recovery_challenges WHERE recovery_email_id=p_email_id AND created_at>now()-interval '60 seconds')
 OR (SELECT count(*) FROM public.rod27_recovery_challenges WHERE recovery_email_id=p_email_id AND created_at>now()-interval '1 hour')>=3
 THEN RAISE EXCEPTION 'Aguarde para solicitar outra confirmacao'; END IF;
 UPDATE public.rod27_recovery_challenges SET consumed_at=now() WHERE recovery_email_id=p_email_id AND consumed_at IS NULL;
 INSERT INTO public.rod27_recovery_challenges(token_hash,recovery_email_id) VALUES(p_hash,p_email_id);
END $$;

CREATE FUNCTION public.rod27_confirm_recovery_email(p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.rod27_recovery_challenges%rowtype; e public.rod27_recovery_emails%rowtype;
BEGIN
 SELECT * INTO c FROM public.rod27_recovery_challenges WHERE token_hash=p_hash;
 IF NOT FOUND OR c.consumed_at IS NOT NULL OR c.expires_at<=now() OR c.send_accepted_at IS NULL THEN RETURN false; END IF;
 SELECT * INTO e FROM public.rod27_recovery_emails WHERE id=c.recovery_email_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.usuarios_admin WHERE user_id=e.user_id AND ativo AND papel='secretario_geral') THEN RETURN false; END IF;
 SELECT * INTO c FROM public.rod27_recovery_challenges WHERE token_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR c.consumed_at IS NOT NULL OR c.expires_at<=now() OR c.send_accepted_at IS NULL THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=e.email AND id<>e.user_id)
 OR EXISTS(SELECT 1 FROM public.rod27_recovery_emails WHERE email=e.email AND user_id<>e.user_id AND verified_at IS NOT NULL) THEN RETURN false; END IF;
 UPDATE public.rod27_recovery_emails SET verified_at=now() WHERE id=e.id;
 UPDATE public.rod27_recovery_challenges SET consumed_at=now() WHERE recovery_email_id=e.id AND consumed_at IS NULL;
 INSERT INTO public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
 VALUES(e.user_id,'self','recovery_email_verified','rod27_recovery_emails',e.id::text,'{"ownership_proven":true}'::jsonb);
 RETURN true;
END $$;

CREATE FUNCTION public.rod27_recovery_lookup(p_email text)
RETURNS TABLE(user_id uuid,primary_email text,secondary_emails jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.user_id,u.email,coalesce((SELECT jsonb_agg(e.email) FROM public.rod27_recovery_emails e WHERE e.user_id=a.user_id AND e.verified_at IS NOT NULL),'[]'::jsonb)
 FROM public.usuarios_admin a JOIN auth.users u ON u.id=a.user_id
 WHERE a.ativo AND u.email_confirmed_at IS NOT NULL AND (lower(u.email)=p_email OR EXISTS(
  SELECT 1 FROM public.rod27_recovery_emails e WHERE e.user_id=a.user_id AND e.email=p_email AND e.verified_at IS NOT NULL)) LIMIT 2;
$$;

CREATE FUNCTION public.rod27_recovery_consume_rate(p_bucket text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.rod27_recovery_rate%rowtype;
BEGIN
 IF p_bucket IS NULL OR p_bucket !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_bucket,0));
 SELECT * INTO r FROM public.rod27_recovery_rate WHERE bucket=p_bucket FOR UPDATE;
 IF NOT FOUND THEN INSERT INTO public.rod27_recovery_rate(bucket) VALUES(p_bucket); RETURN true; END IF;
 IF r.last_at>now()-interval '60 seconds' THEN RETURN false; END IF;
 IF r.started_at<=now()-interval '1 hour' THEN
  UPDATE public.rod27_recovery_rate SET started_at=now(),last_at=now(),requests=1 WHERE bucket=p_bucket; RETURN true;
 END IF;
 IF r.requests>=3 THEN RETURN false; END IF;
 UPDATE public.rod27_recovery_rate SET last_at=now(),requests=requests+1 WHERE bucket=p_bucket;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.rod27_issue_recovery_confirmation(uuid,uuid,text),public.rod27_confirm_recovery_email(text),public.rod27_recovery_lookup(text),public.rod27_recovery_consume_rate(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rod27_issue_recovery_confirmation(uuid,uuid,text),public.rod27_confirm_recovery_email(text),public.rod27_recovery_lookup(text),public.rod27_recovery_consume_rate(text) TO service_role;
COMMIT;
