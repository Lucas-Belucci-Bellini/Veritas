# Casos de uso

> Atores, casos de uso e a superfície que os atende. Legenda em [`../README.md`](../README.md).

## 1. Atores

| Ator | Descrição | Superfície principal |
| --- | --- | --- |
| **Estudante** | Aprende lógica proposicional, álgebra booleana, circuitos | Web/PWA offline |
| **Educador** | Prepara exemplos, testes, compara soluções | Web/PWA, arquivos `.veritas` |
| **Projetista/hobbyista digital** | Monta circuitos, chips hierárquicos, exporta HDL | Editor, biblioteca de chips, desktop |
| **Desenvolvedor** | Integra o motor em ferramentas, CI ou IDE | MCP stdio/HTTP, plugin, build `lib` |
| **Agente de IA** (Claude Code, Codex, outros hosts MCP) | Pede cálculos e verificações em vez de estimar | MCP |
| **Colaborador remoto** | Edita/visualiza circuito compartilhado | Nuvem + Realtime (opt-in) |
| **Operador/mantenedor** | Promove releases com evidência | Scripts `beta:*`, CI |

## 2. Casos de uso atuais

| ID | Caso | Ator | Estado | Superfície |
| --- | --- | --- | --- | --- |
| UC-01 | Digitar expressão e obter tabela verdade com passos e classificação | Estudante | `IMPLEMENTED` | Web, MCP `truth_table` |
| UC-02 | Simplificar expressão e ver formas normais / Karnaugh | Estudante | `IMPLEMENTED` | Web, MCP `simplify_expression`, `normal_forms`, `karnaugh_map` |
| UC-03 | Avaliar expressão em uma atribuição | Estudante, agente | `IMPLEMENTED` | Web, MCP `evaluate_expression` |
| UC-04 | Desenhar circuito, ver tabela verdade e salvar localmente | Projetista | `IMPLEMENTED` | Editor + IndexedDB |
| UC-05 | Simular circuito sequencial passo a passo | Estudante, projetista | `IMPLEMENTED` | Painel temporal, MCP `simulate_circuit` |
| UC-06 | Empacotar circuito como chip e reutilizá-lo | Projetista | `IMPLEMENTED` | Biblioteca local |
| UC-07 | Provar que duas implementações combinacionais são equivalentes, ou obter contraexemplo | Educador, agente | `IMPLEMENTED` | Painel, MCP `circuit_equivalence` |
| UC-08 | Comparar dois circuitos sequenciais num roteiro | Projetista, agente | `IMPLEMENTED` | Painel, MCP `circuit_differential` |
| UC-09 | Conferir circuito contra casos esperados | Educador, agente | `IMPLEMENTED` (sequencial só MCP) | Painel, MCP `run_testbench` |
| UC-10 | Exportar Verilog/VHDL | Projetista, agente | `PARTIAL` (sequencial incorreto — K-02) | Editor, MCP `export_circuit_hdl` |
| UC-11 | Exportar/importar projetos entre máquinas | Todos | `PARTIAL` (vetorial não faz round-trip — K-01) | Arquivos `.veritas*` |
| UC-12 | Importar chips do Digital Logic Sim | Projetista | `IMPLEMENTED` (allowlist/estrutural) | Biblioteca |
| UC-13 | Depurar fluxograma com breakpoints | Estudante, agente | `IMPLEMENTED` | Workspace, MCP `debug_algorithm` (ver K-03) |
| UC-14 | Sincronizar circuito na nuvem e ver histórico | Projetista | `PARTIAL` (tipos aceitos no SQL — G-02) | Nuvem |
| UC-15 | Colaborar em tempo real com papéis | Colaborador | `PARTIAL` (sem prova cross-user real) | Realtime |
| UC-16 | Pedir análise/otimização por IA | Projetista | `PARTIAL` (escalar; sem verificação da proposta — G-03) | Edge Function |
| UC-17 | Consultar biblioteca de 1121 chips | Todos, agente | `IMPLEMENTED` | Web, MCP `list_chips`/`get_chip` |
| UC-18 | Usar o motor dentro do Claude Code sem build | Desenvolvedor | `IMPLEMENTED` | Plugin |

## 3. Casos de uso do agente de IA — detalhados

O caso mais próximo da visão ampliada **já é executável hoje** por MCP, sem código novo:

```text
UC-A1  "Proponha um somador de 2 bits e prove que ele está certo"
  1. o agente escreve um CircuitDocument (proposta)            ← geração: fora do Veritas
  2. circuit_truth_table(document)                              ← validação + execução
  3. circuit_equivalence(document, referência)                  ← verificação exaustiva
     ou run_testbench(document, casos)                          ← verificação por casos
  4. o relatório devolve equivalent/divergent + contraexemplo   ← "evidência" efêmera
  5. o agente corrige e repete
```

O que falta para esse fluxo virar infraestrutura (ver [`AI_INTEGRATION.md`](../03-AI/AI_INTEGRATION.md)):
saída estruturada (`outputSchema`), identidade de engine e de entrada no resultado, registro
persistente e reprodutível, e uma forma governada de **aplicar** a proposta num projeto do usuário.

| ID | Caso | Estado |
| --- | --- | --- |
| UC-A1 | Propor → verificar → corrigir, com contraexemplo | `IMPLEMENTED` (efêmero, sem registro) |
| UC-A2 | Agente lê o projeto aberto do usuário | `PLANNED` ("API de contexto do canvas", `docs/ROADMAP.md` v1.0.0) |
| UC-A3 | Agente propõe alteração e o usuário revisa diff + preview antes de aplicar | `PARTIAL` na UI (otimização por IA com botão "Aplicar"); `PLANNED` no MCP |
| UC-A4 | Resultado de verificação anexado a PR/commit como evidência | `RESEARCH` |
| UC-A5 | Agente em CI bloqueia merge quando testbench/equivalência falha | `RESEARCH` (possível hoje via script próprio; sem CLI oficial) |
| UC-A6 | Agente modela algo que não é lógica digital | Fora de escopo (NG-03, NG-24) |

## 4. Casos de uso comerciais

Demo gratuita com limites publicados, edição final paga, DLCs, serviços cloud pagos: `PLANNED`
(`docs/COMMERCIAL_MODEL_STEAM.md`). Nenhum fluxo técnico implementado.
