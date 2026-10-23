create table if not exists public.documentos_coordenador (
 id uuid primary key default gen_random_uuid(),
 coordenacao_id uuid not null references public.coordenacoes_setor(id) on delete restrict,
 ciclo_id uuid not null references public.ciclos_rodizio(id) on delete restrict,
 obreiro_rol text not null,
 caminho_storage text not null unique,
 nome_original text not null,
 tipo_mime text not null check(tipo_mime in ('application/pdf','image/jpeg','image/png')),
 tamanho_bytes integer not null check(tamanho_bytes>0 and tamanho_bytes<=8388608),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 enviado_por uuid not null references auth.users(id) on delete restrict,
 enviado_em timestamptz not null default now(),
 constraint documentos_coordenador_nome_check check(length(btrim(nome_original)) between 1 and 160),
 constraint documentos_coordenador_rol_check check(obreiro_rol ~ '^[0-9]{1,12}$')
);
create index if not exists documentos_coordenador_coord_rol_idx
 on public.documentos_coordenador(coordenacao_id,obreiro_rol,enviado_em desc);
alter table public.documentos_coordenador enable row level security;
revoke all on table public.documentos_coordenador from public,anon,authenticated;
grant select,insert on table public.documentos_coordenador to service_role;
comment on table public.documentos_coordenador is 'Anexos privados da ficha de uma pessoa no papel de coordenador, vinculados a coordenação/ciclo/ROL. Acesso somente por backend administrativo autenticado.';