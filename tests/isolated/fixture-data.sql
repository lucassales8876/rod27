insert into private.obreiros(rol,nome) values
 ('900001','Coordenador Antigo Fictício'),
 ('900002','Coordenador Novo Fictício'),
 ('900003','Dirigente Fictício');

insert into public.ciclos_rodizio(ano) values (2027);
insert into public.setores(numero) values (1);
insert into public.coordenacoes_setor(ciclo_id,setor_id,obreiro_rol,coordenador_nome_snapshot)
select c.id,s.id,'900001','Coordenador Antigo Fictício'
from public.ciclos_rodizio c cross join public.setores s
where c.ano=2027 and s.numero=1;
insert into public.coordenador_credenciais(coordenacao_id,rol_login,senha_hash,status)
select id,'900001',extensions.crypt('000123',extensions.gen_salt('bf',10)),'ativa'
from public.coordenacoes_setor;
insert into public.paginas_coordenador(coordenacao_id,ciclo_id)
select id,ciclo_id from public.coordenacoes_setor;
insert into public.configuracoes_sistema_runtime(chave,valor) values
 ('coordenador.login.max_falhas','5'::jsonb),
 ('coordenador.login.bloqueio_minutos','15'::jsonb),
 ('coordenador.sessao.horas','12'::jsonb);

insert into public.avaliacoes_dirigente(
 coordenacao_id,ciclo_id,dirigente_rol,status,eh_proprio_coordenador
) select cs.id,cs.ciclo_id,x.rol,x.status,x.special
from public.coordenacoes_setor cs cross join (
 values
  ('900001','nao_iniciada',true),
  ('900002','em_preenchimento',false),
  ('900003','nao_iniciada',false)
) x(rol,status,special);

do $$
declare v_id uuid;
begin
 select id into v_id from public.coordenador_credenciais where rol_login='900001';
 insert into private.coordinator_pin_vault(credencial_id,vault_secret_id,rol,versao)
 values(v_id,vault.create_secret('000123','rod27-pin-'||v_id::text,'Teste fictício'),'900001',1);
end;
$$;
