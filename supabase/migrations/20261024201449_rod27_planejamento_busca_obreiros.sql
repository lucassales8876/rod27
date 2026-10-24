-- Busca restrita ao backend administrativo do Rod27 para o planejamento 2027.
-- A tabela privada não é exposta à API PostgREST; somente service_role pode chamar.
create or replace function public.rod27_planejamento_buscar_obreiros(p_busca text)
returns table(rol text, nome text, foto_url text)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_busca text := btrim(coalesce(p_busca, ''));
begin
  if length(v_busca) < 2 or length(v_busca) > 70 then
    raise exception 'Busca inválida.';
  end if;
  return query
  select o.rol, o.nome, o.foto_url
  from private.obreiros o
  where case
    when v_busca ~ '^[0-9]+$' then left(o.rol, length(v_busca)) = v_busca
    else position(lower(v_busca) in lower(o.nome)) > 0
  end
  order by o.nome collate "C", o.rol
  limit 20;
end;
$fn$;
revoke all on function public.rod27_planejamento_buscar_obreiros(text) from public, anon, authenticated;
grant execute on function public.rod27_planejamento_buscar_obreiros(text) to service_role;
