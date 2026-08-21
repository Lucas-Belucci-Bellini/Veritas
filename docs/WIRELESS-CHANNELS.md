# Canais wireless do Veritas

Esta primeira fatia cria o contrato puro para túneis de sinal, sem habilitar ainda novos nós no canvas. O objetivo é fixar a semântica antes de alterar o formato persistido do circuito, o avaliador e os exportadores HDL.

## Contrato

`src/circuit/wirelessChannels.ts` recebe endpoints tipados com `nodeId`, `channel`, `kind` (`transmitter` ou `receiver`) e `width`. Os nomes são normalizados por trim, redução de espaços e conversão para minúsculas com hífen. Assim, `Sinal Clock` e ` sinal   clock ` pertencem ao canal `sinal-clock`.

Cada canal aceita um transmissor e zero ou mais receptores. Os receptores são ordenados por `nodeId`, o que mantém respostas determinísticas para UI, testes e futuras ferramentas MCP. Um segundo transmissor gera `duplicate-transmitter`; receptor sem transmissor gera `missing-transmitter`; largura diferente gera `width-mismatch`; identificador duplicado ou vazio gera `duplicate-node`; canal vazio gera `empty-channel`.

## Segurança e limites

O contrato não executa código, não abre conexão externa e não altera documentos. Ele apenas retorna `channels` e `issues`. Nenhuma alteração é feita no Supabase, IndexedDB, Realtime ou no frontend nesta etapa. Isso evita que um tipo de nó ainda não persistido seja aceito parcialmente por um avaliador ou exportador.

A próxima fatia deverá adicionar os tipos de nó transmissor/receptor ao modelo canônico, definir como as conexões wireless participam da validação de ciclos e integrar a resolução ao avaliador escalar/vetorial. Somente depois deverão ser habilitados controles no editor e exportação Verilog/VHDL; receptores sem transmissor e larguras incompatíveis continuarão bloqueando o circuito.

## Validação local

```bash
npm test -- --run src/circuit/wirelessChannels.test.ts
npm run typecheck
```

Os testes cobrem normalização, pareamento determinístico, transmissor duplicado, receptor órfão e incompatibilidade de largura.
