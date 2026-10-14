# Estratégia de IA

> Qual é o papel do Veritas diante de sistemas de IA. Separa o que existe, o que está planejado e
> o que é hipótese. Legenda em [`../README.md`](../README.md).

## 1. Tese

> **Uma IA propõe; o Veritas calcula e verifica; um humano ou uma política declarada autoriza.**

A tese não pede que o Veritas "seja inteligente". Pede que ele seja **exato, determinístico,
limitado e honesto sobre a força das próprias conclusões** — exatamente as propriedades que o
código já tem no domínio de lógica digital.

Origem documental: `issue.md` (MCP para a IA "não alucinar"; papéis Write/Compute/Debug),
`docs/ROADMAP.md` v1.0.0 ("plataforma estável para pessoas e IAs … uma IA consegue consultar e propor
alterações sem editar silenciosamente o projeto"), `VERITAS_MASTER_BUILD_QUEUE.md` fase v3.6.0
(Prompt → Intent → Proposal → Validation → Diff → Preview → Confirmation → Apply → Audit).

## 2. O que existe hoje

| Capacidade | Estado | Detalhe |
| --- | --- | --- |
| IA como **consumidora** do motor (MCP) | `IMPLEMENTED` | 17 ferramentas determinísticas, sem efeito colateral, stdio; plugin do Claude Code |
| IA como **produtora** de análise/otimização | `PARTIAL` | Edge Function `veritas-circuit-ai`, provedor configurável (`AI_PROVIDER_URL`, `AI_MODEL`, padrão `gpt-5-mini`), saída JSON Schema estrita, fallback heurístico, métricas |
| Contexto determinístico para IA | `IMPLEMENTED` (escalar) | `buildCircuitContext` |
| Proposta revisada antes de aplicar | `PARTIAL` | Botão "Aplicar otimização" após validação estrutural; **sem** equivalência, diff visual ou rollback dedicado |
| Memória/contexto persistente para IA | Dormente | Tabela `veritas_circuit_context` sem consumidor |
| Ferramentas de escrita para agentes | Ausente | Deliberado (NG-20) |
| Intenção declarativa, auditoria, rollback | `PLANNED` | v1.9 / v3.6.0 |

## 3. O que diferencia o Veritas de "mais uma ferramenta para IA"

Três propriedades que o código já demonstra e que poucas ferramentas têm:

1. **Força explícita da conclusão.** `equivalent` ≠ `identical` ≠ `passed`; recusa em vez de prova
   parcial. Para um agente, isso é a diferença entre "posso afirmar" e "observei num caso".
2. **Contraexemplo determinístico.** Um agente recebe a entrada exata que refuta sua proposta — o
   insumo mais útil para autocorreção.
3. **Fail-closed com limites.** Um agente não consegue, por acidente, pedir um cálculo ilimitado
   (com exceções conhecidas: K-03).

## 4. Princípios de autoridade (derivados do repositório)

| # | Princípio | Estado de aplicação |
| --- | --- | --- |
| AI-P1 | IA nunca altera projeto sem proposta → validação → preview → confirmação → aplicação reversível | Escrito (`VERITAS_V3_V5_ROADMAP.md` §1); parcialmente praticado |
| AI-P2 | Saída de LLM é **proposta ou explicação**, nunca evidência | Implícito (`provider`, `confidence` autodeclarada); precisa virar regra de produto (NG-22) |
| AI-P3 | Toda proposta estrutural passa pelo mesmo validador do editor | `IMPLEMENTED` (cliente) |
| AI-P4 | Toda proposta que alega preservar comportamento deve ser verificada comportamentalmente | **Não aplicado** — o prompt de `optimize` pede equivalência, ninguém confere (G-03) |
| AI-P5 | IA é opcional; existe caminho local determinístico | `IMPLEMENTED` (heurística; tudo funciona sem IA) |
| AI-P6 | Dados do usuário só saem com ação explícita e consentimento | `IMPLEMENTED` (IA exige login e clique) |
| AI-P7 | Conteúdo do usuário é dado não confiável para o LLM | `PARTIAL` — instrução limitada a 1200 caracteres e separada do contexto, mas rótulos do circuito chegam ao prompt sem tratamento |

## 5. Opções estratégicas (não decididas)

Registradas como Q-002 no [`DECISION_LOG.md`](../07-DECISIONS/DECISION_LOG.md).

| Opção | Descrição | Custo | Coerência com o código |
| --- | --- | --- | --- |
| S1. **Verificador para agentes externos** | O Veritas não embute LLM; foca em MCP de alta qualidade (saída estruturada, evidência reprodutível) | Baixo–médio | Alta: continua o que o MCP já faz |
| S2. **IA embutida controlada** | Evoluir a Edge Function para propostas com intenção, diff, verificação automática e rollback | Médio | Média: depende de nuvem e provedor |
| S3. **Ambos, com contrato comum** | O mesmo pipeline de proposta/verificação atende o LLM embutido e agentes externos | Maior | Alta, se os contratos vierem antes |
| S4. **IA local (WebLLM/Ollama)** | Ideia original do `issue.md` | Alto, incerto | Baixa hoje; não perseguida |

Observação técnica neutra: S1 e S3 compartilham o mesmo pré-requisito — contratos e evidência —, o
que torna esse trabalho útil em qualquer escolha.

## 6. O que a IA não deve fazer (qualquer opção)

- Persistir, sincronizar, apagar ou compartilhar sem confirmação humana.
- Promover o próprio resultado a "verificado".
- Receber credenciais, tokens ou chaves (o contexto de IA já exclui isso por contrato).
- Ampliar limites de execução por instrução em linguagem natural.
- Executar HDL, scripts ou conteúdo importado.

Detalhamento por fronteira em [`../06-SECURITY/TRUST_BOUNDARIES.md`](../06-SECURITY/TRUST_BOUNDARIES.md).
