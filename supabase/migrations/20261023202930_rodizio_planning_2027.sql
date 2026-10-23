create table public.rod27_planejamento (
 ciclo_id uuid primary key references public.ciclos_rodizio(id) on delete restrict,
 ano smallint not null default 2027 check(ano=2027),
 status text not null default 'rascunho' check(status='rascunho'),
 revisao integer not null default 0 check(revisao>=0),
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now()
);
create table public.rod27_planejamento_posicoes (
 id uuid primary key default gen_random_uuid(),
 ciclo_id uuid not null references public.rod27_planejamento(ciclo_id) on delete restrict,
 tipo text not null check(tipo in ('dirigente','coordenador')),
 destino_id uuid not null,
 obreiro_rol text,
 nome_snapshot text,
 foto_url_snapshot text,
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 unique(ciclo_id,tipo,destino_id),
 constraint rod27_planejamento_rol_unico unique(ciclo_id,tipo,obreiro_rol) deferrable initially deferred,
 constraint rod27_planejamento_rol_format check(obreiro_rol is null or obreiro_rol ~ '^[0-9]{1,12}$'),
 constraint rod27_planejamento_nome_consistencia check((obreiro_rol is null and nome_snapshot is null) or (obreiro_rol is not null and nome_snapshot is not null))
);
create table public.rod27_planejamento_eventos (
 id uuid primary key default gen_random_uuid(),
 ciclo_id uuid not null references public.rod27_planejamento(ciclo_id) on delete restrict,
 revisao integer not null,
 tipo text not null check(tipo in ('dirigente','coordenador')),
 acao text not null check(acao in ('movimentar','desfazer')),
 autor uuid not null references auth.users(id) on delete restrict,
 antes jsonb not null,
 depois jsonb not null,
 observacao text,
 criado_em timestamptz not null default now(),
 unique(ciclo_id,revisao)
);
create index rod27_planejamento_eventos_latest on public.rod27_planejamento_eventos(ciclo_id,criado_em desc);
alter table public.rod27_planejamento enable row level security;
alter table public.rod27_planejamento_posicoes enable row level security;
alter table public.rod27_planejamento_eventos enable row level security;
revoke all on public.rod27_planejamento, public.rod27_planejamento_posicoes, public.rod27_planejamento_eventos from public,anon,authenticated;
grant select,update,insert on public.rod27_planejamento to service_role;
grant select,update,insert on public.rod27_planejamento_posicoes to service_role;
grant select,insert on public.rod27_planejamento_eventos to service_role;

insert into public.rod27_planejamento(ciclo_id)
select id from public.ciclos_rodizio where ano=2027 and ano_base=2026;

insert into public.rod27_planejamento_posicoes(ciclo_id,tipo,destino_id,obreiro_rol,nome_snapshot,foto_url_snapshot)
select p.ciclo_id,'dirigente',d.congregacao_id,d.obreiro_rol,d.dirigente_nome_snapshot,d.dirigente_foto_url_snapshot
from public.rod27_planejamento p join public.designacoes d on d.vigencia_ano=2026 and d.atual=true
join public.congregacoes co on co.id=d.congregacao_id and co.ativo=true;

insert into public.rod27_planejamento_posicoes(ciclo_id,tipo,destino_id,obreiro_rol,nome_snapshot,foto_url_snapshot)
select p.ciclo_id,'coordenador',co.setor_id,co.obreiro_rol,co.coordenador_nome_snapshot,
 (select o.foto_url from private.obreiros o where o.rol=co.obreiro_rol limit 1)
from public.rod27_planejamento p join public.coordenacoes_setor co on co.ciclo_id=p.ciclo_id and co.ano_base_designacao=2026
join public.setores sec on sec.id=co.setor_id and sec.ativo=true;

do $verify$
declare n integer; m integer;
begin
 select count(*) into n from public.rod27_planejamento_posicoes where tipo='dirigente';
 select count(*) into m from public.rod27_planejamento_posicoes where tipo='coordenador';
 if n<>(select count(*) from public.designacoes d join public.congregacoes c on c.id=d.congregacao_id and c.ativo where d.vigencia_ano=2026 and d.atual) or m<>(select count(*) from public.coordenacoes_setor co join public.ciclos_rodizio cy on cy.id=co.ciclo_id and cy.ano=2027 and cy.ano_base=2026 join public.setores st on st.id=co.setor_id and st.ativo where co.ano_base_designacao=2026) then raise exception 'Semente inconsistente: % dirigentes, % coordenadores',n,m;end if;
end;$verify$;

