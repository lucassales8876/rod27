# Rod27 — estado do projeto

Atualização em 13/10/2026: migração corretiva aplicada em produção; fluxo de
fichas especiais preparado e testado, aguardando confirmação administrativa.

Em 12/10/2026, a gestão protegida dos PINs dos coordenadores foi publicada em
`https://rod27-ieadern.pages.dev/controle`. Branch `main`; implementação nos
commits `5a86e10` e `fcb7e64`.

## Alteração

- Os 42 PINs da planilha restrita foram validados contra as credenciais atuais:
  42 correspondências, nenhuma divergência. Nenhum PIN foi redefinido.
- O Supabase Vault guarda os 42 códigos cifrados. A tabela de vínculo fica em
  `private` e só funções administrativas com permissão de serviço a acessam.
- O Controle Superior permite mostrar e copiar um PIN confirmado. Consultas
  entram na auditoria. Redefinição e troca de coordenador usam transação única
  para atualizar hash, Vault, versão, sessões e auditoria.
- Funções `rod27-admin` v6 e `rod27-control` v3 implantadas; interface estática
  publicada na Cloudflare Pages e enviada ao GitHub.

## Verificação

- 42 registros válidos, sem duplicidade de setor, ROL ou PIN; três PINs com zero
  inicial foram preservados.
- Consulta no navegador com sessão de superadmin mostrou seis dígitos e opção
  de cópia. Requisições anônimas às funções sensíveis retornaram 403/401.
- Papéis `anon` e `authenticated` não têm leitura da tabela de vínculo nem
  execução das funções de consulta e atualização dos PINs.
- Controle, Secretaria e Coordenador responderam HTTP 200 na Cloudflare.
- Redefinição e troca de coordenador não foram executadas sobre credenciais reais;
  os fluxos foram testados em ambiente local isolado em 12/10/2026.

## Validação isolada de 12/10/2026

- Ambiente Supabase local, com ROLs, nomes, PINs, usuário administrativo e fichas
  fictícios. O roteiro local `../rod27-isolated/test-flow.mjs` passou após a correção.
- Redefinição: PIN aleatório de seis dígitos aceito no login; PIN anterior recusado;
  Vault atualizado; sessão anterior revogada; operação auditada.
- Troca: ROL e nome novos aparecem no login e na sessão; ROL anterior e sessão
  anterior recusados; Vault atualizado; operação auditada. Os detalhes de
  auditoria não contêm PIN.
- Defeito encontrado: a troca não recalculava a ficha especial quando ela já
  estava em preenchimento. A migração
  `20261012230000_recalculate_coordinator_draft.sql` corrige fichas não
  iniciadas e em preenchimento, preservando fichas já enviadas. A contagem e a
  visão do novo coordenador passaram no teste repetido.
- Conferência somente de leitura na produção: 42 credenciais, 42 vínculos no
  Vault e nenhuma ficha iniciada. Nenhuma redefinição nem troca foi executada
  na produção.

## Migração corretiva em produção — 13/10/2026

- SQL do commit `960ff91` revisado contra a definição atual: a única mudança
  funcional é incluir `em_preenchimento` no recálculo de futuras trocas.
  `CREATE OR REPLACE FUNCTION` não executou alterações de dados.
- Aplicada como `recalculate_coordinator_draft`, versão do banco
  `20261013172842`. O arquivo de origem continua sendo
  `20261012230000_recalculate_coordinator_draft.sql`; o horário da versão foi
  atribuído pelo Supabase na aplicação. Commit sincronizado em `origin/main`.
- Definição anterior guardada para reversão em
  `docs/recovery/20261013-recalculate-coordinator-rollback.sql` na PR de preparação;
  cópia local em `../rod27-recovery`. Não foi necessário copiar dados pessoais
  para recuperar uma substituição de função que não modifica registros.
- Impressões digitais antes/depois idênticas para credenciais, vínculos do Vault,
  coordenadores, fichas, respostas e perguntas. Conferência final: 42 credenciais,
  42 PINs do Vault válidos contra seus hashes, 253 fichas, 42 especiais, zero
  respostas e seis perguntas em rascunho. Nenhum PIN ou coordenador real alterado.
- Permissões preservadas: função restrita a `service_role`; `anon` e
  `authenticated` não podem executá-la. Secretaria e Controle responderam HTTP 200.

## Fichas especiais — preparação

