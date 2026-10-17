# Rod27 | Execução de correções em 17/10/2026

## Resultado verificado

- Auditoria original preservada em `C:\Users\secre\Documents\Rod27-Codex-Audit-20261017`.
- Cópia de correção e testes no Lenovo: `C:\Users\secre\Documents\Rod27-Fixes-20261017`.
- Supabase `zrjxxcytgtjuuinhkfux`: `rod27-coordinator` **v10** (antes v9) e `rod27-admin` **v9** (antes v8); implantadas pelo Lenovo com `--use-api --no-verify-jwt`. Não foi aplicada migração SQL.
- Cloudflare Pages `rod27-ieadern`: cinco páginas publicadas pelo Mac. Rotas `/`, `/coordenador`, `/secretaria`, `/controle` e `/primeiro-acesso` com HTTP 200.
- GitHub: `origin/main`, commit **3a79579**, publicação sincronizada.
- Nenhum PIN real, usuário real, resposta real ou manifestação real foi utilizado nos testes de concorrência.

## Oito achados com correções aplicadas

1. **P1 concorrência de PIN**: atualização condicional do contador (`falhas_consecutivas`, `status`, `versao`); desbloqueio e login bem-sucedido passam por guardas condicionais. **Não foi acrescentado limite distribuído por IP.**
2. **P2 resposta em avaliação errada**: salvamento fixa `avaliacao_id` ao agendar, não depende mais do estado global corrente.
3. **P2 escolha de rádio perdida**: revisão aguarda todos os salvamentos pendentes, inclusive escolhas únicas; erro impede avançar.
4. **P2 manifestação enviada voltar a rascunho**: eliminou `upsert` irrestrito; transição condicional `status=rascunho`; a disputa entre primeiros INSERTs é tratada sem reabrir registros enviados.
5. **P2 formulário impresso diverge do publicado**: impressão, leitura administrativa e transcrição filtram perguntas `status=publicada`.
6. **P2 revisor consulta documentos e rascunhos**: ações administrativas de documento original, URL assinada e transcrição exigem `canOperate`; revisão de respostas enviadas permanece disponível.
7. **P3 interface oferece ações ao revisor**: controles de alteração/classificação e consulta de documento original ocultados ao papel revisor.
8. **P3 sessão expirada**: interfaces de coordenador, secretaria e controle encaminham ao login nos cenários HTTP 401/403 pertinentes.

## Testes executados

- Três testes comportamentais do frontend: troca rápida de avaliações, rádio antes da revisão e bloqueio em falha de salvamento. **PASS**.
- Dois cenários simulados de concorrência de PIN (3 e 20 tentativas; limite 5). **PASS**.
- Dois cenários simulados de concorrência de manifestação (ordens inversas de chegada). **PASS**.
- Parsing estático de todos os cinco scripts HTML, de `rod27-admin`, `rod27-coordinator` e `rod27-control`. **PASS**. O módulo `rod27-first-access` ficou inalterado; sua sintaxe TypeScript não é analisável pelo Node em modo CJS.
- Verificação local adicional de condições de segurança, permissões e filtros: **PASS**.
- Smoke HTTP: rotas Cloudflare **200**; `rod27-coordinator` sem sessão **401**.
- Sem teste autenticado completo do fluxo real em produção ou homologação e sem prova de resistência a uma carga distribuída real.

## Quatro achados pendentes da auditoria

1. **P2 autoavaliação**: decidir se a ficha própria poderá ser preenchida pelo coordenador ou exclusivamente pela Secretaria; o controle administrativo hoje não produz efeito completo no backend.
2. **P2 convite de primeiro acesso**: substituir signup com metadado fornecido pelo cliente por resgate server-side de convite, com validação de hash/e-mail/validade/uso único e provisionamento de `usuarios_admin`. Revisar hooks de Auth antes.
3. **P2 versionamento do formulário**: definir modelo de versões imutáveis vinculadas a cada avaliação para mudanças depois de respostas iniciadas. Exige compatibilidade com perguntas/avaliações históricas e alteração de schema.
4. **P3 auditoria administrativa**: exigir registros de auditoria confiáveis e transacionais nas operações críticas, preservando semântica idempotente e evitando sucesso de ação sem log.

## Riscos e cuidados remanescentes

- Rate limiting de PIN **por IP** não foi implementado; a correção do contador por credencial reduz a falha de concorrência, mas não substitui defesa contra abuso e negação de serviço.
- Recomenda-se executar homologação com contas e ROLs sintéticos para validar todas as permissões, o envio real e o comportamento em rede.
- Para reversão, consultar os arquivos de snapshot original no Lenovo e o histórico de versões publicado no Supabase/Cloudflare. Reversão deve preservar `verify_jwt=false` nas funções atuais e ser testada.
- Não executar novamente scripts de patch da pasta de correção; os arquivos finais já contêm as alterações.

## Arquivos de código modificados

- `frontend/coordenador.html`
- `frontend/secretaria.html`
- `frontend/controle.html`
- `supabase/functions/rod27-coordinator/index.ts`
- `supabase/functions/rod27-admin/index.ts`

O restante das páginas permaneceu inalterado funcionalmente. O `deno.json` do admin no commit perdeu somente o caractere de nova linha final.