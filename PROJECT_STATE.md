# Rod27 — estado do projeto

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

## Pendências para liberação oficial

- As seis perguntas seguem em rascunho e dependem de autorização da Secretaria
  Geral; nenhuma foi alterada ou publicada.
- Há uma conta administrativa ativa; o segundo acesso previsto no painel ainda
  está pendente.
- O painel indica 42 fichas especiais que ainda precisam de regra definida.
- A migração corretiva está no código, testada localmente, mas ainda não foi
  aplicada na produção. A liberação oficial continua pendente.

Próximo objetivo: aplicar a migração corretiva na janela de liberação, depois
de definir com a Secretaria Geral o tratamento das fichas especiais.
