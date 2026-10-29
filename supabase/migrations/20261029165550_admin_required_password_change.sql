BEGIN;
CREATE FUNCTION public.rod27_admin_session_active(p_user uuid,p_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.sessions s JOIN public.usuarios_admin a ON a.user_id=s.user_id
 WHERE s.id=p_session AND s.user_id=p_user AND a.ativo
 AND (s.not_after IS NULL OR s.not_after>now()));
$$;
REVOKE ALL ON FUNCTION public.rod27_admin_session_active(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rod27_admin_session_active(uuid,uuid) TO service_role;
COMMIT;
