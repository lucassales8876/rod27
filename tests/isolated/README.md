# Validação local do Rod27

Todos os nomes, ROLs, PINs, contas, perguntas, respostas e documentos são
fictícios. Os scripts recusam uma API diferente de `http://127.0.0.1:55421` e
exigem o projeto Docker `rod27-isolated`. Não forneça chaves de produção.

## Preparação

O ambiente reutilizado nesta sessão está em `../rod27-isolated`. Para um novo
ambiente, inicialize o Supabase CLI 2.120.0 em uma pasta separada e configure:
`project_id = "rod27-isolated"`, API `55421`, banco `55422`, shadow `55420`.
O Docker deve estar disponível. O Storage precisa estar ativo.

```sh
npm exec --yes --package=supabase@2.120.0 -- supabase init
npm exec --yes --package=supabase@2.120.0 -- supabase start -x realtime,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor
```

No repositório, prepare tabelas e funções fictícias:

```sh
node tests/isolated/setup.mjs /caminho/rod27-isolated
```

O roteiro copia também um fixture da função `rod27-coordinator` v4 obtida
somente por leitura. Apenas o HTML da resposta GET foi removido; os fluxos de
autenticação e autorização são mantidos. Esse fixture não é implantado na
produção. Em seguida sirva as funções na pasta do ambiente local:

```sh
npm exec --yes --package=supabase@2.120.0 -- supabase functions serve --no-verify-jwt
```

O gateway local dispensa a validação prévia de JWT porque cada função valida
explicitamente a identidade administrativa ou a sessão do coordenador. Nunca
utilize esse comando para implantar funções em produção.

## Testes

Execute em sequência a partir do repositório. Cada roteiro limpa somente os
dados fictícios do projeto local confirmado; não use o ambiente para outros dados.

```sh
node tests/isolated/pin-flow.mjs /caminho/rod27-isolated
node tests/isolated/special-flow.mjs /caminho/rod27-isolated
npm exec --yes --package=deno@2.6.6 -- deno check supabase/functions/rod27-special/index.ts
git diff --check
```

Resultados de 13/10/2026: aprovados.

- PIN novo, PIN antigo recusado, Vault, revogação de sessões e auditoria.
- Bloqueio por falta de confirmação administrativa; acesso anônimo e conta sem
  permissão; tentativa de forjar identidade; tabela e função protegidas contra
  acesso direto de `authenticated`.
- Coordenador tenta iniciar/responder a própria ficha; designação do próprio
  avaliado; revisor tenta designar; avaliador tenta transcrever como Secretaria.
- Avaliador designado salva rascunho e conclui digitalmente; autoria identificada;
  versão antiga rejeitada; obrigatória ausente e perguntas duplicadas rejeitadas.
- Perguntas fictícias em rascunho impedem envio; só as perguntas fictícias são
  publicadas no banco local para testar a conclusão.
- Secretaria anexa PDF fictício, transcreve, conclui e consulta o original.
  O arquivo recuperado tem SHA-256 igual ao enviado e não é público.
  Documento de outra ficha e transcrição comum que tenta contornar a regra são
  recusados. Histórico registra avaliador, transcritor e datas.
- Troca com ficha não iniciada e com ficha em preenchimento; respostas anteriores
  preservadas; registros enviados e suas respostas idênticos antes/depois;
  designação antiga inativada, rascunho preservado, acesso antigo encerrado.
- Nenhuma duplicação de ficha durante os fluxos: quatro fichas fictícias antes
  e depois dos testes automatizados.
- Interface local: lista, razão do tratamento especial, designação, impressão,
  transcrição, rascunho, conclusão, autoria e consulta do original conferidos no
  navegador. O seletor de upload do navegador de automação não aceitou arquivos
  locais; o upload foi validado pelo endpoint real no Supabase local, sem mocks.

As funções e os triggers de bloqueio do fixture reproduzem os objetos relevantes
consultados na produção. Este é um esquema reduzido de teste, não uma cópia
integral do banco de produção.

Verificação adicional: `deno check` da função administrativa existente encontrou
17 avisos de nulabilidade. A comparação com o commit `960ff91` apresentou os
mesmos 17 erros; não são introduzidos pelo fluxo especial. Os testes de execução
passaram. A correção desse código preexistente fica em tarefa separada.
