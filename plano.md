# Veritas — Plano do Projeto

Calculadora de tabela verdade e simulador de circuitos digitais no navegador.

## Público-alvo

- Programadores (otimização de condicionais)
- Estudantes de lógica matemática/filosofia
- Estudantes de engenharia (circuitos digitais)

**Problema:** tabelas verdade manuais são demoradas e sujeitas a erro. O site deve responder de forma instantânea, clara e visual.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | React + Vite |
| Linguagem | TypeScript |
| Estilo | Tailwind CSS |
| Ícones | Lucide React |
| Parser | Próprio (AST) — Opção B futura: Peggy.js |
| Visualizador | React Flow + Dagre |
| Persistência local | Dexie.js (IndexedDB) |
| Offline | PWA (Service Workers) |
| Sync cloud (futuro) | Supabase + Yjs (CRDTs) |
| Hospedagem | Vercel |
| IA local (futuro) | WebLLM / Ollama (Hermes) |
| Integrações IA | MCP (Claude Code, Codex, GitHub) |

---

## MVP (v0.1.0) — Motor Lógico

- Barra de input para expressões lógicas
- Suporte a múltiplas sintaxes:
  - Programação: `&&`, `||`, `!`
  - Matemática: `∧`, `∨`, `¬`
  - Texto: `AND`, `OR`, `NOT`, `XOR`
- Geração dinâmica da tabela (V/F ou 1/0)
- Validador de sintaxe em tempo real
- Algoritmo: Lexer → Parser → AST → combinações binárias (2^n linhas)

### Detecção de erros

1. **Parênteses:** pilha (stack) — `(` empilha, `)` desempilha
2. **Sintaxe:** operadores adjacentes, variáveis sem operador, expressão incompleta
3. **Léxico:** caracteres desconhecidos

---

## Roadmap

| Versão | Foco |
|--------|------|
| **v0.1.0** | Lexer, Parser, AST, geração de combinações V/F |
| **v0.2.0** | UI, teclado virtual, feedback em tempo real, dark mode |
| **v0.3.0** | React Flow + Dagre — diagrama de portas lógicas |
| **v0.4.0** | Dexie.js — salvar/carregar projetos localmente |
| **v0.4.9** | Polimento, performance (6+ variáveis), export PDF/CSV |
| **v0.5.0** | PWA offline-first |
| **v0.6.0** | Auth, agrupamento de componentes |
| **v0.7.0** | Sync CRDT (Yjs), túneis wireless (Tx/Rx) |
| **v0.8.0** | Barramentos multi-bit, Splitter, operações bitwise |
| **v0.9.0** | Lógica sequencial: Clock, Flip-Flops, RAM, contadores |
| **v1.0.0** | Subcircuitos (chips customizados), timers, IA local (Hermes) |

---

## UI/UX (wireframe)

1. **Input** — campo central, feedback verde/vermelho, botão limpar
2. **Teclado virtual** — variáveis, operadores, parênteses, constantes; toggle símbolos ↔ programação
3. **Toggles** — V/F vs 1/0, passos intermediários
4. **Tabela** — cabeçalho fixo, coluna resultado destacada, zebra-striping
5. **Ações** — copiar link, exportar CSV/PNG

---

## Fluxo do MVP

```
Usuário digita → Lexer valida → Parser gera AST →
Calcula 2^n linhas (binário) → Avalia AST por linha → Tabela
```

---

## Funcionalidades avançadas (pós-MVP)

- Resolução passo a passo (colunas intermediárias)
- Simplificação de expressões (De Morgan)
- Mapas de Karnaugh
- Simulador interativo (circuito → tabela)
- Export PDF/CSV
- Copilot de engenharia offline (Hermes)
- Integração MCP (GitHub, Claude Code, Codex)

---

## Arquitetura offline (v0.5.0+)

- **Local-first:** Dexie.js no IndexedDB — custo zero
- **Supabase:** sync opcional/premium
- **PWA:** Service Worker cacheia assets para uso sem internet

---

## Referências

- [Digital Logic Sim — Unifil](https://github.com/Eronponce/Digital-Logic-Sim-Unifil.git)
- Sebastian Lague — simulador lógico (Unity)
