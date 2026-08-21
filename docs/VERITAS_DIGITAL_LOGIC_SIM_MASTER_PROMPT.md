# VERITAS — DIGITAL LOGIC SIM MASTER BUILD PROMPT

> **Documento mestre de execução.** Este arquivo é um prompt operacional para agentes de desenvolvimento (Claude Code, Codex, Manus ou equivalentes) trabalharem no Veritas. O objetivo é transformar o projeto em um simulador de lógica digital completo, profissional, local-first e extensível — uma alternativa séria ao Digital Logic Sim, não apenas uma calculadora de tabelas-verdade.

---

## 0. MISSÃO

Você está trabalhando no **Veritas**, um projeto que já possui um motor lógico, editor visual, simulação sequencial, persistência local, PWA, Supabase, colaboração, exportação HDL, MCP e catálogo de chips.

A missão agora é deixar de tratar o Veritas como um projeto experimental e construir um **ambiente completo de engenharia de lógica digital**.

O produto final deve permitir que uma pessoa:

1. crie circuitos do zero;
2. coloque componentes em um canvas;
3. conecte fios e barramentos;
4. simule sinais em tempo real e por passos;
5. observe estados internos;
6. construa componentes reutilizáveis;
7. crie chips hierárquicos;
8. monte circuitos combinacionais e sequenciais;
9. trabalhe com clocks, delays, memória e máquinas de estado;
10. depure circuitos como depura software;
11. veja tabela verdade, waveform e propagação de sinais;
12. simplifique lógica automaticamente;
13. compare implementações equivalentes;
14. exporte/importa circuitos em formatos próprios e HDL;
15. trabalhe offline sem perder o projeto;
16. sincronize e colabore quando quiser;
17. usar IA como assistente de engenharia, sem permitir que IA substitua a fonte de verdade determinística do simulador.

**Princípio central:** o Veritas deve ser uma ferramenta de engenharia. A interface pode ser bonita, mas correção, determinismo, desempenho, observabilidade, segurança e reprodutibilidade vêm primeiro.

---

# 1. REGRAS ABSOLUTAS

### 1.1 Não destruir o que já existe

- Não apagar funcionalidades existentes.
- Não substituir silenciosamente o motor atual.
- Não quebrar documentos `.veritas` existentes.
- Não remover compatibilidade sem migração explícita.
- Não remover testes para fazer a suíte passar.
- Não esconder erros.
- Não mascarar comportamento incorreto com hacks de UI.
- Antes de alterar uma API pública, localizar todos os consumidores.
- Toda migração deve ter compatibilidade ou conversor versionado.

### 1.2 Fonte de verdade

A implementação determinística do motor é a autoridade.

IA, UI, colaboração, MCP e exportadores são consumidores do motor; nunca devem criar uma segunda implementação incompatível da lógica.

### 1.3 Local-first

O aplicativo deve continuar útil:

- sem conta;
- sem Supabase;
- sem internet;
- sem IA;
- sem servidor externo.

A nuvem é uma capacidade adicional, não uma dependência para simular um circuito.

### 1.4 Qualidade

Nenhuma fase é considerada concluída apenas porque compila.

Uma fase só termina quando houver:

- implementação;
- testes unitários;
- testes de integração;
- testes de regressão;
- testes de desempenho quando aplicável;
- documentação;
- critérios de aceite verificáveis;
- build limpo;
- ausência de erros de console relevantes;
- revisão de compatibilidade.

---

# 2. PRIMEIRO TRABALHO: AUDITORIA

Antes de implementar qualquer funcionalidade nova:

1. leia `README.md`;
2. leia `issue.md`;
3. leia `plano.md`;
4. leia `docs/ROADMAP.md`;
5. leia `docs/ONBOARDING.md`;
6. descubra a estrutura de `src/`, `mcp/`, `plugins/`, testes e configurações;
7. identifique os motores existentes;
8. identifique contratos existentes;
9. identifique formatos persistidos;
10. execute a suíte atual;
11. execute build/lint/typecheck;
12. registre o estado inicial;
13. procure dívida técnica que possa bloquear a arquitetura futura.

