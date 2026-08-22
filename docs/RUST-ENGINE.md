# Núcleo Rust do Veritas

## Objetivo

O Veritas iniciou uma migração incremental para um núcleo determinístico em Rust. A primeira fatia, identificada como **RUST-001**, fica isolada em `engine-rs/` e avalia netlists combinacionais com sinais de 1 a 64 bits. O frontend React, o editor, o IndexedDB, o MCP e os exportadores HDL continuam usando os contratos publicados em TypeScript. Portanto, esta etapa não altera o caminho de produção nem cria uma dependência de Rust para o usuário final.

A decisão é deliberadamente conservadora: o núcleo Rust só poderá substituir partes do avaliador depois que houver paridade golden, benchmark reproduzível, empacotamento WASM aceitável e uma estratégia clara de fallback. Até lá, uma falha de compilação, carregamento ou execução do artefato Rust não pode impedir o funcionamento local-first existente.

## Contrato da primeira fatia

| Elemento | Contrato RUST-001 |
| --- | --- |
| Entrada | `Netlist` com nós nomeados, dependências por ID e `NodeKind` combinacional |
| Sinal | `Signal { width: u8, bits: u64 }` |
| Largura | Inteiro entre 1 e 64 bits, com rejeição de valores fora da máscara |
| Operadores | AND, NAND, OR, NOR, XOR, XNOR e NOT; `Input`, `Constant` e `Output` |
| Ordenação | Kahn determinístico, com fila ordenada por ID |
| Falhas | Nó duplicado, dependência ausente, ciclo, largura inválida, valor incompatível e operando ausente |
| Saída | Valores por nó, saídas públicas e ordem topológica determinística |
| Dependências | Nenhuma crate externa; compilação offline com Cargo |

O contrato vetorial do TypeScript usa bits em ordem MSB → LSB, largura máxima de 64 bits e operações mascaradas [1]. O núcleo Rust usa `u64` para representar os mesmos bits numericamente; a conversão de apresentação deve permanecer na camada de adaptação. O fixture compartilhado em `tests/fixtures/rust-engine/gates.tsv` cobre 1, 8, 32 e 64 bits e é verificado tanto pelo Rust quanto pelas primitivas TypeScript.

> O Rust é um novo núcleo de cálculo, não uma reescrita silenciosa do produto. O contrato observável atual permanece no TypeScript até a migração demonstrar equivalência.

## O que foi aprendido com a referência

O Digital Logic Sim é uma aplicação Unity com módulos públicos separados para simulação, gráficos, persistência e jogo [2] [3]. Seu simulador descreve propagação de sinais por chips e subchips, ordem de processamento e estados tri-state; também registra como oportunidades futuras tabelas de consulta para chips combinacionais e ignorar chips sem mudanças de entrada/estado [4]. Essas ideias ajudam a formular hipóteses de otimização, mas nenhuma implementação C# foi copiada para o Veritas.

O repositório de referência publica uma licença MIT com exigência de preservar os avisos de copyright e licença [5]. A primeira fatia Rust não incorpora código, assets, nomes internos ou arquivos da referência; por isso, não há uma redistribuição de código externo nesta etapa. A referência é mantida aqui apenas como fonte arquitetural documentada.

## Estratégia de integração

A integração futura deve seguir três camadas. A camada de domínio Rust continuará pura e sem DOM, rede, tokens ou acesso ao IndexedDB. Uma camada de adaptação traduzirá o `Netlist` canônico do Veritas para o contrato Rust e converterá o resultado de volta. A UI escolherá o adaptador somente quando o artefato estiver carregado e aprovado; caso contrário, permanecerá no avaliador TypeScript.

WASM é uma possibilidade, não uma promessa desta release. O primeiro gate usa `cargo test` nativo porque Rust e WASM têm custos de empacotamento, memória, inicialização e interoperabilidade que precisam ser medidos. Não será adicionado `wasm-bindgen`, `wasm-pack` ou um artefato binário ao bundle sem benchmark de tamanho, latência de cold start, execução repetida e fallback offline.

