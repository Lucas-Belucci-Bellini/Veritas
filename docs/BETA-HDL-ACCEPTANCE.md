# Aceitação Beta — Exportação HDL

**Produto:** Veritas  
**Versão candidata:** `v0.9.0-rc.8`
**Objetivo:** provar que o exportador combinacional gera texto determinístico equivalente em Verilog e VHDL, rejeita circuitos inválidos pelo validador canônico e compila fixtures públicas com toolchains de referência.

## 1. Escopo do gate

O exportador atual cobre circuitos combinacionais com entradas, saídas, constantes, `and`, `or`, `xor` e `not`, incluindo larguras vetoriais quando `allowBuses` é aceito pelo validador. Circuitos sequenciais ou componentes não suportados continuam bloqueados pela interface e não fazem parte desta aceitação.

A regra de domínio fica em `src/circuit/export.ts`. Antes de gerar qualquer texto, `exportVerilog` e `exportVhdl` chamam `validateCircuit(document, { allowBuses: true })` e lançam `CircuitValidationError` quando existem ciclos, referências inválidas, portas desconectadas, larguras inválidas ou outros problemas do documento canônico.

## 2. Fixtures equivalentes

A fixture `tests/fixtures/hdl/vector_and.v` representa um AND vetorial de quatro bits em Verilog-2005. A fixture `tests/fixtures/hdl/vector_and.vhd` representa exatamente o mesmo netlist em VHDL-2008: entradas `A` e `B`, sinal intermediário `A_B` e saída `Y`.

O teste `src/release/hdlAcceptanceContract.test.ts` gera ambas as linguagens a partir do mesmo `CircuitDocument` e compara o texto completo, sem depender somente de substrings. Isso protege ordem de portas, sanitização de identificadores, largura `[3:0]`/`std_logic_vector(3 downto 0)`, operadores e atribuições.

## 3. Cenários HDL-001 a HDL-003

| ID | Operação | Procedimento | Resultado esperado |
|---|---|---|---|
| HDL-001 | Compilação Verilog | Compilar `vector_and.v` com `iverilog -g2005`. | `PASS` quando o fixture é compilado sem erro. |
| HDL-002 | Compilação VHDL | Analisar `vector_and.vhd` com `ghdl -a --std=08`. | `PASS` quando o fixture é aceito pelo analisador VHDL. |
| HDL-003 | Regressão do exportador | Executar `src/circuit/export.test.ts`, incluindo equivalência textual e rejeição de circuito inválido. | `PASS` quando os testes Vitest passam. |

O runner `scripts/hdl-acceptance.mjs` grava somente IDs, status, operação e mensagens truncadas/sanitizadas. Não há tokens, passwords, documentos privados ou dados de usuários nas fixtures ou no relatório.

## 4. Execução local

O comando padrão é tolerante à ausência dos compiladores: sem `iverilog` ou `ghdl`, HDL-001/002 ficam `SKIP` e HDL-003 continua sendo executado. Isso preserva o desenvolvimento local, mas não libera o gate beta.

```bash
npm run beta:hdl
```

Para exigir compilação real no ambiente atual:

```bash
HDL_REQUIRE_TOOLCHAINS=1 \
HDL_REPORT_PATH=artifacts/hdl-acceptance-$(date +%Y%m%d-%H%M%S).md \
npm run beta:hdl
```

Os toolchains de referência podem ser instalados em Ubuntu com:

```bash
sudo apt-get update
sudo apt-get install -y iverilog ghdl
```

## 5. CI e manifesto beta

O workflow `.github/workflows/quality.yml` instala `iverilog` e `ghdl` e executa `HDL_REQUIRE_TOOLCHAINS=1 npm run beta:hdl`. Assim, todo push ou pull request para `main` precisa comprovar compilação real, além dos testes, typecheck, lint, build e smoke PWA.

Para anexar o relatório ao manifesto beta, use `BETA_HDL_REPORT`:

```bash
BETA_EXPECTED_VERSION=0.9.0-rc.8 \
BETA_HDL_REPORT=artifacts/hdl-acceptance.md \
BETA_EVIDENCE_OUTPUT=artifacts/beta-evidence-manifest.json \
npm run beta:evidence
```

O agregador só marca `gates.hdl.status = PASS` quando HDL-001, HDL-002 e HDL-003 têm `PASS` explícito e o caminho da evidência está presente. `SKIP`, `PENDING`, `FAIL` ou relatório ausente mantém `HDL-EVIDENCE-INCOMPLETE` em `openP1`.

## 6. Limites conhecidos

A aceitação valida análise/compilação de fixtures combinacionais, não síntese física, equivalência formal, timing, FPGA, simuladores sequenciais ou cobertura completa de todos os toolchains comerciais. O fato de um fixture compilar não autoriza exportar um circuito inválido: a validação canônica continua sendo a barreira anterior à geração.

O gate HDL pode ser considerado evidência beta somente junto dos gates RLS cross-user, Realtime, Edge, acessibilidade/mobile, rollback e onboarding. Nenhum resultado local ou de CI substitui a matriz real de isolamento Supabase.

## Referências

[1]: ../src/circuit/export.ts "Veritas — exportadores Verilog/VHDL"

[2]: ../src/circuit/export.test.ts "Veritas — testes existentes do exportador"

[3]: ../tests/fixtures/hdl/vector_and.v "Veritas — fixture Verilog vetorial"

[4]: ../tests/fixtures/hdl/vector_and.vhd "Veritas — fixture VHDL vetorial"

[5]: https://steveicarus.github.io/iverilog/ "Icarus Verilog Documentation"

[6]: https://ghdl.github.io/ghdl/ "GHDL Documentation"