Crie, se ainda não existir:

`docs/ARCHITECTURE_BASELINE.md`

Esse documento deve registrar o estado real do projeto, não o estado desejado.

---

# 3. ARQUITETURA-ALVO

Organize o sistema em camadas claramente separadas:

```text
Veritas
├── Core Logic
│   ├── lexer/parser
│   ├── AST
│   ├── boolean algebra
│   ├── truth tables
│   └── simplification
│
├── Circuit IR
│   ├── nodes
│   ├── ports
│   ├── nets
│   ├── buses
│   ├── components
│   ├── hierarchy
│   └── serialization
│
├── Simulation Runtime
│   ├── combinational engine
│   ├── sequential engine
│   ├── event scheduling
│   ├── propagation delay
│   ├── clock domains
│   ├── memory
│   └── deterministic snapshots
│
├── Analysis
│   ├── equivalence
│   ├── reachability
│   ├── timing
│   ├── critical path
│   ├── unused logic
│   ├── floating signals
│   └── contention detection
│
├── Debugging
│   ├── breakpoints
│   ├── watch expressions
│   ├── probes
│   ├── trace
│   ├── step execution
│   └── time travel/checkpoints
│
├── Component System
│   ├── built-in gates
│   ├── chips
│   ├── custom chips
│   ├── hierarchical components
│   └── library/catalog
│
├── Persistence
│   ├── local documents
│   ├── migrations
│   ├── import/export
│   └── cloud sync
│
├── Collaboration
│   ├── rooms
│   ├── presence
│   ├── structural operations
│   └── runtime sharing
│
├── Interface
│   ├── canvas
│   ├── inspectors
│   ├── project browser
│   ├── waveform
│   ├── truth table
│   └── diagnostics
│
└── Integrations
    ├── MCP
    ├── AI
    ├── Verilog
    └── VHDL
```

Não permita que componentes de UI conheçam detalhes internos do simulador.

---

# 4. CIRCUIT IR — O CORAÇÃO DO SISTEMA

Criar/manter uma representação intermediária estável para circuitos.

Um circuito deve possuir:

- id;
- schemaVersion;
- nome;
- metadata;
- inputs;
- outputs;
- clocks;
- nodes;
- ports;
- nets;
- buses;
- parameters;
- custom components;
- hierarchy;
- simulation settings;
- annotations.

Cada componente deve possuir identidade estável.

Cada conexão deve ser representável independentemente da UI.

A posição visual de um componente não pode alterar a semântica do circuito.

---

# 5. MOTOR DE SIMULAÇÃO PROFISSIONAL

Evoluir o simulador para suportar:

## Combinacional

- AND;
- OR;
- NOT;
- NAND;
- NOR;
- XOR;
- XNOR;
- buffers;
- tri-state quando o modelo suportar;
- constantes;
- comparadores;
- multiplexadores;
- demultiplexadores;
- encoders;
- decoders;
- adders;
- subtractors;
- shifters;
- ALU.

## Sequencial

- SR latch;
- D latch;
- D flip-flop;
- T flip-flop;
- JK flip-flop;
- registradores;
- contadores;
- divisores de frequência;
- shift registers;
- RAM;
- ROM;
- stacks simples;
- máquinas de estado.

## Runtime

O runtime deve ter um modelo determinístico de:

- tick;
- evento;
- delta cycle;
- propagação;
- estado atual;
- próximo estado;
- clock edge;
- reset;
- enable;
- atraso.

Evitar loops infinitos em feedback combinacional.

Detectar e diagnosticar ciclos inválidos.

Permitir feedback válido quando existir armazenamento/estado entre os ciclos.

---

# 6. MODELO DE SINAIS

O modelo não deve ficar limitado a booleanos.

Projetar uma abstração capaz de representar:

- 0;
- 1;
- X/unknown;
- Z/high impedance, quando suportado;
- vetores multi-bit;
- signed/unsigned quando necessário;
- largura explícita;
- metadados temporais.

Nunca converter silenciosamente uma largura incompatível.

Exemplo:

```text
8-bit + 4-bit
```

deve gerar diagnóstico ou obedecer a uma regra explícita de extensão, nunca truncar silenciosamente.

