-- Transcricoes sao inseridas por rotina SECURITY DEFINER (current_user=postgres).
-- O validador segue exigindo opcao real para gravacoes tradicionais.
do $$
declare fn text;
begin
 select pg_get_functiondef(p.oid) into fn
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.proname='validar_resposta_avaliacao';
 if fn is null or position('current_user = ''service_role''' in fn)=0
   or position('r27e1:' in fn)=0 then
  raise exception 'Validador com formato inesperado; proteger transcricao manualmente.';
 end if;
 fn:=replace(fn,
   'current_user = ''service_role''',
   'current_user IN (''service_role'', ''postgres'')');
 execute fn;
end $$;