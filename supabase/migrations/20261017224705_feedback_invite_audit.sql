-- Rod27 2026-10-17: feedback de manifestação, convite de uso único,
-- trilha transacional de mudanças críticas e exclusão autorizada com meta-auditoria.
-- Migração deve ser executada dentro de uma transação.

-- 1. Manifestação não é autoavaliação. Quem pede mudança ou saída informa por quê.
alter table public.manifestacoes_interesse_coordenador
 drop constraint if exists manifestacoes_interesse_enviada_ck;
alter table public.manifestacoes_interesse_coordenador
 add constraint manifestacoes_interesse_enviada_ck check (
   status <> 'enviada' or (
      deseja_permanecer is true
      and opcao_movimentacao is not null
      and (
         opcao_movimentacao = 'mesma_congregacao'
         or nullif(btrim(justificativa),'') is not null
      )
   ) or (
      deseja_permanecer is false
      and opcao_movimentacao is null
      and nullif(btrim(justificativa),'') is not null
   )
 );

-- 2. Um e-mail não pode ter convites administrativos simultâneos em aberto.
create unique index if not exists admin_convites_unico_pendente_email
 on public.admin_convites (lower(email)) where usado_em is null;

-- 3. Serializa verificações de convite dentro da transação de criação auth.users.
-- O lock impede dois cadastros concorrentes de resgatarem o mesmo convite.
create or replace function private.rod27_validate_admin_signup()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_invite public.admin_convites%rowtype;
  v_code text;
  v_hash text;
  v_is_admin_setup boolean;
begin
  if new.email is null then return new; end if;
  v_is_admin_setup := coalesce(new.raw_user_meta_data->>'rod27_admin_setup','false')='true';

  select * into v_invite from public.admin_convites
  where lower(email)=lower(new.email)
  order by criado_em desc limit 1 for update;

  if not found then
    if v_is_admin_setup then
      raise exception 'Este e-mail não possui convite administrativo válido.';
    end if;
    return new;
  end if;

  if v_invite.usado_em is not null or v_invite.expira_em <= now() then
    raise exception 'Convite administrativo inválido ou expirado.';
  end if;

  v_code := coalesce(new.raw_user_meta_data->>'rod27_admin_invite','');
  if length(v_code)<12 then
    raise exception 'Código temporário inválido.';
  end if;
  v_hash := encode(extensions.digest(v_code,'sha256'),'hex');
  if v_hash <> v_invite.codigo_hash then
    raise exception 'Código temporário inválido.';
  end if;

  new.raw_user_meta_data :=
    coalesce(new.raw_user_meta_data,'{}'::jsonb)
    - 'rod27_admin_invite' - 'rod27_admin_setup';
  new.email_confirmed_at := coalesce(new.email_confirmed_at,now());
  return new;
end;
$function$;

-- 4. Trilha automática, transacional e sem valores confidenciais no corpo.
create or replace function private.rod27_audit_critical_change()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_row jsonb;
  v_old jsonb;
  v_changed jsonb;
  v_entity_id text;
begin
  if tg_op='DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  if tg_op='UPDATE' then v_old := to_jsonb(old); else v_old := '{}'::jsonb; end if;
  select coalesce(jsonb_agg(k),'[]'::jsonb) into v_changed
  from jsonb_object_keys(v_row) as x(k)
  where v_old->k is distinct from v_row->k;

  -- Sem registrar corpo de respostas, PIN, senhas ou segredos em logs automáticos.
  v_entity_id := coalesce(v_row->>'id',v_row->>'chave',v_row->>'user_id','unknown');
  insert into public.auditoria_sistema(papel,acao,entidade,entidade_id,detalhes)
  values('db_critical',lower(tg_op)||'_automatico',
    tg_table_schema||'.'||tg_table_name,v_entity_id,
    jsonb_build_object('operacao',tg_op,'campos',v_changed,'fonte','gatilho_bd'));
  return coalesce(new,old);
end;
$function$;

