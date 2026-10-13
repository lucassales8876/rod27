create trigger trg_validar_credencial_coordenador
before insert or update on public.coordenador_credenciais
for each row execute function private.validar_credencial_coordenador();
create trigger trg_versionar_credencial_coordenador
before update on public.coordenador_credenciais
for each row execute function private.versionar_credencial_coordenador();
