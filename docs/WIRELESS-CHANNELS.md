# Canais wireless — WIRELESS-001

**Status:** integração vertical inicial + edição inline de canal
**Formato do documento:** `veritas-circuit` v1
**Data:** 22 de agosto de 2026

## Objetivo

Canais wireless permitem que um `transmitter` publique um sinal e que um ou mais `receiver` o consumam sem uma conexão visual direta entre os nós. A primeira integração mantém o circuito local-first e representa o túnel como uma dependência determinística no netlist, sem alterar o formato das conexões convencionais.

## Contrato

`src/circuit/wirelessChannels.ts` recebe endpoints tipados com `nodeId`, `channel`, `kind` (`transmitter` ou `receiver`) e `width`. Os nomes são normalizados por trim, redução de espaços e conversão para minúsculas com hífen. Assim, `Sinal Clock` e ` sinal   clock ` pertencem ao canal `sinal-clock`.

Cada canal aceita exatamente um transmissor e zero ou mais receptores. Os receptores são ordenados por `nodeId`, mantendo respostas determinísticas para UI, testes e futuras ferramentas MCP. Um segundo transmissor gera `duplicate-transmitter`; receptor sem transmissor gera `missing-transmitter`; largura diferente gera `width-mismatch`; identificador duplicado ou vazio gera `duplicate-node`; canal vazio gera `empty-channel`; canal acima de 64 caracteres gera `channel-too-long`.

## Integração no documento

`transmitter` e `receiver` agora fazem parte de `EditorComponentType`, `EDITOR_COMPONENT_TYPES` e `ComponentType`. O transmissor possui uma entrada convencional (`IN`) e o receptor não possui entrada visual convencional: sua entrada é injetada pelo resolvedor wireless.

Antes de produzir o netlist, `validateCircuit` resolve os endpoints wireless e rejeita canais inválidos. Para um canal válido, cada receptor recebe internamente `{ node: transmitterId }`. A conexão virtual não é adicionada ao documento persistido; ela é derivada de `options.channel` e reconstruída de forma determinística.

A avaliação escalar e vetorial trata os dois tipos como pass-throughs. O simulador temporal também propaga o valor sem adicionar estado próprio. Assim, o canal pode ser usado antes e depois de portas lógicas, inclusive com barramentos de até 64 bits quando a API vetorial estiver habilitada. A ferramenta MCP `simulate_circuit` resolve automaticamente a entrada virtual do receptor a partir de `options.channel`, preservando stdio e os schemas existentes.

## Editor visual

A paleta do `CircuitEditor` possui **Transmissor** e **Receptor**, e a toolbar oferece o campo **Canal** para os próximos nós wireless. O canvas exibe `TX`/`RX`, canal, largura e estado observado. O transmissor tem handle de entrada à esquerda e saída à direita; o receptor tem somente saída visual, porque a alimentação vem do canal.

Ao selecionar um transmitter ou receiver no canvas, o painel **Editar canal wireless** permite corrigir o canal do nó existente. O valor é normalizado durante a edição, o histórico undo/redo continua observando a alteração e viewers em colaboração não podem editar o campo.

Ao abrir um documento, o canvas normaliza nomes, IDs, referências e canais antes de reconstruir os nós. Ao salvar em IndexedDB, sincronizar com Supabase ou transmitir colaboração, a validação canônica continua sendo aplicada pelos consumidores existentes.

## Exportação HDL

Verilog e VHDL representam os endpoints wireless como sinais internos. O transmissor recebe uma atribuição da sua entrada convencional; cada receptor recebe uma atribuição da saída do transmissor; conexões posteriores usam o receptor como qualquer outro sinal. A saída industrial não inventa portas físicas para o canal e preserva o circuito combinacional equivalente.

Canais vazios, transmissores duplicados, receptores órfãos e larguras incompatíveis bloqueiam a exportação antes de gerar HDL. Barramentos continuam sujeitos às regras vetoriais existentes.

## Validação e testes

Os testes determinísticos cobrem normalização, pareamento, ordenação, transmissor duplicado, receptor órfão e incompatibilidade de largura. As regressões de `editorModel.test.ts` e `vectorEvaluation.test.ts` cobrem netlist, avaliação escalar, avaliação vetorial e ordem topológica. `export.test.ts` cobre Verilog e VHDL com sinais wireless.

```bash
npm test -- --run src/circuit/wirelessChannels.test.ts src/circuit/editorModel.test.ts src/circuit/vectorEvaluation.test.ts src/circuit/export.test.ts
npm run typecheck
```

## Limites atuais

A integração não adiciona ainda múltiplos transmissores redundantes, arbitragem de canais, latência wireless configurável, tri-state, sinais `X/Z`, impedância, rádio físico ou semântica de clock-domain crossing. O canal é um túnel lógico determinístico; no `Simulator` e no MCP ele observa a latência de propagação por tique já definida pelo runtime.

A colaboração Realtime, RLS, a Edge Function e os exportadores continuam sujeitos aos seus próprios gates. A presença de um nó wireless não substitui autenticação, autorização, RLS por `auth.uid()` ou validação server-side.

## Próximos passos

A próxima evolução deve decidir se canais wireless permanecem como túnel lógico ou ganham atributos de domínio, como direção, latência e política de conflito. Qualquer ampliação deve preservar o contrato v1, acrescentar migração explícita e adicionar vetores equivalentes para TypeScript, SQL, Edge, MCP e exportadores.

## Referências

[1]: ../src/circuit/wirelessChannels.ts "Contrato de canais wireless"
[2]: ../src/circuit/editorModel.ts "Modelo canônico e validação"
[3]: ../src/circuit/evaluate.ts "Avaliação escalar e vetorial"
[4]: ../src/components/CircuitEditor.tsx "Editor visual persistente"
[5]: ../src/circuit/export.ts "Exportadores Verilog e VHDL"
