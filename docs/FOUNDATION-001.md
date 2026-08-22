# FOUNDATION-001 — Contrato canônico do documento

**Status:** implementação incremental  
**Versão do documento:** `veritas-circuit` v1  
**Data:** 22 de agosto de 2026

## Objetivo

O FOUNDATION-001 cria uma fronteira única para normalização de representação, limites de tamanho e ordenação topológica do `CircuitDocument`. A etapa não muda o formato persistido v1 e não habilita novos tipos de componente; ela reduz divergências entre editor, IndexedDB, cloud, IA, histórico, avaliação e exportação.

> Normalização altera somente representação. Ela não corrige ciclos, referências desconhecidas, portas faltantes, widths inválidos ou incompatibilidades semânticas; esses casos continuam sendo rejeitados pelo validador.

## Contrato implementado

| API | Responsabilidade |
| --- | --- |
| `normalizeCircuitDocument` | Aparar nome, IDs, labels e referências sem mutar o objeto recebido. Documentos já canônicos preservam identidade para operações no-op. |
| `getCircuitDocumentBoundIssues` | Verificar nome, quantidade de nós, quantidade de conexões, tamanho de labels e tamanho serializado. |
| `isCircuitDocumentShape` | Guard estrutural mínimo para fronteiras que recebem `unknown`. A validação semântica continua sendo obrigatória depois dele. |
| `documentSerializedBytes` | Medir o payload em bytes UTF-8, de forma determinística. |
| `topologicalOrder` | Calcular ordem determinística por dependência e `nodeId`, rejeitando duplicidade, referência desconhecida e ciclo combinacional. |

As APIs são exportadas por `src/circuit/index.ts` e podem ser consumidas sem React ou DOM.

## Limites atuais

| Limite | Valor | Motivo |
| --- | ---: | --- |
| Componentes por documento | 256 | Impedir payloads e canvas sem orçamento |
| Conexões por documento | 512 | Evitar explosão estrutural e consultas excessivas |
| Nome do circuito | 200 caracteres | Compatibilidade com UI, cloud e SQL |
| Rótulo do componente | 120 caracteres | Legibilidade e payload previsível |
| Documento serializado | 500.000 bytes UTF-8 | Limite defensivo para armazenamento e IA |

O limite de barramento continua sendo `MAX_BUS_WIDTH = 64`. Os limites desta etapa são complementares e não substituem as regras de largura do circuito.

## Consumidores

A normalização ocorre antes de:

- converter o documento em netlist;
- construir contexto, hash e tabela verdade para IA;
- gerar Verilog e VHDL;
- gerar tabela verdade escalar ou vetorial;
- otimizar componentes inalcançáveis;
- calcular diffs do histórico;
- criar, atualizar ou importar projetos no IndexedDB;
- persistir projetos e versões no cliente Supabase.

Cloud e cliente de IA também reutilizam o guard estrutural e executam `validateCircuit(..., { allowBuses: true })` sobre respostas/documentos recebidos. A Edge Function mantém uma réplica defensiva independente para funcionar no runtime Deno e exige `Authorization: Bearer ...` antes de processar o payload. A validação server-side SQL continua sendo a barreira final para persistência cloud.

## Topologia

As avaliações escalar e vetorial agora usam `topologicalOrder`. O resultado é estável mesmo quando nós independentes chegam em ordem diferente: componentes prontos são ordenados por `nodeId`. A regra mantém a detecção de referências inexistentes e de ciclos combinacionais. Circuitos sequenciais continuam sendo responsabilidade do `Simulator`, que usa tiques e estado explícito.

## Migração e compatibilidade

O formato `CircuitDocument` permanece na versão 1. Nenhum registro existente precisa de migração porque os campos atuais continuam válidos. A normalização é aplicada nos limites de entrada, sem reescrever automaticamente todos os registros já existentes.

Quando surgir uma versão incompatível, o caminho esperado é:

1. adicionar `migrateCircuitDocument` com entrada `unknown` e saída de uma versão conhecida;
2. preservar dados opcionais não conflitantes;
3. rejeitar versões futuras sem mutar o estado local;
4. testar documentos v1 reais, documentos v1 com whitespace e payloads inválidos;
5. aplicar a migração antes da validação semântica, persistência, broadcast ou HDL.

## Segurança

Os limites e guards de frontend não são controle de acesso. Auth, RLS, autorização de RPC, policies Realtime e verificação da Edge Function continuam obrigatórios. Nenhuma chave privada é adicionada ao frontend. O fallback local continua funcionando quando o Supabase não está configurado.

## Critérios de aceite

A etapa é considerada concluída quando a suíte completa, typecheck, lint, build frontend/PWA, build MCP, build plugin, `git diff --check` e smoke local passam; quando documentos canônicos preservam no-op; quando whitespace não gera diff, hash ou HDL diferente; quando limites e ciclos têm testes determinísticos; e quando a documentação e o roadmap descrevem as limitações restantes.

## Fora do escopo

Esta etapa não adiciona hierarquia, subcircuitos, portas formais, sinais `X/Z`, novos componentes visuais, CRDT, transporte MCP remoto, ou integração visual dos canais wireless. Essas capacidades dependem de um contrato de schema posterior e de fatias verticais próprias.

## Referências

[1]: ../src/circuit/documentContract.ts "Contrato runtime do documento"
[2]: ../src/circuit/documentLimits.ts "Limites do documento"
[3]: ../src/circuit/topology.ts "Topo sort determinístico"
[4]: ../src/circuit/editorModel.ts "Modelo e validação do circuito"
[5]: ../src/storage/circuits.ts "Persistência local e formato .veritas"
[6]: ../src/cloud/circuitProjects.ts "Projetos cloud"
[7]: ../src/cloud/circuitVersions.ts "Histórico e sincronização cloud"
[8]: ../supabase/functions/veritas-circuit-ai/index.ts "Edge Function de IA"
[9]: ../plugins/veritas-logic/.claude-plugin/plugin.json "Manifesto do plugin"
