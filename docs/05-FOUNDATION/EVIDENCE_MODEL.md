# Princípio de evidência

> Investiga se "evidência" pode ser a abstração central do Veritas. Distingue rigorosamente o que
> existe do que é hipótese. Legenda em [`../README.md`](../README.md).

## 1. Cadeia hipotética

```text
Claim → Model → Execution → Observation → Verification → Evidence
```

## 2. O que já existe, etapa por etapa

| Etapa | Existe como | Estado |
| --- | --- | --- |
| **Claim** (afirmação) | Implícita: "estes dois circuitos fazem o mesmo", "este circuito satisfaz estes casos", "esta otimização preserva a função" (prompt da Edge) | `PARTIAL` — não há objeto "afirmação"; ela vive na escolha da ferramenta |
| **Model** | `CircuitDocument`, `TestbenchDocument`, `AlgorithmDocument` | `IMPLEMENTED` |
| **Execution** | Avaliação combinacional, `Simulator`, executor de algoritmos — determinísticos, com limites | `IMPLEMENTED` |
| **Observation** | `TestbenchSnapshot`, snapshots do `Simulator`, linhas de tabela | `IMPLEMENTED` |
| **Verification** | `CircuitEquivalenceReport`, `CircuitDifferentialReport`, `TestbenchReport` | `IMPLEMENTED` |
| **Evidence** (artefato durável, identificável, reprodutível) | **Não existe no domínio.** Existe na engenharia de release (manifestos, marcadores de proveniência) | `RESEARCH` (domínio) / `IMPLEMENTED` (release) |

Conclusão: **as etapas intermediárias existem; as pontas (claim explícito e evidência durável) não.**

## 3. Três "evidências" que já existem, em camadas diferentes

### 3.1 Força da conclusão nos relatórios de verificação — `IMPLEMENTED`

O Veritas já pratica a ideia central: o resultado carrega quão forte ele é.

| Força (derivada do código) | Produzida por | Significa |
| --- | --- | --- |
| **Prova exaustiva** | `compareCircuitEquivalence` com `exhaustive: true` | Vale para todo o espaço de entrada declarado |
| **Recusa** | equivalência acima do teto, circuito sequencial, rótulos duplicados | Nenhuma conclusão — e isso é dito |
| **Observação em roteiro** | `compareCircuitTimelines` → `identical` | Vale só para a sequência executada |
| **Conformidade a casos** | `runTestbench` → `passed` | Vale só para os casos escritos |
| **Validação estrutural** | `validateCircuit` | O documento é bem-formado; nada sobre comportamento |
| **Transcrição** | importação DLS | Estrutura copiada; equivalência **não** afirmada |
| **Heurística** | Edge `heuristic()` (`confidence: 0.72` fixo) | Sugestão determinística, não verificada contra intenção |
| **Afirmação de LLM** | Edge `provider: 'llm'` | Proposta/explicação; `confidence` autodeclarada |

Essa escala é o **ativo mais valioso** para a visão de IA. Hoje ela está implícita em nomes de
campos e textos; não é um tipo compartilhado.

### 3.2 Evidência de release — `IMPLEMENTED`

`scripts/betaEvidence.mjs`, `betaEvidenceProvenance.mjs`, `aggregate-beta-evidence.mjs`: manifesto
por versão, gates com `status` + `evidence`, marcadores de proveniência que distinguem execução
real de simulada (`Execution mode: REAL`, contas descartáveis, revisor humano), bloqueadores
`openP0`/`openP1`, "ausência não é aprovação". É um modelo de evidência sério — para QA do produto.

### 3.3 Hashes — `PARTIAL`

`contentHash` (FNV-1a 32), `netlistSignature` (FNV-1a 64), `documentKey`. Úteis para deduplicar e
detectar mudança local; **inadequados para integridade ou identidade de evidência** (DUP-06).

## 4. O que faltaria para "evidência" ser uma abstração do domínio

Hipótese, não decisão. Um registro de evidência precisaria, no mínimo, responder:

| Pergunta | Campo hipotético | Existe hoje? |
| --- | --- | --- |
| O que foi afirmado? | `claim` (tipo + parâmetros) | Não |
| Sobre qual modelo exatamente? | digest criptográfico da forma canônica do(s) documento(s) | Não (só FNV, sem canonicalização comum) |
| Com qual motor? | versão do contrato + versão da engine + runtime (TS/Rust/WASM) | Não (versões divergentes) |
| Com quais limites? | budgets, `maxInputBits`, ticks | Parcial (no relatório, não padronizado) |
| O que foi observado? | relatório + contraexemplo | **Sim** |
| Qual a força? | `strength` da escala §3.1 | Implícito |
| É reprodutível? | tudo acima é suficiente para reexecutar | Não garantido |
| Quem pediu / quando? | ator (humano, agente, CI), timestamp | Não |

Propriedades que o código já garante e que tornam a hipótese viável: determinismo, ordem canônica,
ausência de relógio/aleatoriedade na verificação, limites explícitos.

## 5. A evidência pode ser central?

| A favor | Contra / riscos |
| --- | --- |
| Os verificadores já produzem o conteúdo e a força | "Central" pode inflar o escopo antes dos contratos estarem estáveis |
| O projeto já tem cultura de evidência (release) | Sem digest criptográfico e versão única, evidência seria enganosa |
| Diferencia o Veritas de geradores (NG-01) | Evidência só vale dentro dos três domínios modelados (NG-03) |
| Serve igualmente a humanos, CI e agentes | Onde armazenar (local/nuvem/PR) é pergunta aberta (Q-013) |

Leitura desta investigação: evidência é **candidata natural** a abstração central, porque é a
generalização do que o Veritas já faz melhor. Mas ela é consequência de contratos, versões e
canonicalização — não um atalho para eles. Por isso aparece na etapa 5 do
[`FOUNDATION_ROADMAP.md`](./FOUNDATION_ROADMAP.md), depois de contratos, modelos, validação e
versionamento.

## 6. Classificação final

| Item | Estado |
| --- | --- |
| Relatórios com força explícita e contraexemplo | `IMPLEMENTED` |
| Evidência de release com proveniência | `IMPLEMENTED` |
| Tipo compartilhado de "força da conclusão" | `RESEARCH` (nenhum documento o planeja) |
| Registro de evidência de domínio | `RESEARCH` |
| Digest criptográfico e canonicalização única | `RESEARCH` (provenance/hashes aparecem em v4.3.0 como `PLANNED`) |
| Evidência anexada a PR/commit/CI | `RESEARCH` |
| Evidência assinada | Pesquisa futura |
