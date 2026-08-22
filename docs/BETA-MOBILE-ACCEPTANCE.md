# Aceitação Beta — mobile manual

**Produto:** Veritas  
**Versão candidata:** `v0.9.0-rc.10`
**Objetivo:** registrar uma inspeção humana reproduzível do fluxo principal em dispositivo ou viewport móvel, sem confundir um smoke de desktop com aprovação mobile.

## 1. Contrato do gate

O comando `npm run beta:mobile` é seguro por padrão. Sem uma evidência externa fornecida pelo operador, ele produz `MOBILE-001` a `MOBILE-004` como `SKIP`, não abre sessão Supabase, não inventa observações e termina sem transformar ausência de teste em `PASS`.

| ID | Cenário manual | Evidência esperada |
| --- | --- | --- |
| MOBILE-001 | Abrir o fluxo principal em dispositivo/viewport móvel e navegar até o editor | Registro do dispositivo ou viewport, orientação e resultado de abertura sem overflow bloqueante. |
| MOBILE-002 | Usar teclado virtual, toque e foco visível nos controles principais | Checklist de entrada, seleção, tutorial, canvas e controles sem perda do foco principal. |
| MOBILE-003 | Recarregar e repetir o caminho local-first sem conta | Evidência de que expressão, tabela verdade, editor e IndexedDB continuam utilizáveis no mesmo dispositivo. |
| MOBILE-004 | Verificar rotação, zoom, safe area e instalação/segunda abertura PWA quando aplicável | Capturas ou observações datadas com resultado PASS e limites encontrados. |

A confirmação deve ser realizada por uma pessoa externa ao código da fatia, utilizando um dispositivo ou ambiente móvel identificado. O relatório deve registrar revisor, dispositivo, navegador e horário, mas não deve conter tokens, e-mails privados ou dados de circuitos de terceiros.

## 2. Proveniência obrigatória

Uma evidência aceita pelo runner precisa declarar exatamente:

| Campo | Valor/regra |
| --- | --- |
| `executionMode` | `REAL_MANUAL` |
| `runnerGuard` | `MOBILE_MANUAL_ALLOW_REAL=1` |
| `reviewer` | Nome ou identificador operacional não sensível do revisor. |
| `device` | Dispositivo ou viewport usado. |
| `browser` | Navegador/versão ou WebKit/iOS equivalente. |
| `checkedAt` | Timestamp ISO-8601. |
| `checks` | MOBILE-001 a MOBILE-004, todos com `status: PASS` e `evidence` não vazia. |

O campo `runnerGuard` não prova sozinho que a inspeção ocorreu. Ele apenas impede que um relatório seja classificado como real sem uma ativação explícita. A aprovação depende da revisão humana do conteúdo anexado.

## 3. Uso padrão seguro

Para executar o gate sem uma inspeção humana, mantenha o modo padrão:

```bash
MOBILE_REPORT_PATH=artifacts/mobile-acceptance.md npm run beta:mobile
```

O relatório deve conter quatro linhas `SKIP` e não pode ser enviado ao manifesto como evidência `PASS`.

Para aceitar um checklist externo já revisado, crie um JSON fora do frontend, por exemplo:

```json
{
  "executionMode": "REAL_MANUAL",
  "runnerGuard": "MOBILE_MANUAL_ALLOW_REAL=1",
  "reviewer": "external-reviewer",
  "device": "iPhone test device",
  "browser": "Safari iOS",
  "checkedAt": "2026-08-21T00:00:00.000Z",
  "checks": {
    "MOBILE-001": { "status": "PASS", "evidence": "abertura sem overflow bloqueante" },
    "MOBILE-002": { "status": "PASS", "evidence": "toque, teclado virtual e foco verificados" },
    "MOBILE-003": { "status": "PASS", "evidence": "reload local-first e IndexedDB verificados" },
    "MOBILE-004": { "status": "PASS", "evidence": "rotação, zoom e segunda abertura PWA verificadas" }
  }
}
```

Depois execute:

```bash
MOBILE_MANUAL_ALLOW_REAL=1 \
MOBILE_MANUAL_EVIDENCE_PATH=/caminho/para/mobile-evidence.json \
MOBILE_REPORT_PATH=artifacts/mobile-acceptance.md \
npm run beta:mobile
```

Qualquer cenário ausente, status diferente de `PASS`, evidência vazia ou marcador de proveniência incorreto faz o runner falhar. A execução local não publica o manifesto automaticamente.

## 4. Manifesto beta

O agregador consome o relatório por `BETA_MOBILE_REPORT`:

```bash
BETA_MOBILE_REPORT=artifacts/mobile-acceptance.md \
BETA_EVIDENCE_OUTPUT=artifacts/beta-evidence-manifest.json \
npm run beta:evidence
```

O gate `mobile` só fica `PASS` quando MOBILE-001 a MOBILE-004 aparecem explicitamente como `PASS` e o caminho de evidência está presente. Relatório ausente, `SKIP`, `PENDING` ou `FAIL` mantém `MOBILE-EVIDENCE-INCOMPLETE` em `openP1`.

O workflow de qualidade executa `npm run beta:mobile` no modo seguro, portanto a ausência de checklist humano não quebra a CI, mas também não libera beta. A evidência manual precisa ser anexada e revisada separadamente antes de fornecer o status `PASS` ao guard de promoção.

## 5. Limites

Este gate não substitui testes de acessibilidade automatizados, RLS, Realtime, Edge Function, HDL, rollback ou onboarding. Ele também não valida toda a matriz de aparelhos disponíveis no mercado. A promoção beta permanece bloqueada até que a inspeção adequada ao público-alvo esteja documentada, junto dos demais gates cross-user reais e da proveniência anti-simulação.
