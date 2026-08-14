# Histórico remoto de circuitos

O histórico remoto do Veritas é **append-only**: o registro atual do projeto permanece em `veritas_circuit_projects`, enquanto cada sincronização bem-sucedida gera uma linha em `veritas_circuit_versions`. A função RPC `veritas_sync_circuit_project` atualiza o estado atual e insere a nova versão na mesma transação lógica.

## Modelo de dados

| Tabela/objeto | Responsabilidade |
| --- | --- |
| `veritas_circuit_projects` | Estado atual do circuito, usado para listagem rápida e abertura |
| `veritas_circuit_versions` | Snapshot imutável de cada sincronização, com número sequencial por projeto |
| `veritas_sync_circuit_project(...)` | Atualiza/cria projeto e insere uma versão com resumo de mudança |
| `CircuitChangeSummary` | Contadores de nós/conexões e alteração de nome exibidos rapidamente |
| `CircuitDiff` | IDs e chaves detalhadas de nós e conexões adicionados, removidos ou alterados |

Ambas as tabelas possuem isolamento por `auth.uid()`. A função RPC é executável somente por `authenticated`; a tabela de versões é somente leitura para o usuário proprietário. Não existe operação de `UPDATE` ou `DELETE` sobre versões pela aplicação.

## O que é uma versão

Uma versão é criada quando o usuário pressiona **Sincronizar nuvem**, mesmo que o salvamento venha de um circuito aberto a partir de uma versão anterior. A versão anterior não é alterada. Para evitar sobrescrita silenciosa, abrir uma versão antiga no editor é tratado como prévia; ao sincronizar, o resultado vira uma nova versão.

O `version_number` começa em `1` para cada projeto e cresce sequencialmente. O documento completo, o hash determinístico, o nome e o resumo de mudança são armazenados junto do timestamp. O hash é usado para rastreabilidade do conteúdo; a interface usa o resumo para renderizar a comparação sem recalcular tudo antes de abrir os detalhes.

## Comparação visual

O editor apresenta duas seleções: **Versão anterior** e **Versão atual**. A comparação reporta:

| Categoria | Detalhe |
| --- | --- |
| Nome | Se o nome do circuito mudou |
| Nós adicionados | IDs presentes somente na versão atual |
| Nós removidos | IDs presentes somente na versão anterior |
| Nós alterados | Mesmo ID com tipo, posição, label ou opções diferentes |
| Conexões adicionadas/removidas | Chave `origem:porta→destino:porta` ordenada deterministicamente |
| Totais | Quantidade de nós e conexões antes e depois |

A comparação é estrutural. Ela não afirma equivalência booleana por si só; para isso, use a tabela verdade e a análise da IA. A lista de versões também oferece **Abrir versão**, que carrega o snapshot no canvas como prévia. Para preservá-lo como novo estado, sincronize explicitamente.

## Migração

A estrutura está em `supabase/migrations/20260814190000_veritas_circuit_versions.sql`. Ela cria a tabela de histórico, índices por projeto/usuário, RLS, grants e a função RPC usada pelo frontend. O arquivo deve permanecer versionado junto das alterações de código para que ambientes futuros possam reproduzir o esquema.