create or replace function public.rod27_planejamento_mover(
 p_destino uuid,p_rol text,p_tipo text,p_revisao integer,p_autor uuid
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare
 v_plan public.rod27_planejamento%rowtype;
 v_dest public.rod27_planejamento_posicoes%rowtype;
 v_origem public.rod27_planejamento_posicoes%rowtype;
 v_nome text;v_foto text;v_antes jsonb;v_depois jsonb;v_revisao integer;
begin
 select * into v_plan from public.rod27_planejamento where ano=2027 for update;
 if not found or v_plan.status<>'rascunho' then raise exception 'Planejamento indisponÃ­vel';end if;
 if p_revisao<>v_plan.revisao then raise exception 'Planejamento atualizado em outra sessÃ£o. Atualize antes de salvar.';end if;
 if p_tipo not in ('dirigente','coordenador') or p_rol !~ '^[0-9]{1,12}$' then raise exception 'SeleÃ§Ã£o invÃ¡lida';end if;
 if not exists(select 1 from public.usuarios_admin where user_id=p_autor and ativo=true and papel in ('secretario_geral','superadmin')) then
  raise exception 'UsuÃ¡rio sem autorizaÃ§Ã£o para modificar planejamento';
 end if;
 select * into v_dest from public.rod27_planejamento_posicoes
  where id=p_destino and ciclo_id=v_plan.ciclo_id and tipo=p_tipo for update;
 if not found then raise exception 'Destino nÃ£o encontrado';end if;
 if v_dest.obreiro_rol is not distinct from p_rol then raise exception 'Nenhuma movimentaÃ§Ã£o necessÃ¡ria';end if;
 select * into v_origem from public.rod27_planejamento_posicoes
  where ciclo_id=v_plan.ciclo_id and tipo=p_tipo and obreiro_rol=p_rol for update;
 select nome,foto_url into v_nome,v_foto from private.obreiros where rol=p_rol limit 1;
 if v_nome is null then raise exception 'ROL nÃ£o encontrado no fichÃ¡rio';end if;
 v_antes=jsonb_build_array(jsonb_build_object('id',v_dest.id,'rol',v_dest.obreiro_rol,'nome',v_dest.nome_snapshot,'foto',v_dest.foto_url_snapshot));
 if v_origem.id is not null then
  v_antes=v_antes||jsonb_build_array(jsonb_build_object('id',v_origem.id,'rol',v_origem.obreiro_rol,'nome',v_origem.nome_snapshot,'foto',v_origem.foto_url_snapshot));
 end if;
 update public.rod27_planejamento_posicoes set obreiro_rol=p_rol,nome_snapshot=v_nome,
  foto_url_snapshot=coalesce(v_foto,v_origem.foto_url_snapshot),
  atualizado_em=now() where id=v_dest.id;
 if v_origem.id is not null then
  update public.rod27_planejamento_posicoes set obreiro_rol=v_dest.obreiro_rol,
   nome_snapshot=v_dest.nome_snapshot,foto_url_snapshot=v_dest.foto_url_snapshot,
   atualizado_em=now() where id=v_origem.id;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'rol',s.obreiro_rol,'nome',s.nome_snapshot,'foto',s.foto_url_snapshot) order by s.id),'[]'::jsonb) into v_depois
 from public.rod27_planejamento_posicoes s where s.id=v_dest.id or (v_origem.id is not null and s.id=v_origem.id);
 update public.rod27_planejamento set revisao=revisao+1,atualizado_em=now() where ciclo_id=v_plan.ciclo_id returning revisao into v_revisao;
 insert into public.rod27_planejamento_eventos(ciclo_id,revisao,tipo,acao,autor,antes,depois,observacao)
 values(v_plan.ciclo_id,v_revisao,p_tipo,'movimentar',p_autor,v_antes,v_depois,
 case when v_origem.id is not null then 'Troca entre posiÃ§Ãµes do mapa' else 'InclusÃ£o ou substituiÃ§Ã£o por ROL' end);
 return jsonb_build_object('ok',true,'revisao',v_revisao,'troca',v_origem.id is not null);
end;$fn$;

create or replace function public.rod27_planejamento_desfazer(
 p_revisao integer,p_autor uuid
) returns jsonb language plpgsql security invoker set search_path='' as $fn$
declare
 v_plan public.rod27_planejamento%rowtype;
 v_event public.rod27_planejamento_eventos%rowtype;
 v_revisao integer;
begin
 select * into v_plan from public.rod27_planejamento where ano=2027 for update;
 if not found or v_plan.status<>'rascunho' then raise exception 'Planejamento indisponÃ­vel';end if;
 if p_revisao<>v_plan.revisao then raise exception 'Planejamento alterado em outra sessÃ£o';end if;
 if not exists(select 1 from public.usuarios_admin where user_id=p_autor and ativo=true and papel in ('secretario_geral','superadmin')) then raise exception 'Sem permissÃ£o';end if;
 select * into v_event from public.rod27_planejamento_eventos where ciclo_id=v_plan.ciclo_id and revisao=v_plan.revisao;
 if not found then raise exception 'Nenhuma alteraÃ§Ã£o disponÃ­vel para desfazer';end if;
 update public.rod27_planejamento_posicoes s
 set obreiro_rol=b.rol,nome_snapshot=b.nome,foto_url_snapshot=b.foto,atualizado_em=now()
 from jsonb_to_recordset(v_event.antes) as b(id uuid,rol text,nome text,foto text)
 where s.id=b.id and s.ciclo_id=v_plan.ciclo_id;
 update public.rod27_planejamento set revisao=revisao+1,atualizado_em=now() where ciclo_id=v_plan.ciclo_id returning revisao into v_revisao;
 insert into public.rod27_planejamento_eventos(ciclo_id,revisao,tipo,acao,autor,antes,depois,observacao)
 values(v_plan.ciclo_id,v_revisao,v_event.tipo,'desfazer',p_autor,v_event.depois,v_event.antes,
 'ReversÃ£o da revisÃ£o '||v_event.revisao);
 return jsonb_build_object('ok',true,'revisao',v_revisao,'revisao_desfeita',v_event.revisao);
end;$fn$;
revoke all on function public.rod27_planejamento_mover(uuid,text,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.rod27_planejamento_desfazer(integer,uuid) from public,anon,authenticated;
grant execute on function public.rod27_planejamento_mover(uuid,text,text,integer,uuid) to service_role;
grant execute on function public.rod27_planejamento_desfazer(integer,uuid) to service_role;
