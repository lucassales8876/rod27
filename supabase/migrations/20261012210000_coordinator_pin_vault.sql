create table if not exists private.coordinator_pin_vault (
  credencial_id uuid primary key references public.coordenador_credenciais(id) on delete cascade,
  vault_secret_id uuid not null unique references vault.secrets(id),
  rol text not null,
  versao integer not null,
  confirmed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
revoke all on private.coordinator_pin_vault from public, anon, authenticated;

create or replace function public.rod27_get_coordinator_pin(p_cred_id uuid, p_admin uuid)
returns table(rol text, pin text)
language plpgsql security definer set search_path = ''
as $$
declare v_cred public.coordenador_credenciais%rowtype;
begin
  if not exists (
    select 1 from public.usuarios_admin a
    where a.user_id = p_admin and a.ativo and a.papel = 'superadmin'
  ) then raise exception 'Acesso restrito ao superadmin.'; end if;
  select * into v_cred from public.coordenador_credenciais
  where id = p_cred_id and status = 'ativa';
  if not found then return; end if;
  return query
    select v_cred.rol_login, d.decrypted_secret
    from private.coordinator_pin_vault m
    join vault.decrypted_secrets d on d.id = m.vault_secret_id
    where m.credencial_id = p_cred_id
      and m.rol = v_cred.rol_login
      and m.versao = v_cred.versao
      and d.decrypted_secret ~ '^[0-9]{6}$';
  insert into public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
  values (p_admin,'superadmin','view_coordinator_pin','coordenador_credenciais',
          p_cred_id::text,jsonb_build_object('confirmed',found));
end;
$$;
revoke all on function public.rod27_get_coordinator_pin(uuid,uuid) from public, anon, authenticated;
grant execute on function public.rod27_get_coordinator_pin(uuid,uuid) to service_role;

create or replace function public.rod27_reset_coordinator_pin(
  p_cred_id uuid, p_pin text, p_hash text, p_admin uuid
) returns table(rol text, versao integer)
language plpgsql security definer set search_path = ''
as $$
declare v_cred public.coordenador_credenciais%rowtype;
        v_secret uuid;
        v_new_version integer;
begin
  if not exists (
    select 1 from public.usuarios_admin a where a.user_id=p_admin and a.ativo
      and a.papel in ('superadmin','secretario_geral')
  ) then raise exception 'Acesso administrativo não autorizado.'; end if;
  if p_pin !~ '^[0-9]{6}$' or p_hash not like 'pbkdf2-sha256$%'
  then raise exception 'PIN ou hash inválido.'; end if;
  select * into v_cred from public.coordenador_credenciais
  where id=p_cred_id for update;
  if not found then raise exception 'Credencial inexistente.'; end if;
  select m.vault_secret_id into v_secret from private.coordinator_pin_vault m
  where m.credencial_id=p_cred_id;
  if v_secret is null then
    v_secret := vault.create_secret(p_pin,'rod27-pin-'||p_cred_id::text,'PIN do coordenador');
  else
    perform vault.update_secret(v_secret,p_pin,null,null,null);
  end if;
  update public.coordenador_credenciais
  set senha_hash=p_hash,status='ativa',falhas_consecutivas=0,
      bloqueado_ate=null,senha_alterada_em=now()
  where id=p_cred_id returning coordenador_credenciais.versao into v_new_version;
  update public.coordenador_sessoes set revogada_em=now()
  where credencial_id=p_cred_id and revogada_em is null;
  insert into private.coordinator_pin_vault(credencial_id,vault_secret_id,rol,versao)
  values(p_cred_id,v_secret,v_cred.rol_login,v_new_version)
  on conflict(credencial_id) do update set vault_secret_id=excluded.vault_secret_id,
    rol=excluded.rol,versao=excluded.versao,confirmed_at=now(),updated_at=now();
  insert into public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
  select p_admin,a.papel,'reset_coordinator_pin','coordenador_credenciais',
    p_cred_id::text,jsonb_build_object('rol',v_cred.rol_login,'versao',v_new_version)
  from public.usuarios_admin a where a.user_id=p_admin;
  return query select v_cred.rol_login,v_new_version;
end;
$$;
revoke all on function public.rod27_reset_coordinator_pin(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.rod27_reset_coordinator_pin(uuid,text,text,uuid) to service_role;

create or replace function public.rod27_change_coordinator_with_pin(
  p_setor smallint, p_novo_rol text, p_novo_hash text, p_novo_pin text, p_admin uuid
) returns table(rol text, nome text, rol_anterior text, fichas_especiais integer)
language plpgsql security definer set search_path = ''
as $$
declare v_result record;
        v_cred public.coordenador_credenciais%rowtype;
        v_secret uuid;
begin
  if p_novo_pin !~ '^[0-9]{6}$' then raise exception 'PIN inválido.'; end if;
  select * into v_result from public.rod27_trocar_coordenador(
    p_setor,p_novo_rol,p_novo_hash,p_admin
  );
  select c.* into v_cred from public.coordenador_credenciais c
  join public.coordenacoes_setor cs on cs.id=c.coordenacao_id
  join public.setores s on s.id=cs.setor_id
  where s.numero=p_setor for update of c;
  if not found then raise exception 'Credencial não encontrada após troca.'; end if;
  select m.vault_secret_id into v_secret from private.coordinator_pin_vault m
  where m.credencial_id=v_cred.id;
  if v_secret is null then
    v_secret := vault.create_secret(p_novo_pin,'rod27-pin-'||v_cred.id::text,'PIN do coordenador');
  else
    perform vault.update_secret(v_secret,p_novo_pin,null,null,null);
  end if;
  insert into private.coordinator_pin_vault(credencial_id,vault_secret_id,rol,versao)
  values(v_cred.id,v_secret,v_cred.rol_login,v_cred.versao)
  on conflict(credencial_id) do update set vault_secret_id=excluded.vault_secret_id,
    rol=excluded.rol,versao=excluded.versao,confirmed_at=now(),updated_at=now();
  return query select v_result.rol,v_result.nome,v_result.rol_anterior,v_result.fichas_especiais;
end;
$$;
revoke all on function public.rod27_change_coordinator_with_pin(smallint,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.rod27_change_coordinator_with_pin(smallint,text,text,text,uuid) to service_role;
