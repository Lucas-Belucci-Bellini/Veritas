# Modelo de agentes

> Como agentes (IAs, automações, outras ferramentas) podem interagir com o Veritas. Quase tudo
> aqui é `RESEARCH`: serve para delimitar o espaço, não para autorizar implementação.
> Legenda em [`../README.md`](../README.md).

## 1. Estado atual do "agente" no Veritas

| Aspecto | Hoje |
| --- | --- |
| Identidade do agente | Nenhuma. O MCP stdio herda o usuário do processo; o MCP HTTP conhece apenas um bearer estático compartilhado. |
| Sessão | Nenhuma. `sessionIdGenerator: undefined`; cada chamada é independente. |
| Acesso a projetos | Nenhum. O agente só vê o que envia no payload. |
| Escrita | Nenhuma ferramenta escreve. |
| Autorização por ferramenta | Delegada ao host (ex.: `enabled_tools` e `default_tools_approval_mode` no Codex). |
| Auditoria | Nenhuma no servidor MCP. |
| Limites | Por chamada (tiques, casos, bits, linhas, bytes, timeout); não há quota por agente. |

Essa ausência é **segura por construção** para leitura/cálculo. Qualquer passo além exige o
modelo abaixo.

## 2. Papéis conceituais

| Papel | Faz | Precisa de | Estado |
| --- | --- | --- | --- |
| **Calculador** | Pede tabelas, simplificações, simulações | Nada além do MCP atual | `IMPLEMENTED` |
| **Verificador** | Compara proposta com referência/casos e lê contraexemplo | MCP atual; melhor com saída estruturada | `IMPLEMENTED` (efêmero) |
| **Proponente** | Produz documento ou mudança para um projeto existente | Leitura do projeto; formato de proposta | `PLANNED` (v1.0.0 "API de contexto do canvas") |
| **Revisor** | Produz relatório/evidência sobre a proposta de outro agente | Evidência reprodutível | `RESEARCH` |
| **Aplicador** | Grava a mudança | **Nunca automático** sem política explícita | `RESEARCH` / NG-20 |

## 3. Níveis de autoridade (proposta de vocabulário)

| Nível | Pode | Confirmação | Estado |
| --- | --- | --- | --- |
| L0 — Computar | Ferramentas puras sobre dados enviados | Nenhuma além do host | `IMPLEMENTED` |
| L1 — Ler | Ler projeto local escolhido pelo usuário | Consentimento de escopo | `PLANNED` |
| L2 — Propor | Criar proposta pendente (não altera o projeto) | Nenhuma para criar; humana para aplicar | `PLANNED` |
| L3 — Aplicar localmente | Aplicar proposta verificada, com rollback | Confirmação humana por mudança | `RESEARCH` |
| L4 — Efeitos externos | Sincronizar, compartilhar, publicar | Confirmação humana + credencial do usuário | Fora de escopo agora |

Regra transversal: **a evidência pode reduzir o esforço de revisão, nunca substituir a autoridade**.

## 4. Estado e continuidade

| Necessidade | Opções (não decididas) |
| --- | --- |
| Continuar uma simulação entre chamadas | Checkpoint Worker v1 já tem assinatura de netlist e linhagem planejada; resume desabilitado |
| Continuar depuração de algoritmo | Hoje o cliente devolve `ExecutionState`; isso exige validação do estado (K-03) ou estado mantido no servidor |
| Bibliotecas de chips por agente | Hoje reenviadas por chamada (≤128); alternativa: recurso MCP ou pacote de projeto |

## 5. Multi-agente

O `docs/ROADMAP.md` menciona "250 subagentes" como visão de longo prazo. Não há caso de uso,
orçamento nem modelo de segurança (NG-23). O único modelo multi-ator existente é a colaboração
Realtime entre **humanos** (owner/editor/viewer, conflito explícito), que pode servir de referência
para papéis, mas não foi desenhada para agentes.

## 6. Requisitos mínimos antes de L1+

1. Contrato canônico único do documento (Foundation etapa 1–3).
2. Evidência com versão de engine e digest de entrada (etapa 5).
3. Saída MCP estruturada e erros codificados (etapa 6).
4. Correção de K-02 e K-03 (validação/segurança).
5. Modelo de proposta e política de aplicação decididos (Q-011, Q-012).
6. Registro de auditoria local para toda aplicação.
