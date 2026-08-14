# Veritas + Supabase

## Objetivo

O Veritas continua local-first para edição e simulação. O Supabase foi preparado como uma camada opcional de contexto para a IA: ele poderá receber snapshots validados de circuitos, resultados resumidos e metadados de uso, sem substituir o IndexedDB nem armazenar tokens, credenciais ou prompts arbitrários.

A documentação oficial do Supabase recomenda aplicar políticas de Row Level Security baseadas na identidade autenticada para limitar as linhas que cada usuário pode ler ou alterar [1]. A migração do Veritas segue esse princípio e também revoga o acesso do papel anônimo à nova tabela.

## Projeto utilizado

A migração foi aplicada no projeto Supabase já existente **Lucas-Belucci-Bellini's Project**, referência `hcwzsxdcvmswebunznak`. A inspeção encontrou uma camada prévia de IA com `memories`, `knowledge_items`, `knowledge_sources`, `ai_skills`, relações de skills e eventos de auditoria. Não foi criada uma segunda base paralela.

## Tabela criada

A tabela `public.veritas_circuit_context` foi criada pela migração `veritas_circuit_context_foundation` e está registrada no repositório em [`supabase/migrations/20260814181753_veritas_circuit_context_foundation.sql`](../supabase/migrations/20260814181753_veritas_circuit_context_foundation.sql).

| Campo | Finalidade |
| --- | --- |
| `user_id` | Dono autenticado do contexto; referencia `auth.users` |
| `source_ref` | Identificador estável da origem no Veritas |
| `context_type` | Classifica `circuit`, `simulation`, `feedback` ou `preference` |
| `circuit_name` | Nome legível do projeto |
| `summary` | Resumo curto usado para indexação e inspeção |
| `payload` | Snapshot JSONB validado do circuito e da tabela verdade |
| `tags` | Classificação para consultas futuras |
| `content_hash` | Fingerprint opcional para deduplicação por usuário |
| `status` | Ciclo de vida `active`, `archived` ou `superseded` |
| `usage_count` e datas | Telemetria mínima e rastreabilidade de uso |

Foram criados índices por usuário/data, tags e hash. O hash não é uma identidade pública; serve apenas para evitar duplicações do mesmo snapshot no escopo do proprietário.

## Isolamento e permissões

A tabela possui RLS habilitado. Usuários autenticados só podem selecionar, inserir, atualizar ou excluir linhas cujo `user_id` seja igual a `auth.uid()`. O papel `anon` não recebeu privilégios na tabela. Nenhuma policy pública foi criada.

Essa proteção é importante porque uma chave publicável do Supabase pode aparecer em aplicações web; ela nunca deve ser tratada como autorização para acessar dados de outro usuário. A futura integração deverá usar a sessão autenticada do usuário e manter qualquer operação privilegiada em um backend ou Edge Function protegida.

## Fluxo preparado no código

O módulo [`src/circuit/context.ts`](../src/circuit/context.ts) cria um pacote determinístico com:

1. o documento visual validado;
2. a lista de entradas e saídas;
3. a tabela verdade limitada a 256 linhas para evitar payloads descontrolados;
4. um resumo humano;
5. tags e um fingerprint FNV-1a para deduplicação local.

O módulo não faz chamadas de rede. Isso é intencional: o frontend atual não possui autenticação nem cliente Supabase configurado. Conectar a escrita diretamente no navegador antes de definir o login poderia gerar dados sem proprietário e quebrar o isolamento RLS. A próxima etapa de integração deve adicionar autenticação e uma camada de acesso explícita, preferencialmente com operações de contexto que validem o payload antes de persistir.

## Próxima etapa recomendada

A integração seguinte deve ser pequena e auditável: login Supabase, criação de um cliente com a chave publicável, uma operação autenticada para salvar o pacote produzido por `buildCircuitContext`, leitura apenas dos próprios contextos e registro opcional de sucesso/erro na camada de auditoria já existente. A IA deverá consumir apenas contextos autorizados e nunca receber a chave de serviço.

## Avisos existentes

O consultor de segurança do projeto ainda reporta avisos anteriores à migração, incluindo funções `SECURITY DEFINER` expostas e uma tabela de eventos sem policies. Eles não foram alterados nesta tarefa porque não pertencem ao fluxo do Veritas e uma correção ampla poderia quebrar outras aplicações que usam o mesmo projeto. A nova tabela não apareceu como alerta específico.

## Referências

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase — Row Level Security"
[2]: https://supabase.com/docs/guides/database/postgres/column-level-security "Supabase — Column Level Security"
[3]: https://supabase.com/docs/guides/auth/auth-mfa "Supabase — Authentication and database authorization"
