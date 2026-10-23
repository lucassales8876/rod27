-- Dupla autorização para exclusão: superadmin + senha atual do secretário-geral.
-- Não armazenar a senha. O Postgres acompanha mudança de senha pelo fingerprint
-- do hash GoTrue, e nenhuma RPC antiga permanece executável pela role service_role.
create table if not exists public.rod27_audit_grants (
 id uuid primary key default gen_random_uuid(),
 superadmin_id uuid not null references auth.users(id),
 secretario_id uuid not null references auth.users(id),
 session_id uuid not null,
 token_hash text not null,
 senha_fingerprint text not null,
 criado_em timestamptz not null default now(),
 expira_em timestamptz not null default (now()+interval '8 hours')
);
create unique index if not exists rod27_audit_grants_token_uidx on public.rod27_audit_grants(token_hash);
create index if not exists rod27_audit_grants_expira_idx on public.rod27_audit_grants(expira_em);
alter table public.rod27_audit_grants enable row level security;
revoke all on public.rod27_audit_grants from public,anon,authenticated;
grant select, insert, delete on public.rod27_audit_grants to service_role;

create or replace function public.rod27_issue_joint_audit_grant(
 p_superadmin uuid,p_secretario uuid,p_session uuid,p_token_hash text
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare v_fingerprint text;
begin
 if p_superadmin=p_secretario then raise exception 'Autorizações precisam ser de pessoas diferentes.'; end if;
 if p_session is null or length(p_token_hash)<>64
    or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Sessão ou autorização inválida.'; end if;
 if not exists (select 1 from public.usuarios_admin where user_id=p_superadmin and papel='superadmin' and ativo=true)
 or not exists (select 1 from public.usuarios_admin where user_id=p_secretario and papel='secretario_geral' and ativo=true)
 then raise exception 'Os dois perfis administrativos precisam estar ativos.'; end if;
 select encode(extensions.digest(encrypted_password,'sha256'),'hex')
 into v_fingerprint from auth.users where id=p_secretario and encrypted_password is not null;
 if v_fingerprint is null then raise exception 'Credencial do secretário indisponível.'; end if;
 delete from public.rod27_audit_grants where expira_em <=now();
 insert into public.rod27_audit_grants(superadmin_id,secretario_id,session_id,token_hash,senha_fingerprint)
 values (p_superadmin,p_secretario,p_session,p_token_hash,v_fingerprint);
 insert into public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
 values(p_superadmin,'superadmin','joint_audit_authorized','auditoria_sistema',p_superadmin::text,
   jsonb_build_object('secretario_id',p_secretario,'sessao_id',p_session,'validade_maxima_horas',8));
 return jsonb_build_object('ok',true);
end;
$function$;
revoke all on function public.rod27_issue_joint_audit_grant(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.rod27_issue_joint_audit_grant(uuid,uuid,uuid,text) to service_role;

create or replace function public.rod27_remove_audit_entry_joint(
 p_registro uuid,p_admin uuid,p_solicitante text,p_motivo text,
 p_session uuid,p_token_hash text
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare v_auth public.rod27_audit_grants%rowtype; v_current text; v_result jsonb;
begin
 select * into v_auth from public.rod27_audit_grants
 where superadmin_id=p_admin and session_id=p_session and token_hash=p_token_hash
 and expira_em>now() for update;
 if not found then raise exception 'Autorização conjunta inexistente ou expirada.'; end if;
 if not exists(select 1 from public.usuarios_admin where user_id=p_admin and papel='superadmin' and ativo=true)
 or not exists(select 1 from public.usuarios_admin where user_id=v_auth.secretario_id and papel='secretario_geral' and ativo=true)
 then raise exception 'A autorização conjunta não possui os dois perfis ativos.'; end if;
 select encode(extensions.digest(encrypted_password,'sha256'),'hex') into v_current
 from auth.users where id=v_auth.secretario_id;
 if v_current is null or v_current<>v_auth.senha_fingerprint then
   raise exception 'A senha do segundo autorizador foi alterada. Autorize novamente.';
 end if;
 v_result:=public.rod27_remove_audit_entry(p_registro,p_admin,p_solicitante,p_motivo);
 insert into public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
 values(p_admin,'superadmin','joint_audit_removal_confirmed','auditoria_exclusoes',p_registro::text,
   jsonb_build_object('secretario_id',v_auth.secretario_id,'sessao_id',p_session));
 return v_result;
end;
$function$;
revoke all on function public.rod27_remove_audit_entry_joint(uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.rod27_remove_audit_entry_joint(uuid,uuid,text,text,uuid,text) to service_role;

-- A rota anterior não deve mais aceitar exclusões, nem usando chave de serviço.
revoke all on function public.rod27_remove_audit_entry(uuid,uuid,text,text) from service_role;