# Testes didáticos e colaboração multi-room

## Testes derivados dos materiais

Os PDFs enviados foram usados como uma fonte de casos de regressão para o motor lógico, não como autoridade para alterar silenciosamente a semântica existente. Os exemplos selecionados cobrem exatamente as operações já suportadas pelo lexer, parser e avaliador do Veritas.

| Material | Conceito convertido em teste | Resultado esperado |
| --- | --- | --- |
| `V2-ConectivosLógicoseTabelaVerdade.pdf`, pp. 13–24, 29–35 | Negação, conjunção, disjunção, condicional, bicondicional, tautologia e contradição | Colunas com valores compatíveis com as definições e classificações esperadas |
| `ImplicaçãoeEquivalênciaLógica.pdf`, pp. 9–24 | Contrapositiva, recíproca, condicional equivalente a `¬P ∨ Q`, De Morgan e bicondicional | Equivalências verdadeiras; recíproca rejeitada por contraexemplo |
| `AlgebradeBoole.pdf`, pp. 5–11 | Absorção, dupla negação e leis de De Morgan | Fórmulas equivalentes em todas as atribuições |
| `Argumentos.pdf`, pp. 6–17 | Condicional associada, Modus Ponens, Modus Tollens e silogismo hipotético | Condicionais associadas tautológicas |
| `Intro.pdf`, pp. 5–13 | Valor lógico, sentença aberta e quantificação | Base conceitual para separar o escopo proposicional booleano de futuras extensões com variáveis/domínios |
| `SlidesB1.pdf`, pp. 18, 31–41 | CPU, ALU, interconexões, largura de bits e memória | Backlog para barramentos multi-bit, registradores e componentes sequenciais; ainda não forçado no editor combinacional v0.7.x |

Os testes estão em `src/engine/courseMaterials.test.ts`. Eles usam todas as atribuições para as variáveis presentes na fórmula, evitando exemplos que passam por coincidência em apenas uma linha da tabela verdade.

## Arquitetura recomendada para multi-room

A colaboração atual tem uma sala ativa por `cloudProjectId`. Para evoluir sem misturar eventos, trate cada sala como um canal privado independente:

```ts
type RoomKind = 'document' | 'review' | 'chat'

type RoomRef = {
  projectId: string
  roomId: string
  kind: RoomKind
}

const topicFor = (room: RoomRef) =>
  `veritas:project:${room.projectId}:room:${room.roomId}`
```

O cliente deve manter um `Map<string, RoomSession>` indexado por `projectId/roomId`, com um `RealtimeChannel`, listeners, estado de conexão, `lastReceivedHash` e versão observada separados para cada sala. Trocar de documento deve desinscrever a sala anterior antes de conectar a nova; uma tela que realmente precisa acompanhar várias salas pode manter um limite pequeno de canais e remover os inativos.

Cada sala deve ter um contrato de eventos explícito:

| Evento | Canal | Uso | Política de frequência |
| --- | --- | --- | --- |
| `presence_sync` | Presence | Usuários presentes, papel, documento aberto e estado curto | Baixa frequência |
| `circuit_snapshot` | Broadcast | Snapshot ou atualização de documento | Após debounce e com versão |
| `cursor_move` | Broadcast | Cursor/seleção temporária | Alta frequência, throttled |
| `review_comment` | Broadcast ou banco | Comentários de revisão | Persistir se for histórico |
| `chat_message` | Broadcast ou banco | Chat efêmero ou persistente | Definir retenção explicitamente |

Presence não deve receber eventos de cursor a cada movimento. A documentação oficial recomenda Presence para estado de baixa frequência e Broadcast para atualizações rápidas ou descartáveis [1] [2].

## Contrato de snapshot com conflito explícito

O snapshot atual contém documento e hash. Para multi-room, acrescente metadados de concorrência:

```ts
type RoomSnapshot = {
  roomId: string
  projectId: string
  document: CircuitDocument
  contentHash: string
  baseVersion: number
  clientId: string
  sentAt: string
}
```

O fluxo mínimo seguro é:

1. Ler a versão remota conhecida da sala.
2. Ao editar, guardar `baseVersion` e aplicar a alteração localmente.
3. Publicar o snapshot com `baseVersion` e novo `contentHash`.
4. No RPC de persistência, aceitar somente quando `baseVersion` ainda for a versão atual.
5. Se houver divergência, retornar conflito, baixar a versão remota e pedir merge/duplicação ao usuário.
6. Somente depois de persistir a nova versão transmitir o snapshot confirmado.

Para uma primeira etapa, use **concorrência otimista com rejeição de conflito**. Isso é mais seguro que LWW silencioso e aproveita `veritas_circuit_versions`. Um CRDT ou sequência de patches só deve entrar quando o modelo de operações do editor estiver estável.

## Segurança multi-room

A migration deve autorizar o tópico por projeto e sala, com whitelist de `roomId`; nunca aceite um tópico arbitrário vindo diretamente do usuário. As policies devem separar:

- leitura de `broadcast`/`presence` para owner, editor e viewer autorizados;
- escrita de Presence para membros autorizados;
- escrita de `circuit_snapshot` apenas para owner/editor;
- escrita de `cursor_move`/`chat_message` conforme o caso de uso;
- persistência de comentários e histórico em tabelas com RLS por usuário/projeto.

O cliente deve normalizar `projectId`, `roomId`, `kind`, `event`, `senderId`, versão e payload antes de encaminhar o evento à UI. O canal deve ser removido no cleanup e a mudança de usuário deve invalidar todas as sessões abertas.

## Próxima fatia executável

A próxima implementação recomendada é `ROOM-001`: extrair `createCircuitCollaboration` para `createRoomCollaboration`, adicionar um `RoomManager` com troca de sala, incluir `baseVersion` nos snapshots, criar testes de isolamento entre duas salas e atualizar as policies para validar o tópico e o evento. A resolução de conflito deve começar com rejeição otimista e só depois evoluir para merge declarativo.

## Referências

[1]: https://supabase.com/docs/guides/realtime/presence "Supabase Realtime Presence"
[2]: https://supabase.com/docs/guides/realtime/broadcast "Supabase Realtime Broadcast"
[3]: https://supabase.com/docs/guides/realtime/authorization "Supabase Realtime Authorization"
