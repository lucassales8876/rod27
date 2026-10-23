create or replace function public.rod27_operational_sessions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
 select jsonb_build_object(
  'checked_at', now(),
  'recent_window_minutes', 15,
  'coordinators', coalesce((
   select jsonb_agg(jsonb_build_object(
    'setor',p.numero,
    'area',p.area,
    'coordenador',co.coordenador_nome_snapshot,
    'rol',cred.rol_login,
    'inicio',sess.criada_em,
    'ultimo_uso',sess.ultimo_uso_em,
    'expira_em',sess.expira_em,
    'recente',coalesce(sess.ultimo_uso_em,sess.criada_em) >= now()-interval '15 minutes'
   ) order by p.numero, sess.ultimo_uso_em desc)
   from (
    select id,credencial_id,criada_em,ultimo_uso_em,expira_em
    from public.coordenador_sessoes
    where revogada_em is null and expira_em>now()
    order by ultimo_uso_em desc nulls last
    limit 200
   ) sess
   join public.coordenador_credenciais cred on cred.id=sess.credencial_id
   join public.coordenacoes_setor co on co.id=cred.coordenacao_id
   join public.setores p on p.id=co.setor_id
  ),'[]'::jsonb),
  'administrators',coalesce((
   select jsonb_agg(jsonb_build_object(
    'nome',u.nome_exibicao,
    'papel',u.papel,
    'inicio',s.created_at,
    'ultimo_uso',s.updated_at,
    'expira_em',s.not_after,
    'recente',coalesce(s.updated_at,s.created_at)>=now()-interval '15 minutes'
   ) order by s.updated_at desc)
   from (
    select user_id,created_at,updated_at,not_after
    from auth.sessions
    where not_after is null or not_after>now()
    order by updated_at desc nulls last
    limit 200
   ) s
   join public.usuarios_admin u on u.user_id=s.user_id and u.ativo=true
  ),'[]'::jsonb)
 );
$function$;
revoke all on function public.rod27_operational_sessions() from public,anon,authenticated;
grant execute on function public.rod27_operational_sessions() to service_role;