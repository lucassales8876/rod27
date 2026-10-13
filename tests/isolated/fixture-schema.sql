create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

create table private.obreiros (
  rol text primary key,
  nome text not null
);
create table public.usuarios_admin (
  user_id uuid primary key,
  papel text not null,
  nome_exibicao text,
  ativo boolean not null default true
);
create table public.ciclos_rodizio (
  id uuid primary key default gen_random_uuid(),
  ano smallint not null unique,
  ano_base smallint not null default 2026,
  nome text not null default 'Rodízio 2027',
  status text not null default 'preparacao'
);
create table public.setores (
  id uuid primary key default gen_random_uuid(),
  numero smallint not null unique,
  area text not null default 'Fictícia',
  slug text not null default 'teste'
);
create table public.coordenacoes_setor (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ciclos_rodizio(id),
  setor_id uuid not null references public.setores(id),
  obreiro_rol text not null references private.obreiros(rol),
  coordenador_nome_snapshot text not null,
  atualizado_em timestamptz not null default now()
);
create table public.coordenador_credenciais (
  id uuid primary key default gen_random_uuid(),
  coordenacao_id uuid not null unique references public.coordenacoes_setor(id),
  rol_login text not null unique,
  senha_hash text,
  status text not null default 'ativa',
  versao integer not null default 1,
  falhas_consecutivas integer not null default 0,
  bloqueado_ate timestamptz,
  senha_alterada_em timestamptz,
  ultimo_login_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create table public.coordenador_sessoes (
  id uuid primary key default gen_random_uuid(),
  credencial_id uuid not null references public.coordenador_credenciais(id),
  sessao_hash text not null unique,
  expira_em timestamptz not null,
  revogada_em timestamptz,
  ultimo_uso_em timestamptz not null default now(),
  user_agent_hash text,
  ip_hash text
);
create table public.avaliacoes_dirigente (
  id uuid primary key default gen_random_uuid(),
  coordenacao_id uuid not null references public.coordenacoes_setor(id),
  ciclo_id uuid not null references public.ciclos_rodizio(id),
  dirigente_rol text not null,
  dirigente_nome_snapshot text not null default 'Dirigente fictício',
  dirigente_foto_url_snapshot text,
  congregacao_nome_snapshot text not null default 'Congregação fictícia',
  status text not null default 'nao_iniciada',
  eh_proprio_coordenador boolean not null default false,
  iniciada_em timestamptz,
  enviada_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create table public.auditoria_sistema (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  papel text,
  acao text not null,
  entidade text,
  entidade_id text,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create table public.configuracoes_sistema_runtime (
  chave text primary key,
  valor jsonb not null
);
create table public.paginas_coordenador (
  id uuid primary key default gen_random_uuid(),
  coordenacao_id uuid not null,
  ciclo_id uuid not null,
  rota_slug text not null default 'teste',
  ativa boolean not null default true
);
