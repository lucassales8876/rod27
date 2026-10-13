create or replace function public.rod27_verify_coordinator_pin(p_cred_id uuid, p_pin text)
returns boolean language plpgsql security definer set search_path to '' as $function$
declare v_hash text;
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then return false; end if;
  select senha_hash into v_hash from public.coordenador_credenciais
  where id=p_cred_id and status='ativa';
  if v_hash is null or v_hash !~ '^\$2a\$10\$' then return false; end if;
  return v_hash = extensions.crypt(p_pin,v_hash);
end;
$function$;
revoke all on function public.rod27_verify_coordinator_pin(uuid,text) from public, anon, authenticated;
grant execute on function public.rod27_verify_coordinator_pin(uuid,text) to service_role;
