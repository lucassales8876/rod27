alter table public.usuarios_admin add column if not exists rol text;
alter table public.avaliacoes_dirigente add column if not exists congregacao_id uuid not null default gen_random_uuid();
alter table public.avaliacoes_dirigente add column if not exists aviso_confirmado_em timestamptz;
alter table public.avaliacoes_dirigente add column if not exists origem_preenchimento text not null default 'coordenador'
 check (origem_preenchimento in ('coordenador','secretaria_transcricao'));
alter table public.avaliacoes_dirigente add column if not exists transcrito_por uuid references auth.users(id);
alter table public.avaliacoes_dirigente add column if not exists documento_fonte_id uuid;
create table if not exists public.configuracoes_avaliacao (
 id uuid primary key default gen_random_uuid(), ciclo_id uuid not null unique references public.ciclos_rodizio(id),
 versao integer not null default 1, status text not null default 'rascunho',
 titulo_aviso text not null, texto_aviso text not null, permite_edicao_apos_envio boolean not null default false
);
create table if not exists public.perguntas_avaliacao (
 id uuid primary key default gen_random_uuid(),ciclo_id uuid not null references public.ciclos_rodizio(id),
 codigo text not null,versao integer not null default 1,categoria text not null,titulo text not null,enunciado text not null,
 tipo_resposta text not null,opcoes jsonb,obrigatoria boolean not null default true,
 ordem integer not null,ativa boolean not null default true,status text not null default 'rascunho'
);
create table if not exists public.respostas_avaliacao (
 id uuid primary key default gen_random_uuid(),avaliacao_id uuid not null references public.avaliacoes_dirigente(id),
 pergunta_id uuid not null references public.perguntas_avaliacao(id),resposta_texto text,resposta_opcao text,
 criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now(),
 unique(avaliacao_id,pergunta_id),check ((resposta_texto is not null and resposta_opcao is null) or (resposta_opcao is not null and resposta_texto is null))
);
create table if not exists public.documentos_avaliacao (
 id uuid primary key default gen_random_uuid(),avaliacao_id uuid not null references public.avaliacoes_dirigente(id),
 caminho_storage text not null unique,nome_original text not null,tipo_mime text not null
 check(tipo_mime in ('application/pdf','image/jpeg','image/png')),
 tamanho_bytes integer not null check(tamanho_bytes between 1 and 8388608),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),enviado_por uuid not null references auth.users(id),
 enviado_em timestamptz not null default now(),status_ocr text not null default 'nao_processado'
);
create table if not exists public.transcricoes_secretaria (
 avaliacao_id uuid primary key references public.avaliacoes_dirigente(id),respostas jsonb not null default '[]',
 documento_id uuid references public.documentos_avaliacao(id),transcrito_por uuid not null references auth.users(id),
 criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now()
);
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security',t.tablename);
  execute format('revoke all on public.%I from anon,authenticated',t.tablename);
  execute format('grant all on public.%I to service_role',t.tablename);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('rod27-documentos','rod27-documentos',false,8388608,array['application/pdf','image/jpeg','image/png'])
 on conflict(id) do nothing;
revoke all on function public.rod27_trocar_coordenador(smallint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.rod27_trocar_coordenador(smallint,text,text,uuid) to service_role;
