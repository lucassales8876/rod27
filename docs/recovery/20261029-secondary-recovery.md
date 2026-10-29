# Recuperação pelo endereço principal e pelo secundário

O fluxo do Rod27 preserva a identidade e o e-mail principal no Supabase Auth. A função `rod27-recovery` procura somente contas administrativas ativas e endereços adicionais comprovados, gera um link nativo de recuperação da mesma identidade e envia mensagens separadas aos destinatários habilitados. Não cria outra conta e não altera a senha ao solicitar o link.

## Estado e ativação

O transporte está preparado para a API HTTPS do Resend e permanece desativado sem os três Edge Secrets abaixo:

- `ROD27_RECOVERY_RESEND_KEY`: chave de envio restrita ao remetente/domínio autorizado.
- `ROD27_RECOVERY_FROM`: remetente aprovado pelo provedor.
- `ROD27_RECOVERY_DELIVERY_ENABLED`: `true` para habilitar o envio após configurar os dois anteriores.

Não armazenar valores em Git, arquivos de relatório ou chat. Configurar no painel de secrets ou por procedimento administrativo seguro. A instituição deve autorizar o provedor e o remetente; este código não cria uma conta, contrata plano ou configura DNS automaticamente. Outros provedores exigem um adaptador de envio.

Enquanto desativado, Meu perfil informa a pendência, o botão de confirmação fica desabilitado e a recuperação principal continua no fluxo anterior do Auth. Não foi alterada a configuração SMTP global nem instalado um hook global que possa interromper outros e-mails do projeto.

## Confirmação e aceite real

1. Após configurar o transporte, o secretário-geral abre Meu perfil e solicita confirmação do endereço adicional.
2. O backend envia um desafio aleatório de 256 bits. Somente seu SHA-256 é persistido. Expira em 15 minutos, tem uso único e só é aceito após o provedor aceitar o envio. Há limite de três solicitações por hora e intervalo mínimo de um minuto.
3. A página de confirmação guarda o token apenas em memória, remove o fragmento da URL e exige clique explícito. A verificação é atômica e auditada. Ela não altera senha ou e-mail principal.
4. Em Esqueci a senha, o titular pode informar o principal ou o secundário já confirmado. O resultado público é genérico para não revelar contas. São permitidas três solicitações por hora por identidade, com intervalo mínimo de um minuto.
5. As mensagens têm o mesmo link nativo de recuperação, enviado separadamente, sem revelar os outros contatos. O token só é consumido depois de o titular preencher a nova senha e confirmar na página. Abrir a mensagem ou a página não altera a senha.
6. Comprovar recebimento nas duas caixas e concluir um ensaio com identidade exclusivamente técnica. Aceitação HTTP pelo provedor não é prova de entrega. Não usar avaliações reais nem alterar senhas de pessoas para testes sem autorização.

O `verified_at` não é preenchido por declaração de sucesso fictícia. Sem transporte configurado e sem clique do titular, o secundário permanece pendente. Não declarar o escopo concluído antes das provas de entrega.

## Controles preservados

As tabelas e RPCs são acessíveis apenas ao serviço. Tokens e corpos de mensagens não aparecem na auditoria ou nas respostas públicas. Contatos removidos ou não confirmados não são usados. O acesso emergencial e a troca voluntária de senha continuam independentes desse fluxo.

As chamadas diretas ao endpoint nativo `/auth/v1/recover` continuam seguindo o comportamento principal do Supabase; o envio adicional é realizado pelo endpoint do Rod27 usado nas suas telas de acesso.
