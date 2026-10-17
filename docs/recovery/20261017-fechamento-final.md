# Rod27 | Encerramento técnico das pendências de auditoria | 17/10/2026

**Este documento atualiza o relatório anterior de 8/12 achados; as quatro pendências daquela etapa receberam implementações novas.**

## Decisões funcionais atendidas

1. **Manifestação de Interesse, não autoavaliação:** o coordenador indica se deseja continuar, permanecer na mesma congregação, mudar de congregação no mesmo setor, mudar de setor ou sair. Justificativa obrigatória ao mudar ou sair, opcional ao permanecer. O controle antigo de autoavaliação foi desativado e removido da interface.
2. **Primeiro acesso:** hooks ativos em auth.users já verificavam e-mail, hash do convite, validade e criação do perfil administrativo. Foi acrescentado bloqueio concorrente por linha (FOR UPDATE) e unicidade do convite pendente por e-mail. Nenhuma conta real foi criada durante a correção.
3. **Versionamento:** uma ficha iniciada congela JSON das perguntas e versão ao confirmar o aviso; novas edições de perguntas publicadas incrementam atomicamente a versão para novas fichas. Respostas, revisão e envio usam a versão congelada. Formulários de papel passam a exibir a versão.
4. **Auditoria:** sete gatilhos de banco registram mudanças críticas na mesma transação. Histórico não admite UPDATE/DELETE direto; superadmin pode excluir um evento mediante justificativa e solicitante por RPC protegida, mantendo uma meta-auditoria mínima da exclusão. Excluir log não desfaz a ação original.

## Produção publicada

- Supabase Rod27: rod27-coordinator v12; rod27-admin v10; rod27-control v7; first-access v1 permaneceu intacta.
- Migrações aplicadas no Lenovo: 20261017224705_feedback_invite_audit e 20261017225458_versionamento_formulario. Histórico remoto de migrações atualizado.
- Cloudflare Pages: rod27-ieadern, deployment 82f59e3b. As cinco páginas retornaram HTTP 200, e os recursos novos foram encontrados no HTML publicado.
- Repositório: branch main de rod27. Código sincronizado a partir do Lenovo, via MacBook. O arquivo vercel.json preexistente foi deixado sem alterações.

## Testes e integridade

- Sintaxe de JavaScript e TypeScript: PASS.
- Cenários simulados de persistência de respostas, concorrência de PIN e manifestação: PASS.
- Duas migrações de SQL validadas por transação com ROLLBACK antes da aplicação.
- Versionamento testado no banco dentro de transação revertida: criar snapshot, editar pergunta, verificar incremento de versão e preservação do snapshot.
- Conferência pós-teste: 0 fichas iniciadas, 0 snapshots persistidos, versão publicada 1, 0 respostas, 0 manifestações.
- RPC de exclusão administrativa: execução negada a anon e authenticated; disponível apenas ao backend, com conferência adicional do perfil superadmin.
- Sem teste completo autenticado com contas/ROLs fictícios em homologação, nem teste real de exclusão de evento. Ambos são necessários antes da entrega operacional definitiva ao pastor.

## Limites e próximos testes

- Primeiro acesso real do pastor continuará para o momento em que ele decidir criar sua conta.
- Revalidar o ciclo integral com conta sintética de coordenador: login, manifestação, avaliação, salvar, revisar, enviar, leitura e classificação na Secretaria.
- Revalidar editor de perguntas e snapshot em ambiente de homologação e o histórico de auditoria com dados sintéticos.
- Devido à natureza do histórico e a possíveis deveres legais de conservação, exclusões administrativas exigem justificativa e a autorização correspondente; o registro mínimo da exclusão é preservado.
