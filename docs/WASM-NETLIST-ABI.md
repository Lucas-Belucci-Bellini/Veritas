# WASM-003 — contrato experimental de netlist

## Objetivo e fronteira

O WASM-003 define a primeira ponte formal entre um `Netlist` combinacional já normalizado e o núcleo Rust compilado para `wasm32-unknown-unknown`. A etapa é uma prova de **paridade golden**, não uma migração do runtime: o navegador, o MCP, o plugin, o Supabase, o IndexedDB e o `CircuitDocument` continuam fora da ponte. O TypeScript permanece responsável pelo produto e pelo fallback local-first.

O contrato recebe somente um subconjunto combinacional com largura uniforme de 1 a 64 bits: `input`, `constant`, `and`, `nand`, `or`, `nor`, `xor`, `xnor`, `not` e `output`. Componentes sequenciais, `custom-chip`, wireless, múltiplas larguras no mesmo documento, labels e posições não atravessam o ABI. A conversão de `CircuitDocument` para esse subconjunto continua sendo responsabilidade de um adaptador explícito e validado.

## ABI de funções

A variante experimental é compilada com a feature Rust `wasm-netlist-abi`. A ABI de prontidão continua disponível, mas `veritas_wasm_capabilities()` retorna `3` nessa variante: o bit `1` identifica o marcador de ABI e o bit `2` identifica a ponte de buffer/netlist. A compilação padrão usada pelo gate WASM-001 continua retornando somente `1`.

| Export | Assinatura | Contrato |
| --- | --- | --- |
| `veritas_wasm_abi_version` | `() -> u32` | Retorna `1`. |
| `veritas_wasm_capabilities` | `() -> u32` | Retorna `3` na variante WASM-003. |
| `veritas_wasm_buffer_ptr` | `() -> u32` | Endereço do buffer linear de entrada/saída. |
| `veritas_wasm_buffer_capacity` | `() -> u32` | Retorna `65536` bytes. Payloads maiores falham. |
| `veritas_wasm_evaluate` | `(input_len: u32) -> u32` | Lê o payload no buffer, avalia e substitui o buffer pelo resultado. Retorna o tamanho do resultado; `0` indica falha. |
| `veritas_wasm_last_error_code` | `() -> u32` | Retorna `0` após sucesso ou um código estável após falha. Não expõe texto, caminho, token ou dado de usuário. |

A memória linear aparece como export técnico do linker para permitir que o host copie bytes para o buffer; ela não é uma API de documentos, não é compartilhada com o navegador e não é usada para executar código arbitrário. O módulo continua sem imports externos.

## Payload de entrada `VNET`

Todos os inteiros usam little-endian. O payload é limitado ao buffer de 65536 bytes e deve consumir exatamente todos os bytes disponíveis.

| Campo | Tamanho | Descrição |
| --- | ---: | --- |
| Magic | 4 | ASCII `VNET`. |
| Versão | 1 | `1`. |
| Largura uniforme | 1 | Inteiro entre `1` e `64`. |
| Quantidade de nós | 2 | Inteiro entre `1` e `4096`. |
| Nós | variável | Repetição na ordem canônica do netlist. |
| Overrides | variável | Quantidade `u16`, seguida de pares índice `u16` + valor `u64`. |

Cada nó possui `id_len: u8`, `id: id_len bytes UTF-8`, `kind: u8`, `value: u64`, `input_count: u8` e `input_indices: input_count × u16`. Os códigos de `kind` são `0 input`, `1 constant`, `2 and`, `3 nand`, `4 or`, `5 nor`, `6 xor`, `7 xnor`, `8 not` e `9 output`. Os índices apontam para nós do mesmo payload, são verificados antes da avaliação e preservam a ordem das portas. `value` representa o sinal inicial de `input` ou o valor de `constant`; para os demais tipos deve ser zero. IDs vazios, duplicados, inválidos ou maiores que 255 bytes são rejeitados pelo adaptador.

O adaptador impõe as aridades do subconjunto: `input` e `constant` não recebem entradas; `not` e `output` recebem exatamente uma; portas lógicas recebem pelo menos uma. Overrides apontam somente para nós `input`, não podem ser duplicados e devem caber na largura declarada. O avaliador Rust ainda valida ciclos, referências ausentes, widths e valores antes de produzir resultado.

## Resultado `VRES`

Após sucesso, o mesmo buffer contém um payload determinístico:

| Campo | Tamanho | Descrição |
| --- | ---: | --- |
| Magic | 4 | ASCII `VRES`. |
| Versão | 1 | `1`. |
| Largura uniforme | 1 | Copiada da entrada. |
| Quantidade de nós | 2 | Copiada da entrada. |
| Valores | `node_count × u64` | Um valor por nó na ordem original do payload. |
| Tamanho da ordem | 2 | Deve coincidir com `node_count`. |
| Ordem topológica | `node_count × u16` | Índices na ordem determinística usada pelo Rust. |

A camada TypeScript reconstrói `BitVector` a partir da largura e dos valores, deriva `outputs` dos nós `output` e compara `values`, `outputs` e `order` com o mesmo fixture golden. O resultado não contém mensagens livres nem identificadores gerados.

## Erros e compatibilidade

Os códigos mínimos são `1` para magic inválido, `2` para versão inválida, `3` para largura/valor inválido, `4` para payload ou resultado fora do buffer, `5` para shape de nó inválido, `6` para referência/override inválido, `7` para erro do avaliador e `8` para resultado inconsistente. Uma falha retorna `0`, grava apenas o código em `veritas_wasm_last_error_code()` e não publica o buffer como resultado válido.

O contrato é versionado pelo magic, pela versão do payload, pela versão da ABI e pelos bits de capabilities. Adicionar campos obrigatórios exige nova versão; o host não deve tentar interpretar um resultado com versão desconhecida. A feature WASM-003 permanece desabilitada no build de produção e não altera o gate WASM-001 padrão.

## Evidência exigida

A prova usa uma matriz pública versionada com quatro casos de netlist, overrides e resultados esperados independentes para 1, 8, 32 e 64 bits. O teste TypeScript avalia cada `Netlist` com `evaluateVectorNetlist`, codifica e decodifica o contrato e compara bytes, valores, saídas e ordem contra o golden. O runner Node instancia o `.wasm` com zero imports, verifica os exports permitidos, executa os mesmos bytes e compara cada `VRES` ao golden. Também exerce magic, versão, largura, truncamento, shape, referência, ciclo e capacidade inválidos; cada falha precisa retornar zero e o código estável correspondente. Divergência, export inesperado ou import externo encerra o gate. Tamanho e duração permanecem métricas informativas, nunca evidência de superioridade.
