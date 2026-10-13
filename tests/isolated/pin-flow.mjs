import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {sql,post,authUser,status} from './common.mjs';
const service=status.SERVICE_ROLE_KEY,publishable=status.PUBLISHABLE_KEY;
const sqlLiteral = s => "'" + s.replaceAll("'", "''") + "'";
function expectStatus(result, status, label) {
  assert.equal(result.status, status, `${label}: ${result.data.error ?? JSON.stringify(result.data)}`);
}
function resetData() {
  sql(`truncate public.auditoria_sistema, private.coordinator_pin_vault, public.coordenador_sessoes,
    public.coordenador_credenciais, public.avaliacoes_dirigente,
    public.paginas_coordenador, public.coordenacoes_setor, public.setores,
    public.ciclos_rodizio, private.obreiros, public.configuracoes_sistema_runtime
    cascade;`);
  sql(readFileSync(new URL('fixture-data.sql', import.meta.url), 'utf8'));
}

resetData();
const email = 'admin@rod27.test';
const password = 'Ficticio-Apenas-Local-2026!';
const create = await post('/auth/v1/admin/users',
  { email, password, email_confirm: true },
  { apikey: service, Authorization: 'Bearer ' + service });
assert.ok([200, 201, 422].includes(create.status), 'criação de usuário local');
const auth = await post('/auth/v1/token?grant_type=password',
  { email, password }, { apikey: publishable });
expectStatus(auth, 200, 'login administrativo local');
const adminToken = auth.data.access_token;
const userId = auth.data.user.id;
assert.match(userId, /^[0-9a-f-]{36}$/);
sql(`insert into public.usuarios_admin(user_id,papel,nome_exibicao)
     values('${userId}','superadmin','Administrador Fictício')
     on conflict(user_id) do update set papel='superadmin',ativo=true;`);

const coordinator = body => post('/functions/v1/rod27-coordinator', body);
const withSession = (token, body) => post('/functions/v1/rod27-coordinator', body,
  { 'x-rod27-session': token });
const admin = body => post('/functions/v1/rod27-admin', body,
  { Authorization: 'Bearer ' + adminToken });

const before = await coordinator({ action: 'login', rol: '900001', senha: '000123' });
expectStatus(before, 200, 'PIN inicial');
const oldSession = before.data.session_token;
assert.ok(oldSession?.length >= 32);
expectStatus(await withSession(oldSession, { action: 'bootstrap' }), 200, 'sessão inicial');
console.log('PASS login e sessão iniciais');

const reset = await admin({ action: 'reset_coordinator_pin', setor: 1 });
expectStatus(reset, 200, 'redefinição');
const newPin = reset.data.pin;
assert.match(newPin, /^\d{6}$/);
assert.notEqual(newPin, '000123');
assert.equal(reset.data.rol, '900001');
expectStatus(await coordinator({ action: 'login', rol: '900001', senha: '000123' }),
  401, 'PIN antigo após redefinição');
expectStatus(await withSession(oldSession, { action: 'bootstrap' }),
  401, 'sessão antiga após redefinição');
const afterReset = await coordinator({ action: 'login', rol: '900001', senha: newPin });
expectStatus(afterReset, 200, 'PIN novo após redefinição');
const resetSession = afterReset.data.session_token;
assert.equal(sql(`select (d.decrypted_secret=${sqlLiteral(newPin)})::text
  from private.coordinator_pin_vault m
  join vault.decrypted_secrets d on d.id=m.vault_secret_id
  join public.coordenador_credenciais c on c.id=m.credencial_id
  where c.rol_login='900001' and m.versao=c.versao and m.rol=c.rol_login;`), 'true');
assert.equal(sql(`select count(*) from public.auditoria_sistema
  where acao='reset_coordinator_pin';`), '1');
console.log('PASS redefinição: novo login, PIN antigo, Vault, sessão e auditoria');

const changed = await admin({ action: 'office_change_coordinator', setor: 1, rol: '900002' });
expectStatus(changed, 200, 'troca de coordenador');
assert.match(changed.data.pin, /^\d{6}$/);
assert.equal(changed.data.coordenador.rol, '900002');
assert.equal(changed.data.coordenador.nome, 'Coordenador Novo Fictício');
assert.equal(changed.data.coordenador.fichas_especiais, 1);
expectStatus(await coordinator({ action: 'login', rol: '900001', senha: newPin }),
  401, 'ROL anterior após troca');
expectStatus(await withSession(resetSession, { action: 'bootstrap' }),
  401, 'sessão anterior após troca');
const newCoordinator = await coordinator({
  action: 'login', rol: '900002', senha: changed.data.pin,
});
expectStatus(newCoordinator, 200, 'login do novo coordenador');
assert.equal(newCoordinator.data.coordinator.nome, 'Coordenador Novo Fictício');
assert.equal(newCoordinator.data.coordinator.rol, '900002');
const newSession = newCoordinator.data.session_token;
const newView = await withSession(newSession, { action: 'bootstrap' });
expectStatus(newView, 200, 'permissões do novo coordenador');
assert.equal(newView.data.coordinator.rol, '900002');
assert.equal(newView.data.progress.tratamento_especial, 1);
assert.equal(newView.data.cards.find(x => x.dirigente_rol === '900002').eh_proprio_coordenador, true);
assert.equal(newView.data.cards.find(x => x.dirigente_rol === '900001').eh_proprio_coordenador, false);
assert.equal(sql(`select (d.decrypted_secret=${sqlLiteral(changed.data.pin)})::text
  from private.coordinator_pin_vault m
  join vault.decrypted_secrets d on d.id=m.vault_secret_id
  join public.coordenador_credenciais c on c.id=m.credencial_id
  where c.rol_login='900002' and m.versao=c.versao and m.rol=c.rol_login;`), 'true');
assert.equal(sql(`select count(*) from public.auditoria_sistema
  where acao='trocar_coordenador';`), '1');
console.log('PASS troca: ROL, nome, login, sessão, Vault e auditoria');

const special = sql(`select count(*)::text || ':' ||
  coalesce(string_agg(dirigente_rol,',' order by dirigente_rol),'')
  from public.avaliacoes_dirigente where eh_proprio_coordenador;`);
assert.equal(special, '1:900002', `fichas especiais após troca: ${special}`);
assert.equal(sql(`select count(*) from public.auditoria_sistema
  where acao in ('reset_coordinator_pin','trocar_coordenador')
  and detalhes ? 'pin';`), '0');
console.log('PASS recálculo das fichas especiais');