---

# 7. BARRAMENTOS

Implementar barramentos como primeira classe:

- 1, 2, 4, 8, 16, 32, 64 bits e arquitetura extensível;
- seleção de bits;
- concatenação;
- split;
- merge;
- constantes dimensionadas;
- visualização binária/hexadecimal/decimal;
- sinais signed/unsigned;
- validação de largura.

A UI deve deixar evidente quando o usuário está conectando um escalar a um vetor.

---

# 8. EDITOR VISUAL

O canvas deve evoluir para uma ferramenta de engenharia.

Implementar progressivamente:

- snap to grid;
- alinhamento;
- distribuição;
- seleção múltipla;
- copiar/colar;
- duplicar;
- undo/redo transacional;
- zoom;
- pan;
- minimap;
- seleção por caixa;
- labels;
- comentários;
- cores/estilos por função;
- auto-routing de fios;
- conexões ortogonais;
- portas visíveis;
- indicadores de direção;
- destaque de sinal ativo;
- destaque de erro;
- agrupamento;
- hierarquia;
- subcircuitos.

O usuário deve conseguir trabalhar em circuitos pequenos e em circuitos grandes sem o canvas virar uma parede ilegível.

---

# 9. HIERARQUIA E CUSTOM CHIPS

Essa é uma das maiores prioridades.

Permitir que o usuário transforme um circuito em um componente reutilizável.

Um custom chip deve possuir:

- nome;
- versão;
- entradas;
- saídas;
- parâmetros;
- implementação interna;
- ícone/representação visual;
- documentação;
- testes opcionais;
- compatibilidade de interface.

Exemplo de fluxo:

```text
AND + NOT + OR
        ↓
   salvar como
        ↓
     MyGate
        ↓
usar MyGate em outro circuito
```

Alterações internas devem preservar instâncias antigas por versionamento/migração.

---

# 10. BIBLIOTECA DE COMPONENTES

Organizar uma biblioteca profissional:

```text
Basic Gates
Arithmetic
Selectors
Memory
Sequential
Counters
Registers
Display
Input/Output
Timing
Bus
State Machines
CPU Building Blocks
Imported Chips
User Components
```

O catálogo existente de chips deve ser preservado e validado.

Criar metadados para cada componente:

- categoria;
- entradas;
- saídas;
- largura;
- estado;
- atraso;
- documentação;
- exemplos;
- testes.

---

# 11. WAVEFORM / OSCILOSCÓPIO DIGITAL

Criar um painel temporal profissional.

Deve mostrar:

- clock;
- entradas;
- saídas;
- sinais internos;
- barramentos;
- estados;
- eventos;
- mudanças de valor.

Recursos:

- zoom temporal;
- cursor;
- seleção de intervalo;
- marcadores;
- nomes;
- valores binário/hex/decimal;
- comparação entre sinais;
- exportação;
- captura de execução.

O waveform deve consumir snapshots/trace do runtime, não duplicar a lógica do simulador.

---

# 12. DEBUGGER

Criar um debugger de circuitos.

Recursos:

- Step;
- Run;
- Pause;
- Reset;
- Step Into hierarquia;
- probes;
- watch;
- breakpoints por componente;
- breakpoints por sinal;
- breakpoints por condição;
- timeline;
- snapshots;
- comparação entre snapshots;
- explicação do motivo de uma saída ter mudado.

Exemplo:

```text
OUT mudou de 0 → 1
porque:
A = 1
B = 1
AND#17 = 1
OR#04 recebeu 1
```

---

# 13. DIAGNÓSTICOS

O Veritas deve explicar erros de engenharia.

Exemplos:

- entrada desconectada;
- saída sem consumidor;
- duas saídas dirigindo o mesmo net;
- largura incompatível;
- clock ausente;
- clock conflitante;
- feedback combinacional;
- componente desconhecido;
- chip incompatível;
- referência quebrada;
- circuito sem saída observável;
- estado inalcançável;
- memória sem endereço válido.

Cada diagnóstico deve possuir:

- código estável;
- severidade;
- localização;
- explicação;
- correção sugerida;
- ação quando aplicável.