- Branch `feat/special-evaluations-preparation`, código no commit `a5d3e9a`.
  [PR #1, em rascunho](https://github.com/lucassales8876/rod27/pull/1).
- Designação por ROL, nome do fichário, função e referência de autorização;
  estados, autoria, impressão, original privado, transcrição manual, conferência
  e histórico. A nova tabela referencia a ficha existente, sem duplicação.
- Regra bloqueada por padrão no servidor. Migração aditiva, função `rod27-special`
  e interface ainda não implantadas na produção. Nenhum avaliador real designado.
- Proposta e decisões: `docs/FICHAS_ESPECIAIS.md` na branch de preparação.
  Acesso digital usa outra identidade já existente; avaliador sem acesso digital
  utiliza papel. Rascunhos de origem anterior exigem revisão, sem sobrescrita;
  envios históricos permanecem intactos.
- `tests/isolated/pin-flow.mjs` e `special-flow.mjs` aprovados no Supabase local:
  PIN/Vault/sessões; autoavaliação e acesso indevido; avaliador digital; papel/PDF
  privado e íntegro; auditoria; trocas não iniciadas/em preenchimento; reclassificação
  e inativação de designações antigas; preservação de respostas e envios.
- Interface de impressão, transcrição, conclusão, autoria e consulta do original
  conferida com dados fictícios. Seletor de upload da automação indisponível;
  upload validado pelo endpoint local real, sem mocks.
- Função nova passou no `deno check`, inclusive Deno 2.1.4; JavaScript das páginas
  e revisão de whitespace aprovados. A função administrativa herdada mantém
  17 erros de nulabilidade também presentes em `960ff91`; registrados fora do
  escopo, sem impedir os testes de execução. Não foram corrigidos nesta missão.

## Pendências para liberação oficial

- As seis perguntas seguem em rascunho e dependem de autorização da Secretaria
  Geral; nenhuma foi alterada ou publicada.
- Há uma conta administrativa ativa; o segundo acesso previsto no painel ainda
  está pendente.
- O painel indica 42 fichas especiais que ainda precisam de regra definida.
- Bloqueios da liberação oficial: confirmação do procedimento pelo pastor Rubem,
  implantação/ativação posterior do fluxo especial e publicação especificamente
  autorizada do formulário e das seis perguntas. A migração corretiva está concluída.
- O segundo acesso administrativo continua previsto; não foi identificado como
  bloqueio técnico dos fluxos já testados.
- Aviso de segurança preexistente: [proteção contra senhas vazadas desativada no
  Auth](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  Não houve alteração dessa configuração fora do escopo.

Próximo objetivo: obter a confirmação do pastor Rubem para o procedimento
documentado na PR #1, antes de ativar o fluxo especial em produção.
\n## 2026-10-14 — Editor administrativo de perguntas\n- Controle Superior /controle > Formulário: editar título, enunciado, formato discursivo/múltipla escolha, alternativas e obrigatoriedade; criar e arquivar perguntas em rascunho.\n- API rod27-control v4 implementa validação em servidor, ações update_question, create_question, archive_question e auditoria.\n- Cloudflare Pages publicada, HTTP 200; requisição não autenticada ao backend recusada com 403. Teste autenticado completo ainda depende de sessão válida.\n- Seis perguntas originais mantidas em rascunho, sem alterações de conteúdo nem publicação automática.\n- Pastor Rubem autorizou a regra de designação de outro avaliador para as 42 fichas especiais. Implantação da PR especial precisa de revisão e deploy separados.\n
## 2026-10-14 — Publicação controlada do formulário
- rod27-coordinator v5: perguntas somente com status publicada e config publicada; confirm_notice, save_answer e submit recusam formulário em rascunho.
- Preserva as 42 credenciais, os PINs no Vault e as 253 avaliações. Não publica perguntas automaticamente.

## 2026-10-14 — Autorização e entrega do formulário v1
- Seis perguntas originais oficialmente publicadas com autorização do responsável; autoavaliação dos 42 coordenadores permitida de forma reversível. Migrações rod27_publish_approved_six_questions_and_authorize_self_evaluation e rod27_protect_published_question_edits_by_cycle aplicadas ao Supabase.
- Supabase rod27-coordinator v6, rod27-admin v7, rod27-control v5; código vivo recuperado para o repositório.
- Interfaces coordenador, Secretaria e Controle sincronizadas; Cloudflare Pages publicada: https://fc57cd79.rod27-ieadern.pages.dev.
- Restam homologação autenticada de ponta a ponta em ambiente isolado, revisão visual profunda e ativação humana do acesso do Pr. Rubem.
