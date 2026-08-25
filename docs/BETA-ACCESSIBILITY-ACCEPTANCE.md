# Aceitação Beta — Acessibilidade e mobile/PWA

**Produto:** Veritas  
**Versão candidata:** `v0.9.0-rc.15`
**Objetivo:** garantir que o fluxo principal do Veritas seja navegável por teclado, tenha landmarks e anúncios acessíveis, preserve feedback offline e mantenha uma área de edição utilizável em telas pequenas.

## 1. Contrato A11Y

O gate é executado por `npm run beta:accessibility` e produz um relatório sanitizado com cinco cenários. O runner verifica contratos estruturais versionados no código e executa um teste Vitest do contrato; ele não inventa resultados de um navegador real e não registra dados de usuários.

| ID | Área | Critério |
|---|---|---|
| A11Y-001 | Landmarks | Existe skip link visível no foco, `main#main-content`, título `h1#app-title` e relação `aria-labelledby`. |
| A11Y-002 | Teclado | Linhas da tabela verdade possuem foco, `aria-selected`, nome de linha e seleção por Enter/Espaço. |
| A11Y-003 | Feedback PWA | Avisos offline/PWA usam `aria-live="polite"` e `aria-atomic="true"`. |
| A11Y-004 | Editor e calculadora acessíveis | O documento declara `lang="pt-BR"`, viewport responsivo, o canvas usa altura limitada por viewport e `min-height`, o status de validação é anunciado e as orientações de correção são expostas em lista acessível. Os tooltips do editor têm gatilho focável, `aria-describedby`, `role="tooltip"` e visibilidade por foco. O campo de expressão preserva `aria-invalid`, associa o alerta por `aria-describedby` e mostra posição/trecho do erro. |
| A11Y-005 | Regressão | Os contratos A11Y, `validationFeedback` e `expressionErrorPresentation` passam em Vitest e mantêm IDs, sanitização, resumo, localização e orientações determinísticos. |

## 2. Melhorias implementadas

O shell principal agora oferece “Pular para o conteúdo principal”, torna o `main` focável para a navegação assistiva e associa o título da aplicação ao landmark. O estilo global aplica foco visível a links, botões, campos e elementos focáveis, além de respeitar `prefers-reduced-motion`.

As linhas selecionáveis da tabela verdade continuam funcionando por clique e também por teclado. A seleção é anunciada com `aria-selected` e cada linha recebe um nome previsível. Os avisos de conectividade e atualização do service worker passaram a usar região viva educada, sem interromper a leitura do usuário.

O CircuitEditor recebeu landmark para a paleta de componentes, nome para o canvas, status vivo e label explícito no UUID do colaborador. A altura do canvas usa `min-height` e limite relativo à viewport para evitar que o editor ocupe uma área desproporcional em telas móveis. O bloco de validação agora anuncia o total de problemas, mostra ações de correção e identifica o componente afetado sem depender apenas de cor ou `title`.

Os controles de largura, Clock e Delay usam `AccessibleTooltip`: o gatilho pode receber foco por teclado, possui nome acessível e referencia o texto explicativo com `aria-describedby`. A visibilidade por `group-focus-within` permite consultar a orientação sem mouse.

O `ExpressionInput` aproveita os offsets tipados de `VeritasError` para apresentar posição linha/coluna, trecho afetado e marcador visual. O alerta é associado ao campo com `aria-describedby`; o parser continua sendo a fonte da mensagem e da sugestão original.

## 3. Execução local

```bash
npm run beta:accessibility
```

O relatório pode ser gravado fora do diretório público:

```bash
ACCESSIBILITY_REPORT_PATH=artifacts/accessibility-acceptance-$(date +%Y%m%d-%H%M%S).md \
npm run beta:accessibility
```

O workflow `.github/workflows/quality.yml` executa o mesmo comando em cada push e pull request para `main`, depois de testes, typecheck, lint, builds e gate HDL. A validação estrutural agora também protege o resumo de validação e o tooltip do editor. A confirmação de viewport, foco visual e leitura do tooltip deve ser complementada por inspeção manual em Chromium desktop, Firefox desktop, WebKit/iOS ou Safari e viewport móvel antes da promoção beta definitiva.

## 4. Manifesto beta

O agregador consome o relatório pelo ambiente `BETA_ACCESSIBILITY_REPORT`:

```bash
BETA_EXPECTED_VERSION=0.9.0-rc.15 \
BETA_ACCESSIBILITY_REPORT=artifacts/accessibility-acceptance.md \
BETA_EVIDENCE_OUTPUT=artifacts/beta-evidence-manifest.json \
npm run beta:evidence
```

O gate `accessibility` só fica `PASS` quando A11Y-001 a A11Y-005 estão explicitamente em `PASS` e o caminho da evidência está presente. Ausência, `SKIP`, `PENDING` ou `FAIL` mantém `ACCESSIBILITY-EVIDENCE-INCOMPLETE` em `openP1`.

## 5. Limites

Este gate não substitui auditoria manual com leitor de tela, testes de contraste em todos os temas, matriz real de navegadores, rotação de tela, teclado virtual, safe areas, zoom de texto ou teste de instalação PWA em dispositivo físico. Ele reduz regressões estruturais e garante que o caminho principal não dependa somente de mouse ou de mensagens visuais.

A promoção beta continua condicionada aos demais gates: matriz RLS cross-user real, Realtime com sessões descartáveis, Edge autenticada, HDL, rollback e onboarding. Nenhum PASS estrutural deve ser interpretado como aprovação total do produto.

## Referências

[1]: ../src/App.tsx "Veritas — shell, landmarks e skip link"

[2]: ../src/components/TruthTableView.tsx "Veritas — tabela verdade navegável por teclado"

[3]: ../src/components/PwaStatus.tsx "Veritas — feedback offline e atualização PWA"

[4]: ../src/components/CircuitEditor.tsx "Veritas — canvas responsivo, validação e colaboração"

[5]: ../src/components/AccessibleTooltip.tsx "Veritas — tooltip acessível por foco"

[6]: ../src/circuit/validationFeedback.ts "Veritas — orientações acionáveis de validação"

[7]: ../src/components/ExpressionInput.tsx "Veritas — feedback localizado de erro"

[8]: ../src/engine/expressionErrorPresentation.ts "Veritas — formatter de posição de erro"

[9]: https://www.w3.org/WAI/standards-guidelines/wcag/ "W3C — Web Content Accessibility Guidelines"