---

# 14. ANÁLISE E EQUIVALÊNCIA

Implementar ferramentas para comparar circuitos.

Exemplos:

```text
Circuito A == Circuito B ?
```

A análise deve poder usar:

- tabela verdade para circuitos pequenos;
- normalização;
- SAT/BDD ou outras técnicas adequadas quando necessário;
- comparação estrutural quando válida.

Mostrar contraexemplo quando forem diferentes:

```text
Diferença encontrada:
A=1 B=0 C=1
Circuito A → 1
Circuito B → 0
```

---

# 15. SIMPLIFICAÇÃO E SÍNTESE

Preservar e expandir:

- Quine-McCluskey;
- Karnaugh;
- SOP/POS;
- álgebra booleana;
- minimização;
- contagem de portas;
- estimativa de complexidade.

Adicionar modo:

```text
Minha implementação
        ↓
Analisar
        ↓
Implementação equivalente mais simples
```

Nunca substituir o circuito do usuário automaticamente. Sempre mostrar a proposta e permitir comparação.

---

# 16. MEMÓRIA E SISTEMAS DIGITAIS

Construir uma biblioteca educacional e de engenharia para sistemas maiores.

Componentes-alvo:

- RAM;
- ROM;
- register file;
- PC;
- mux;
- decoder;
- ALU;
- accumulator;
- control unit;
- instruction register;
- clock;
- reset;
- buses.

Meta de longo prazo: permitir construir uma CPU didática dentro do Veritas usando apenas componentes do próprio sistema.

---

# 17. MÁQUINAS DE ESTADO

Criar suporte visual a FSM:

- estados;
- transições;
- inputs;
- outputs;
- Moore;
- Mealy;
- tabela de transição;
- minimização quando aplicável;
- geração de circuito;
- simulação passo a passo.

Permitir alternar entre:

```text
FSM visual ↔ circuito lógico
```

---

# 18. VERILOG / VHDL

A exportação HDL existente deve evoluir para uma camada de compilação séria.

Requisitos:

- nomes determinísticos;
- widths corretos;
- hierarquia preservada;
- clocks explícitos;
- reset explícito;
- sem truncamentos silenciosos;
- round-trip quando possível;
- testes de equivalência entre circuito e HDL exportado.

No futuro, considerar importação de HDL para o IR do Veritas.

---

# 19. PERSISTÊNCIA E MIGRAÇÕES

O formato `.veritas` deve ser versionado.

Implementar:

```text
schemaVersion
migration pipeline
validation
recovery
```

Arquivos inválidos devem produzir diagnóstico útil.

Arquivos futuros devem ser recusados de forma segura quando a versão não for suportada.

Nunca destruir o documento original durante uma migração.

---

# 20. PERFORMANCE

O simulador deve ser capaz de trabalhar com circuitos grandes.

Investigar e medir:

- número de nós;
- número de nets;
- número de eventos;
- tempo por tick;
- memória;
- tempo de renderização;
- custo de waveform;
- custo de tabela verdade.

Não otimizar por sensação.

Criar benchmarks reproduzíveis.

Usar profiling antes de reescrever partes críticas.

Se o motor precisar de otimização de baixo nível, manter a API estável e medir antes/depois.

---

# 21. WEB WORKER / EXECUÇÃO FORA DA UI

A UI nunca deve travar porque o simulador está trabalhando.

Avaliar uso de Worker para:

- grandes simulações;
- tabelas verdade grandes;
- análise de equivalência;
- minimização;
- waveform longo;
- importação/exportação pesada.

A comunicação deve ser baseada em mensagens versionadas e canceláveis.

---

# 22. IA

A IA deve ser um copiloto de engenharia.

Ela poderá:

- explicar um circuito;
- sugerir simplificações;
- localizar possíveis problemas;
- gerar componentes;
- transformar especificação textual em circuito;
- explicar waveform;
- gerar testes;
- documentar chips;
- ajudar no aprendizado.

Mas:

**IA não é a fonte de verdade.**

Toda sugestão deve passar pelo parser/IR/validator/simulator antes de ser apresentada como válida.

