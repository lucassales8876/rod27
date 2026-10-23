# Rod27 | Atualização de 23/10/2026

## Auditoria com duas pessoas
- Login do Controle Superior ativo é necessário.
- Dentro da aba Auditoria há um campo de senha vazio sem orientações, usado pela Secretaria-Geral para validar sua própria senha atual.
- A verificação de senha acontece no Supabase Auth em Edge Function autenticada, não no navegador.
- A autorização resultante fica somente na memória da aba e vinculada ao UUID da sessão Supabase do superadmin; não é salva em localStorage/sessionStorage.
- O banco armazena apenas hash do token de autorização e fingerprint do hash de senha do secretário. A senha nunca é guardada no banco do Rod27.
- O token tem teto de 8 horas. Logout, fechamento ou recarga da aba exigem nova validação; alteração da senha do secretário invalida imediatamente a autorização anterior no momento de tentar excluir.
- A RPC antiga de exclusão foi revogada para service_role, anon e authenticated. A função conjunta é executável apenas por service_role, valida a sessão, o token, os dois perfis ativos e a versão atual da senha.
- A exclusão exige motivo e solicitante; permanece trilha administrativa mínima.
- Não foram executadas exclusões reais para testar o fluxo.

## Rotas e logins
- Raiz e /index.html retornam HTTP 404. Os links diretos permanecem acessíveis.
- Logins público antes de autenticação sem apresentações sobre os setores e perfis.
- Há botão Mostrar/Ocultar Senha, Entrar e Esqueci a senha.
- Recuperação de senha: URL do Auth SITE_URL e URI_ALLOW_LIST ajustadas para /redefinir-senha, com página própria de redefinição e validação mínima de 12 caracteres.
- O formulário do primeiro acesso manteve e-mail, código temporário e confirmação, sem explicações internas.
- Não há segurança baseada apenas em ocultação de links: os controles de acesso backend permanecem necessários.

## Exportação detalhada
- Secretaria: CSV de andamento anterior mantido.
- Novo CSV de respostas enviadas, com escopos: todas áreas, setor selecionado, avaliação individual.
- Uma linha por pergunta, com área, setor, coordenador/ROL, congregação, dirigente/ROL, versão da avaliação, origem, data, pergunta e resposta.
- Ordenação por número da área e depois setor, seguidos de congregação e ordem da pergunta.
- Preserva form_snapshot de avaliações iniciadas e tem proteção de fórmulas de planilha para textos exportados.
- Nenhuma avaliação em rascunho é exportada como resposta final.
- Layout definitivo e relatórios visuais ficam para etapa posterior.

## Publicação e verificação
- Supabase: rod27-control v9, rod27-admin v12, rod27-coordinator v13 no momento da atualização.
- Cloudflare Pages: deploy 8b361709.
- SQL: migração 20261023154056_dupla_autorizacao_auditoria aplicada e registrada.
- has_function_privilege verificado: antiga RPC service_role=false, conjunta service_role=true, anon=false, authenticated=false.
- Secretaria-Geral ativa: 1; autorizações conjuntas emitidas no momento do teste: 0.
- / e /index.html HTTP 404; telas diretas e recuperação HTTP 200.
- Testes de sintaxe JS/TS passaram. Sem uso de contas reais nem exclusões de produção durante a homologação.