A fronteira sequencial também permanece separada. Clock, flip-flops, delays, wireless, custom chips hierárquicos, tri-state e edição concorrente não fazem parte do RUST-001. Eles exigem contratos próprios para estado, ciclos temporais, elaboração e conflitos; misturá-los nesta primeira fatia aumentaria o risco de divergência e de perda do comportamento já publicado.

## Validação atual

O acceptance runner `npm run beta:rust` executa `cargo fmt --check` e `cargo test --offline`, produzindo relatório sanitizado em `artifacts/`. O crate possui cinco testes unitários e um teste golden; o Vitest possui um teste adicional contra o mesmo fixture. A validação demonstrou **2 PASS, 0 FAIL e 0 SKIP** no runner Rust e **1 PASS** no teste de paridade TypeScript. O comando opcional `npm run bench:rust` executa 100.000 avaliações de um netlist fixo e imprime um checksum; ele serve para criar uma série histórica no mesmo ambiente, não para comparar runtimes entre máquinas.

Esses resultados provam compilação, determinismo local e concordância das operações bitwise cobertas. O primeiro benchmark local terminou com `iterations=100000`, checksum determinístico `0` e duração dependente da máquina; esse número não é uma promessa de latência. Os resultados ainda não provam que Rust é mais rápido ou menor que TypeScript, nem autorizam substituir o motor em produção. O próximo critério é um benchmark controlado com cenários equivalentes, incluindo circuitos pequenos, netlists largos, 64 bits, ciclos rejeitados e repetição de avaliações.

## RUST-002 — benchmark comparativo controlado

O comando `npm run bench:compare` executa o avaliador vetorial TypeScript de produção e o núcleo Rust sobre o fixture compartilhado `tests/fixtures/rust-engine/engine-comparison.tsv`. Cada linha usa a mesma topologia combinacional de nove nós, entradas determinísticas, largura de 1, 8, 32 ou 64 bits, 100 iterações de aquecimento fora da medição e 10.001 avaliações cronometradas. A construção do documento/netlist, o parsing do fixture, o build e a inicialização não entram na janela medida.

O lado TypeScript é carregado pelo bundle transformado pelo Vitest/esbuild e chama `evaluateVectorNetlist()`; o lado Rust é executado com `cargo bench --offline --bench comparison` e perfil release. Ambos escrevem `output_bits`, `checksum`, `elapsed_ns`, largura e iterações; o runner falha se qualquer checksum ou saída divergir. O relatório sanitizado fica em `artifacts/engine-comparison-benchmark.md`, acompanhado de JSON local para auditoria.

A paridade de saída é o gate obrigatório. Os tempos servem apenas como observação da mesma máquina e execução: não são uma comparação científica entre sistemas operacionais, compiladores ou máquinas diferentes, e não autorizam afirmar superioridade do Rust. Esta etapa também não habilita WASM, não muda o runtime do navegador e não remove o fallback TypeScript. Uma eventual integração futura deverá medir, separadamente, tamanho do artefato, cold start, memória, repetição, carregamento e comportamento offline.

## Referências

[1]: https://github.com/Lucas-Belucci-Bellini/Veritas/blob/main/src/bus/bitVector.ts "Contrato BitVector do Veritas"
[2]: https://github.com/SebLague/Digital-Logic-Sim "Digital Logic Sim — repositório de referência"
[3]: https://github.com/SebLague/Digital-Logic-Sim/tree/main/Assets/Scripts "Estrutura pública de scripts do Digital Logic Sim"
[4]: https://raw.githubusercontent.com/SebLague/Digital-Logic-Sim/main/Assets/Scripts/Simulation/Simulator.cs "Simulator.cs — referência pública de simulação"
[5]: https://github.com/SebLague/Digital-Logic-Sim/blob/main/LICENSE "Licença MIT do Digital Logic Sim"