A IA deve distinguir:

```text
proposta
validada
rejeitada
```

---

# 23. MCP

Expandir o servidor MCP para expor capacidades determinísticas do Veritas.

Ferramentas possíveis:

- parse_expression;
- evaluate_expression;
- create_circuit;
- inspect_circuit;
- simulate;
- step_simulation;
- inspect_signal;
- generate_truth_table;
- simplify;
- compare_circuits;
- export_verilog;
- export_vhdl;
- validate_circuit;
- explain_diagnostic.

O MCP deve reutilizar os mesmos módulos do aplicativo.

---

# 24. COLABORAÇÃO

Preservar o modelo local-first e adicionar colaboração como camada.

Requisitos:

- presença;
- edição concorrente;
- operações estruturais versionadas;
- conflitos explícitos;
- permissões;
- owner/editor/viewer;
- runtime compartilhado opcional;
- nada substituir silenciosamente o estado local.

A colaboração deve trabalhar com operações/eventos, não com snapshots cegos enviados a todo instante.

---

# 25. UX

O aplicativo deve parecer uma ferramenta profissional, não um formulário com um canvas.

Estrutura sugerida:

```text
┌─────────────────────────────────────────────────────────────┐
│ File | Edit | View | Simulate | Analyze | Tools | Help     │
├────────────┬────────────────────────────────────┬───────────┤
│ Components │                                    │ Inspector │
│ Library     │              CANVAS                │           │
│ Projects    │                                    │           │
│ Hierarchy   │                                    │           │
├────────────┴────────────────────────────────────┴───────────┤
│ Console / Diagnostics / Waveform / Truth Table / Timeline  │
└─────────────────────────────────────────────────────────────┘
```

Não colocar tudo na sidebar.

Recursos avançados devem aparecer em painéis/docks contextuais.

Atalhos de teclado devem existir para ações frequentes.

---

# 26. ACESSIBILIDADE

Garantir:

- teclado;
- foco visível;
- labels;
- contraste;
- tamanho ajustável;
- não depender apenas de cor para sinalizar estado;
- mensagens de erro compreensíveis;
- navegação consistente.

---

# 27. TESTES

Criar uma pirâmide de testes.

## Unitários

- parser;
- evaluator;
- IR;
- netlist;
- simulator;
- signals;
- buses;
- memory;
- FSM;
- serialization;
- migrations;
- diagnostics.

## Integração

- editor → IR;
- IR → simulator;
- simulator → waveform;
- project → persistence;
- custom chip → hierarchy;
- export → HDL;
- import → IR.

## E2E

Fluxos completos:

1. criar projeto;
2. colocar portas;
3. conectar;
4. simular;
5. salvar;
6. fechar;
7. reabrir;
8. continuar simulando.

## Propriedades

Adicionar testes de propriedades quando fizer sentido:

- determinismo;
- idempotência de serialização;
- equivalência de implementações;
- conservação de largura;
- ausência de mutação inesperada.

---

# 28. TESTES DE REGRESSÃO CRÍTICOS

Sempre garantir:

```text
expression evaluator == circuit evaluator
```

para todas as combinações possíveis em circuitos pequenos.

Para circuitos sequenciais:

```text
same input sequence
→ same state trace
→ same output trace
```

Após qualquer alteração no runtime, executar esses testes antes de aceitar a mudança.

---

# 29. DOCUMENTAÇÃO

Criar/manter:

```text
docs/
├── ARCHITECTURE_BASELINE.md
├── ARCHITECTURE.md
├── CIRCUIT_IR.md
├── SIMULATION_ENGINE.md
├── SIGNAL_MODEL.md
├── COMPONENT_SYSTEM.md
├── HIERARCHY.md
├── DEBUGGER.md
├── WAVEFORM.md
├── FSM.md
├── MEMORY.md
├── HDL.md
├── AI.md
├── MCP.md
├── COLLABORATION.md
├── PERFORMANCE.md
├── TESTING.md
├── FORMAT.md
└── ROADMAP.md
```

Não escrever documentação fictícia. Atualizar conforme implementação real.

---

# 30. ROADMAP EXECUTÁVEL

