# Ferramentas de desenvolvimento

> Build, testes, gates de aceitação e CI como existem hoje. Legenda em [`../README.md`](../README.md).

## 1. Stack

React 19 · TypeScript 7 (`tsc -b`) · Vite 8 · Tailwind 4 · React Flow 12 + Dagre · Dexie 4 ·
Supabase JS 2 · Vitest 4 · oxlint · Zod 4 · `@modelcontextprotocol/sdk` 1.30 · Tauri 2.11 ·
Rust 2021 (`engine-rs` MSRV 1.75, `src-tauri` 1.77). Node 22 no CI.

## 2. Comandos essenciais

| Objetivo | Comando | Observação |
| --- | --- | --- |
| Desenvolver | `npm run dev` | |
| Testes | `npm test` (`vitest run`) | 92 arquivos / 814 testes na linha de base |
| Tipos | `npm run typecheck` | app + `tsconfig.mcp.json` |
| Lint | `npm run lint` | oxlint (`.oxlintrc.json`) |
| Build web | `npm run build` | `dist/` |
| MCP | `npm run build:mcp`, `build:mcp:http`, `mcp:http` | `mcp/dist/` |
| Plugin | `npm run build:plugin`, `validate:plugin` | Regera arquivos **versionados** em `plugins/veritas-logic/` |
| Catálogo DLS | `npm run chips:import [-- caminho]` | Usa `dist-lib` + `../UMBRA-LIMA-ALFA/Chips` |
| Rust | `test:rust`, `bench:rust`, `beta:rust` | `--offline` |
| WASM | `beta:wasm`, `beta:wasm:parity`, `beta:wasm:isolation` | Isolamento garante que bundles não contêm a ponte |
| Benchmarks | `bench:compare`, `bench:circuit-scale` | Relatórios em `artifacts/` |
| Desktop | `desktop:dev`, `desktop:build[:linux|:windows|:macos]`, `desktop:metrics` | |
| Smoke | `smoke:release` (`SMOKE_URL`) | HTTP/PWA |

## 3. Gates de aceitação (`scripts/`)

Cada gate tem implementação `.mjs`, declaração `.d.mts` e testes do **contrato** em `src/release/`.

| Gate | Comando | O que exige para `PASS` real |
| --- | --- | --- |
| RLS | `beta:rls` | 4 contas descartáveis, RLS-001…022, `RLS_RUNNER_ALLOW_REAL=1` |
| Edge | `beta:edge` | JWT descartável real para RLS-020/021 |
| Realtime | `beta:realtime` | Sessões autenticadas, RT-001…005 |
| HDL | `beta:hdl` | Compilação com `iverilog`/`ghdl` (no CI) |
| MCP | `beta:mcp`, `beta:mcp:http` | Protocolo stdio/HTTP |
| A11Y, mobile, rollback, onboarding | `beta:accessibility`, `beta:mobile`, `beta:rollback`, `beta:onboarding` | Mobile exige revisão humana com dispositivo |
| Agregação | `beta:evidence` | Relatórios com marcadores de proveniência; ausência ≠ aprovação |
| Preflight / readiness | `beta:preflight`, `beta:readiness` | Modo estrito com variáveis `*_REQUIRE_*` |
| Promoção | `release:guard` | SemVer, versão declarada, origem da tag |

Esse conjunto é a implementação mais madura do conceito de **evidência** no repositório — mas
aplicado a release, não ao domínio (ver [`EVIDENCE_MODEL.md`](../05-FOUNDATION/EVIDENCE_MODEL.md)).

## 4. Escala de evidência de plataforma

Usada em `plano.md`, CHANGELOG e docs de desktop: `BUILD VERIFIED` → `RUNTIME VERIFIED` →
`SMOKE VERIFIED` → `release ready`, além de `NOT VERIFIED`, `PASSED`, `BASELINE RECORDED`. Regra:
build de runner não é runtime verificado.

## 5. CI (`.github/workflows/`)

| Workflow | Gatilho | Conteúdo |
| --- | --- | --- |
| `quality.yml` | push/PR em `main` | testes, `beta:rust`, WASM (readiness/paridade/isolamento), benchmarks, typecheck, lint, builds web/MCP/HTTP/plugin, gates `beta:*` locais, HDL, preview + smoke PWA, upload de relatórios sanitizados (14 dias) |
| `release.yml` | tag `v*` / manual | valida SemVer/tag, `release:guard`, mesma bateria, cria release |
| `desktop-release.yml` | tag / manual | quality gates + builds nativos por plataforma, manifesto e `SHA256SUMS` |
| `desktop-artifact-verification.yml` | manual | build e verificação de caminhos dos artefatos |

Lacunas observadas [código]: testes do crate `src-tauri` não rodam em `quality.yml`; não há
checagem de que `plugins/veritas-logic/*` está atualizado após `build:plugin`; não há gate de
coerência de versões (DUP-09); não há threshold de cobertura.

## 6. Onde colocar testes

| Tipo | Local |
| --- | --- |
| Unidade de domínio | ao lado do arquivo (`src/**/x.test.ts`) |
| Ferramentas MCP (sem transporte) | `mcp/src/tools.test.ts` |
| Transporte HTTP | `mcp/src/http-server.test.ts` |
| Regressão cross-runtime | `tests/regression/` |
| Paridade Rust/WASM | `tests/rustEngineParity.test.ts`, `tests/fixtures/` |
| Contratos de release | `src/release/*.test.ts` |
| Rust | `engine-rs/tests/golden.rs`, testes em `src-tauri/src/*.rs` |

Regra do projeto: testes ancorados em algo verificável (fixture real, propriedade estrutural,
simetria), nunca em número digitado de memória.

## 7. Integração para desenvolvedores externos

| Forma | Estado |
| --- | --- |
| MCP stdio / plugin | `IMPLEMENTED` — caminho recomendado |
| Pacote npm do domínio | Inexistente (`private: true`; `mcp/package.json` também privado) |
| Build `lib` | Só a engine booleana, uso interno |
| CLI headless (testbench/equivalência com exit code) | Inexistente |
| JSON Schema publicado dos formatos | Inexistente |
