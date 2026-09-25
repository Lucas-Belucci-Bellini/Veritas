# Escopo do Veritas

> Define o que está dentro e fora, em três horizontes. Legenda em [`../README.md`](../README.md).

## 1. Domínios modelados

Um "domínio" só existe no Veritas quando tem **modelo canônico versionado + validador + executor
determinístico + testes**. Pela regra, hoje existem três:

| Domínio | Modelo | Executor | Estado |
| --- | --- | --- | --- |
| Lógica proposicional/booleana | AST de `src/engine/` (texto como entrada; sem documento versionado próprio além do projeto `.veritas`) | `evaluateWithSteps`, `buildTruthTable`, `simplify`, `buildNormalForms`, `buildKarnaughMap` | `IMPLEMENTED` |
| Circuitos digitais (combinacional, sequencial, multi-bit, hierárquico) | `CircuitDocument` `veritas-circuit` v1 | `evaluateCircuit(Vectors)`, `Simulator`, verificadores | `IMPLEMENTED` com lacunas |
| Algoritmos em fluxograma | `AlgorithmDocument` `veritas-algorithm` v1 | `stepAlgorithm`/`runAlgorithm` com expressões restritas (boolean/number/string) | `IMPLEMENTED` (UI de persistência ausente) |

Tudo que não cabe num desses três modelos está **fora do escopo executável atual**, inclusive
"código arbitrário", HDL importado, sinais analógicos e programas de agentes.

## 2. Horizontes

### 2.1 Agora (base real)

- Estudar e calcular lógica booleana (4 notações, passos intermediários, formas normais).
- Projetar, simular, salvar e exportar circuitos de até 256 nós / 512 conexões / 64 bits.
- Verificar circuitos: equivalência exaustiva (≤16 bits), comparação temporal (≤1000 tiques),
  testbench declarativo (≤512 casos).
- Expor tudo isso a agentes por MCP stdio.
- Opcional e opt-in: conta Supabase, sync explícita, histórico, colaboração, análise por IA.

### 2.2 Próximo (planejado em documentos do repositório)

`PLANNED` — fontes: `plano.md`, `docs/ROADMAP.md`, `docs/VERITAS_V3_V5_ROADMAP.md`.

- Portabilidade/migração de formatos (fase "v2.8").
- Execução isolada (Worker, Tauri/Rust) com paridade golden (fase "v2.7").
- Verificação como fluxo de produto: asserções, regressão bloqueante (fase "v2.6"/v2.4.0).
- IA controlada: intenção → proposta → validação → diff → preview → confirmação → aplicação → auditoria (v1.9 / v3.6.0).
- Plugins declarativos com permissões (v3.1–v3.2).
- Pacotes de projeto reproduzíveis, provenance (v4.1, v4.3).
- Modelo comercial demo/final com licença (`docs/COMMERCIAL_MODEL_STEAM.md`).

### 2.3 Hipótese (visão ampliada)

`RESEARCH` — não há decisão nem código.

- Veritas como camada de verificação para agentes de programação.
- "Evidência" como artefato persistente e reproduzível.
- Novos domínios verificáveis além de lógica digital.

## 3. Superfícies e seus escopos

| Superfície | Pode ler | Pode escrever | Executa |
| --- | --- | --- | --- |
| Web/PWA | IndexedDB local, arquivos importados, nuvem opt-in | IndexedDB, arquivos exportados, nuvem após ação explícita | Engine TS no navegador/Worker |
| MCP stdio / HTTP | Somente o payload da chamada + catálogo embutido | **Nada** (ferramentas são sem efeito colateral) | Engine TS no processo Node |
| Plugin Claude Code | Igual ao MCP stdio | Nada | Igual |
| Desktop Tauri | Igual à web (WebView) | Igual à web | Engine TS; comando Rust nativo existe mas não está ligado à UI |
| Edge Function IA | Contexto enviado pelo cliente | Nada no banco | Chamada a provedor LLM + heurística |

## 4. Regra para ampliar escopo

Um domínio, superfície ou integração nova só entra quando tiver, nesta ordem:

1. caso de uso registrado em [`USE_CASES.md`](../01-PRODUCT/USE_CASES.md);
2. modelo canônico versionado e documentado em [`DOMAIN_MODEL.md`](../02-ARCHITECTURE/DOMAIN_MODEL.md);
3. validador fail-closed e limites;
4. executor determinístico com testes;
5. definição de qual força de conclusão ele produz (ver [`EVIDENCE_MODEL.md`](../05-FOUNDATION/EVIDENCE_MODEL.md));
6. entrada na tabela de fronteiras de confiança.

Essa regra formaliza o que o repositório já pratica com a allowlist DLS e com cada envelope de arquivo.