## FASE 0 — BASELINE

- auditoria;
- testes;
- arquitetura real;
- contratos;
- dívida técnica;
- benchmarks iniciais.

## FASE 1 — CIRCUIT IR

- consolidar modelo;
- validação;
- serialização;
- migrations;
- compatibilidade.

## FASE 2 — RUNTIME

- engine determinístico;
- sinais;
- eventos;
- delta cycles;
- delays;
- clocks;
- snapshots.

## FASE 3 — EDITOR

- canvas profissional;
- wiring;
- buses;
- hierarchy;
- undo/redo.

## FASE 4 — COMPONENT SYSTEM

- custom chips;
- biblioteca;
- versionamento;
- importação de chips.

## FASE 5 — DEBUGGER

- probes;
- watch;
- breakpoints;
- timeline;
- waveform.

## FASE 6 — ANÁLISE

- equivalência;
- simplificação;
- diagnóstico;
- análise temporal;
- otimização.

## FASE 7 — SISTEMAS

- memória;
- FSM;
- ALU;
- registradores;
- CPU didática.

## FASE 8 — ECOSSISTEMA

- HDL;
- MCP;
- IA;
- colaboração;
- biblioteca compartilhável.

## FASE 9 — HARDENING

- performance;
- acessibilidade;
- segurança;
- migrações;
- E2E;
- documentação;
- release candidate.

---

# 31. CRITÉRIO DE "PRONTO"

Uma funcionalidade só está pronta quando:

```text
Código
  +
Testes
  +
Integração
  +
Performance quando aplicável
  +
Documentação
  +
Compatibilidade
  +
UX
  +
Diagnósticos
  +
CI verde
  =
PRONTA
```

Nunca marcar uma tarefa como concluída apenas porque a tela aparece.

---

# 32. PROCESSO OBRIGATÓRIO DO AGENTE

Para cada fase:

1. estudar o código existente;
2. definir escopo;
3. escrever/atualizar contrato;
4. implementar em pequenos incrementos;
5. testar após cada incremento relevante;
6. executar regressão;
7. revisar performance;
8. revisar UX;
9. atualizar documentação;
10. registrar decisões arquiteturais;
11. preparar release/PR;
12. nunca misturar refatoração gigantesca sem necessidade.

Quando encontrar um problema não relacionado:

- não esconder;
- registrar;
- corrigir se pequeno e seguro;
- caso contrário criar tarefa separada.

---

# 33. DEFINIÇÃO DO PRODUTO FINAL

O resultado não deve ser apenas:

> "um site que desenha portas lógicas."

Deve ser:

> **Um ambiente completo para projetar, simular, analisar, depurar, ensinar e experimentar sistemas digitais, do primeiro AND até uma CPU funcional, mantendo determinismo, rastreabilidade e portabilidade.**

O usuário deve conseguir começar com:

```text
A AND B
```

e terminar construindo:

```text
Gate
→ Adder
→ ALU
→ Register
→ Memory
→ Control Unit
→ CPU
```

sem abandonar o aplicativo no caminho.

---

# 34. INSTRUÇÃO FINAL AO AGENTE

**Não tente implementar tudo de uma vez.**

Use este documento como especificação-mãe.

Primeiro faça a auditoria do Veritas atual. Depois transforme o roadmap em tarefas pequenas, mensuráveis e testáveis. Preserve o que já funciona. Construa a infraestrutura que permite crescer sem reescrever o projeto a cada nova funcionalidade.

Sempre prefira:

- arquitetura explícita;
- contratos estáveis;
- código determinístico;
- testes fortes;
- migrações seguras;
- observabilidade;
- performance medida;
- UX coerente;
- documentação real.

**Não faça demo de uma funcionalidade. Construa a fundação dela.**

**Não esconda limitações. Modele-as.**

**Não deixe a IA inventar sem validação.**

**Não sacrifique o motor para facilitar a interface.**

**Não destrua compatibilidade para ganhar velocidade.**

O objetivo é fazer o Veritas crescer de projeto para produto e, no longo prazo, tornar-se uma referência própria em simulação e engenharia de lógica digital.