do $block$
declare v_table text;
begin
 foreach v_table in array array[
   'perguntas_avaliacao',
   'configuracoes_avaliacao',
   'configuracoes_sistema_runtime',
   'classificacoes_avaliacao',
   'usuarios_admin',
   'coordenacoes_setor',
   'manifestacoes_interesse_coordenador'
 ] loop
   execute format('drop trigger if exists rod27_audit_critical_trg on public.%I',v_table);
   execute format('create trigger rod27_audit_critical_trg after insert or update or delete on public.%I for each row execute function private.rod27_audit_critical_change()',v_table);
 end loop;
end
$block$;

-- 5. Exclusão excepcional da auditoria, apenas via RPC autorizada ao superadmin.
create table if not exists public.auditoria_exclusoes (
  id uuid primary key default gen_random_uuid(),
  registro_excluido_id uuid not null,
  superadmin_id uuid not null references auth.users(id),
  solicitado_por text not null,
  motivo text not null,
  acao_original text not null,
  entidade_original text,
  criado_em timestamptz not null default now()
);
alter table public.auditoria_exclusoes enable row level security;
revoke all on table public.auditoria_exclusoes from public,anon,authenticated;
grant select on table public.auditoria_exclusoes to service_role;

-- Proibir exclusões diretas: a operação autorizada deve deixar rastros separados.
create or replace function private.rod27_protect_audit_history()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if coalesce(current_setting('rod27.audit_removal_authorized',true),'') <> 'yes' then
    raise exception 'Histórico de auditoria protegido. Utilize a exclusão autorizada.';
  end if;
  return old;
end;
$function$;
drop trigger if exists rod27_protect_audit_history_trg on public.auditoria_sistema;
create trigger rod27_protect_audit_history_trg before update or delete on public.auditoria_sistema
 for each row execute function private.rod27_protect_audit_history();

create or replace function public.rod27_remove_audit_entry(
 p_registro uuid,p_admin uuid,p_solicitante text,p_motivo text)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
 v_original public.auditoria_sistema%rowtype;
 v_pedido text := btrim(coalesce(p_solicitante,''));
 v_motivo text := btrim(coalesce(p_motivo,''));
 v_id uuid;
begin
 if not exists (
   select 1 from public.usuarios_admin
    where user_id=p_admin and papel='superadmin' and ativo=true
 ) then
   raise exception 'Somente o Controle Superior pode remover registros da auditoria.';
 end if;
 if length(v_pedido)<3 or length(v_pedido)>160
    or length(v_motivo)<12 or length(v_motivo)>2000 then
   raise exception 'Identifique o solicitante e apresente motivo fundamentado (12 a 2.000 caracteres).';
 end if;

 select * into v_original from public.auditoria_sistema
  where id=p_registro for update;
 if not found then raise exception 'Registro de auditoria inexistente.'; end if;

 insert into public.auditoria_exclusoes(
  registro_excluido_id,superadmin_id,solicitado_por,motivo,
  acao_original,entidade_original)
 values(p_registro,p_admin,v_pedido,v_motivo,v_original.acao,v_original.entidade)
 returning id into v_id;

 perform set_config('rod27.audit_removal_authorized','yes',true);
 delete from public.auditoria_sistema where id=p_registro;
 perform set_config('rod27.audit_removal_authorized','no',true);

 insert into public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
 values(p_admin,'superadmin','audit_entry_removed','auditoria_sistema',p_registro::text,
        jsonb_build_object('exclusao_id',v_id,'solicitado_por',v_pedido,
        'motivo',v_motivo,'acao_anterior',v_original.acao));
 return jsonb_build_object('ok',true,'exclusao_id',v_id,'removido_id',p_registro);
end;
$function$;
revoke all on function public.rod27_remove_audit_entry(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.rod27_remove_audit_entry(uuid,uuid,text,text) to service_role;

-- 6. Desativa o recurso obsoleto que não correspondia à manifestação pessoal.
update public.configuracoes_sistema_runtime
set valor=jsonb_set(coalesce(valor,'{}'::jsonb),'{permitida}','false'::jsonb,true),
 descricao='Autoavaliação de desempenho desativada. Feedback do coordenador por Manifestação de Interesse.'
where chave='avaliacao.autoavaliacao.permitida';