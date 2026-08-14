# Colaboração, exportação e monitoramento

## Colaboração em tempo real

A colaboração usa os canais privados do Supabase Realtime. O projeto persistido continua sendo a fonte de verdade; o WebSocket distribui snapshots efêmeros para os usuários que já têm acesso ao circuito. Essa separação evita tratar mensagens transitórias como histórico confiável.

| Mecanismo | Uso no Veritas |
| --- | --- |
| Broadcast | Enviar um documento visual válido quando um editor move, conecta ou adiciona componentes |
| Presence | Mostrar usuários conectados ao mesmo circuito |
| RLS | Autorizar o tópico `veritas:circuit:<project_id>` conforme proprietário, editor ou visualizador |
| IndexedDB/Supabase | Persistir localmente e sincronizar explicitamente o estado atual e as versões |

O proprietário compartilha um projeto informando o UUID de outro usuário e escolhendo `editor` ou `viewer`. Editores podem publicar snapshots; visualizadores recebem atualizações e ficam com o canvas bloqueado para alterações. Uma nova conexão entra no canal privado somente depois de uma sessão Supabase autenticada.

> **Importante:** o Realtime precisa estar configurado para exigir canais privados no projeto Supabase. As policies de `realtime.messages` já estão versionadas, mas a configuração de acesso público deve ser conferida no painel do projeto antes de produção.

O cliente remove o canal ao desmontar o editor e valida documentos recebidos antes de aplicá-los. Existe uma proteção simples contra eco: um snapshot recebido não é transmitido novamente pelo mesmo cliente.

## Exportação industrial

O editor exporta circuitos combinacionais válidos para Verilog-2001 (`.v`) e VHDL (`.vhd`). Os arquivos são gerados em memória e baixados pelo navegador; nenhum dado é enviado a um serviço externo.

| Tipo de componente | Verilog | VHDL |
| --- | --- | --- |
| Entrada | `input` no módulo | `in std_logic` na entity |
| Saída | `output` e `assign` | `out std_logic` e atribuição concorrente |
| Constante | `1'b0`/`1'b1` | `'0'`/`'1'` |
| AND/OR/XOR | `&`, `|`, `^` | `and`, `or`, `xor` |
| NOT | `~signal` | `not signal` |
| Fio interno | `wire` | `signal` |

O exportador rejeita entradas desconectadas, ciclos, destinos inválidos, componentes não suportados e outros erros do validador canônico. Identificadores são sanitizados, palavras reservadas recebem prefixo e colisões são resolvidas de forma determinística. O resultado deve ser revisado e simulado no fluxo EDA escolhido; a exportação não substitui verificação funcional, temporização ou síntese.

## Monitoramento da IA

Cada chamada autenticada de `veritas-circuit-ai` registra telemetria mínima em `veritas_ai_metrics`: ação, provedor, latência, sucesso, confiança, hash do contexto, mensagem de erro limitada e metadados não sensíveis. O registro é best-effort: uma falha de observabilidade nunca interrompe uma análise ou otimização.

O painel apresenta os últimos eventos do usuário autenticado e atualiza novas inserções via Realtime. Os agregados incluem total de chamadas, taxa de sucesso, latência média, confiança média, quantidade de respostas LLM, quantidade de fallback heurístico e horário da última chamada.

A tabela de métricas possui RLS por `auth.uid()`. O frontend não vê telemetria de outros usuários e não registra o prompt completo nem o documento inteiro; o `content_hash` é usado apenas para correlação do contexto.

## Validação operacional

Antes de publicar, execute os testes, o typecheck, o lint e o build. No Supabase, verifique a migração de colaboradores, a policy de `realtime.messages`, a publicação Realtime de `veritas_ai_metrics` e a exigência de JWT. Em ambientes de desenvolvimento sem configuração Supabase, o editor continua funcionando localmente, mas a colaboração, a sincronização e o monitoramento ficam desabilitados.

## Referências

[1]: https://supabase.com/docs/guides/realtime/authorization "Supabase — Realtime Authorization"
[2]: https://supabase.com/docs/guides/realtime/concepts "Supabase — Realtime Concepts"
[3]: https://supabase.com/docs/reference/javascript/subscribe "Supabase JavaScript — subscribe"
