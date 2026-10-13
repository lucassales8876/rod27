# Fichas especiais — proposta para confirmação do pastor Rubem

Estado em 13/10/2026: estrutura desenvolvida e testada somente com dados fictícios.
Não há aprovação administrativa registrada, avaliadores reais designados ou novo
fluxo ativado em produção.

## Procedimento proposto

1. A Secretaria Geral registra a referência da autorização e designa uma pessoa
   diferente do coordenador avaliado. O ROL e o nome são conferidos no fichário;
   a função do avaliador é registrada junto com a designação.
2. Um avaliador que já tem acesso digital ao Rod27 utiliza sua própria identidade
   para responder apenas às fichas que lhe foram atribuídas. Nesta versão, o
   acesso digital usa a sessão existente de outro coordenador ou uma conta
   administrativa existente vinculada ao ROL designado. Não se criam PINs ou
   contas automaticamente.
3. Para avaliadores sem acesso digital, a Secretaria imprime a ficha com os dados
   da designação. O avaliador preenche e assina; a Secretaria guarda o PDF ou a
   foto do original e transcreve manualmente. OCR não é necessário.
4. A tela distingue avaliador, responsável pelo registro, origem, data e
   autorização. O original fica em armazenamento privado, com consulta temporária
   auditada. Ele não pode ser substituído ou removido pelo novo fluxo.
5. Os estados são aguardando designação, designada, em preenchimento e concluída.
   O envio definitivo exige perguntas e formulário oficialmente publicados.
   Envios concluídos ficam bloqueados para edição.

## Decisões administrativas pendentes

- Confirmar esse procedimento e quem pode ser designado, incluindo avaliadores
  externos ao conjunto de coordenadores.
- Confirmar a referência documental aceita para uma autorização da Secretaria.
- Confirmar como revisar uma ficha que já tinha respostas quando seu dirigente
  passou a ser coordenador. A implementação preserva o rascunho e bloqueia uma
  nova designação/envio até revisão; não apaga nem reaproveita respostas
  automaticamente.
- Confirmar que avaliações já enviadas permanecem como registros históricos,
  mesmo após uma troca de coordenador. Esta é a regra de preservação já testada.

## Estrutura e permissões

- `avaliacoes_especiais` tem uma chave primária por avaliação existente. Não
  cria outra ficha e não semeia designações para os 42 casos reais.
- A nova função `rod27-special` usa a identidade autenticada, nunca um ROL ou
  usuário declarado pelo cliente. A função SQL revalida a conta ou sessão em
  cada operação. Sessões revogadas não autorizam o avaliador.
- Designação e transcrição são restritas a `superadmin` e `secretario_geral`.
  O avaliador designado só preenche digitalmente sua ficha atribuída; a
  comparação com o ROL do avaliado bloqueia autoavaliação.
- A tabela tem RLS e não concede leitura/escrita a `anon` ou `authenticated`.
  A função SQL só pode ser executada pelo serviço. Toda alteração de metadados
  ou respostas gera histórico de antes/depois e identidade na mesma transação.
- Reutiliza `documentos_avaliacao`, o bucket privado `rod27-documentos`,
  `respostas_avaliacao` e `auditoria_sistema`. Respostas finais são inseridas
  na ficha original; não há exclusão de respostas anteriores.
- A transcrição comum da Secretaria passa a encaminhar fichas especiais para
  o fluxo específico, impedindo contornar a designação pelo formulário comum.
- Uma reclassificação inativa a designação anterior e conserva o rascunho e o
  histórico. Fichas enviadas não são reclassificadas.

## Ativação posterior à aprovação

1. Registrar a confirmação do pastor Rubem e a referência administrativa.
2. Revisar/mesclar a versão de preparação, aplicar a migração aditiva
   `20261013173138_special_evaluations_preparation.sql` e publicar a função
   `rod27-special`, a função administrativa atualizada e a interface.
3. A aprovação operacional é uma configuração do servidor,
   `fichas_especiais.aprovacao`, com `aprovada: true` e `referencia` não vazia.
   Ausência dessa configuração bloqueia todas as operações. A interface não
   dispõe de botão ou endpoint para aprovar a regra.
4. Publicar as perguntas somente com a autorização específica da Secretaria.
5. Designar avaliadores reais individualmente conforme os despachos aprovados.

O passo 3 não foi executado na produção. Nenhuma pergunta real foi publicada.
Os testes estão descritos em `tests/isolated/README.md`.
