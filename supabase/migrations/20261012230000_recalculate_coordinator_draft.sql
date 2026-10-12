-- Recalcula a ficha da coordenação também quando a avaliação está em preenchimento.
-- Fichas já enviadas preservam o registro histórico.
CREATE OR REPLACE FUNCTION public.rod27_trocar_coordenador(p_setor smallint, p_novo_rol text, p_novo_hash text, p_admin uuid)
 RETURNS TABLE(rol text, nome text, rol_anterior text, fichas_especiais integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_setor uuid;
        v_coord public.coordenacoes_setor%rowtype;
        v_cred public.coordenador_credenciais%rowtype;
        v_ob private.obreiros%rowtype;
        v_new text := btrim(p_novo_rol);
        v_especiais integer;
begin
 if not exists(select 1 from public.usuarios_admin a
   where a.user_id=p_admin and a.ativo=true and a.papel in ('superadmin','secretario_geral'))
 then raise exception 'Acesso administrativo não autorizado.'; end if;
 if p_novo_hash not like 'pbkdf2-sha256$%' then raise exception 'Formato do hash de PIN inválido.'; end if;
 select s.id into v_setor from public.setores s where s.numero=p_setor;
 if not found then raise exception 'Setor inexistente.'; end if;
 select c.* into v_coord from public.coordenacoes_setor c
 join public.ciclos_rodizio z on z.id=c.ciclo_id and z.ano=2027
 where c.setor_id=v_setor for update of c;
 if not found then raise exception 'Coordenação não encontrada.'; end if;
 if v_coord.obreiro_rol=v_new then raise exception 'O ROL informado já é o coordenador deste setor. Use Redefinir PIN.'; end if;
 select o.* into v_ob from private.obreiros o where o.rol=v_new;
 if not found then raise exception 'ROL não encontrado no fichário de obreiros.'; end if;
 if exists(select 1 from public.coordenacoes_setor c
   where c.ciclo_id=v_coord.ciclo_id and c.obreiro_rol=v_new and c.id<>v_coord.id)
 then raise exception 'Este ROL já coordena outro setor neste ciclo.'; end if;
 select c.* into v_cred from public.coordenador_credenciais c
 where c.coordenacao_id=v_coord.id for update;
 if not found then raise exception 'Credencial antiga não encontrada.'; end if;
 update public.coordenador_sessoes set revogada_em=now()
 where credencial_id=v_cred.id and revogada_em is null;
 update public.coordenacoes_setor set obreiro_rol=v_new,coordenador_nome_snapshot=v_ob.nome,
 atualizado_em=now() where id=v_coord.id;
 update public.coordenador_credenciais
 set rol_login=v_new,senha_hash=p_novo_hash,status='ativa',versao=v_cred.versao+1,
     falhas_consecutivas=0,bloqueado_ate=null,senha_alterada_em=now(),atualizado_em=now()
 where id=v_cred.id;
 update public.avaliacoes_dirigente
 set eh_proprio_coordenador=(dirigente_rol=v_new),atualizado_em=now()
 where coordenacao_id=v_coord.id and ciclo_id=v_coord.ciclo_id
   and status in ('nao_iniciada','em_preenchimento');
 select count(*)::integer into v_especiais from public.avaliacoes_dirigente
 where coordenacao_id=v_coord.id and ciclo_id=v_coord.ciclo_id and eh_proprio_coordenador;
 insert into public.auditoria_sistema(user_id,papel,acao,entidade,entidade_id,detalhes)
 select p_admin,a.papel,'trocar_coordenador','coordenacoes_setor',v_coord.id::text,
 jsonb_build_object('setor',p_setor,'rol_anterior',v_coord.obreiro_rol,'rol_novo',v_new,
 'fichas_especiais',v_especiais,'sessoes_revogadas',true)
 from public.usuarios_admin a where a.user_id=p_admin;
 return query select v_ob.rol,v_ob.nome,v_coord.obreiro_rol,v_especiais;
end;
$function$;
