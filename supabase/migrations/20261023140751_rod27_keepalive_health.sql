-- Endpoint sem dados privados para atividade real e verificável no Postgres.
-- Funciona com chave PUBLICÁVEL da aplicação; nenhum segredo de administrador.
create or replace function public.rod27_heartbeat()
returns table(ok boolean, checked_at timestamptz)
language sql volatile security invoker
set search_path = ''
as $function$
  select true, clock_timestamp();
$function$;

revoke all on function public.rod27_heartbeat() from public;
grant execute on function public.rod27_heartbeat() to anon, authenticated;