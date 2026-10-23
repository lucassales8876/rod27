# Rod27 · Monitor de atividade Supabase

## O que foi instalado
- Postgres: função `public.rod27_heartbeat()` de somente leitura, sem dados privados. Chamada por GET PostgREST usando a chave publicável já presente no `primeiro-acesso.html` local do projeto.
- Lenovo: `C:\Users\secre\Documents\Rod27-Monitor\Rod27-Heartbeat.ps1`.
- Agendador do Windows: tarefa **Rod27 - Atividade Supabase** às 11:00 diariamente e na entrada do usuário da Secretaria no Windows.
- Atalho na área de trabalho: **Rod27 - Monitor do Servidor**, que abre o contador HTML.
- Arquivos locais: `status.json` (dados estruturados de checagem), `historico.csv` (histórico de execuções), `monitor.html` (contador).

## Comportamento
- Três chamadas SQL reais e pequenas, sem UPDATE/INSERT/DELETE, na execução agendada.
- Só atualiza a última atividade confirmada quando o Postgres respondeu 200, com `ok:true` e horário do servidor.
- A janela preventiva termina sete dias depois da última consulta confirmada; o Supabase **não fornece cronômetro oficial ou data exata da pausa**.
- Tarefa usa credenciais do usuário Windows, sem token de administrador Supabase.
- Como o Windows está sem privilégios administrativos nessa sessão, tarefa ocorre no logon do usuário, não obrigatoriamente antes de entrar no Windows.
- `WakeToRun` e `StartWhenAvailable` solicitados ao Windows. Se computador permanecer desligado/desconectado, ele não gera atividade: a pausa do Free continua possível.
- O projeto em plano pago não sofre pausa por inatividade. A mudança de plataforma exige retirar tarefa e RPC de manutenção.

## Manual
Abra o atalho no desktop para ver o contador.
Para disparar manualmente:
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\secre\Documents\Rod27-Monitor\Rod27-Heartbeat.ps1"`
Para consultar a execução:
`Get-ScheduledTaskInfo -TaskName "Rod27 - Atividade Supabase"`
Para desinstalar quando migrar:
`Unregister-ScheduledTask -TaskName "Rod27 - Atividade Supabase" -Confirm:$false`

## Verificação de implantação (23/10/2026)
- Endpoint REST: HTTP 200, resposta do banco confirmada.
- Agendamento executado pelo Windows: código de saída 0.
- Três consultas confirmadas.
- Migração: 20261023140751_rod27_keepalive_health aplicada e registrada no histórico remoto.
