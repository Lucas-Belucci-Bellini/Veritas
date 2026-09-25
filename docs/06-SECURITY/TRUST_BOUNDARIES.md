# Fronteiras de confiança

> Onde os dados mudam de nível de confiança, o que pode entrar, o que precisa de validação,
> o que pode ser executado, persistido ou exige confirmação — e onde a IA não tem autoridade.
> Complementa `docs/BETA-SUPABASE-HARDENING.md`, `docs/EXECUTION_WORKER_BOUNDARY.md` e
> `docs/TAURI_SIMULATION_BOUNDARY.md`. Legenda em [`../README.md`](../README.md).

## 1. Mapa

```text
                ┌──────────────┐
                │    Usuário   │  autoridade final
                └──────┬───────┘
          TB1 (UI)     │ cliques, texto, arquivos
                ┌──────▼───────┐        TB6 ┌───────────────────┐
                │   Frontend   │◄──────────►│ Arquivos / DLS /  │ (não confiáveis)
                │ React / PWA  │            │ URL ?expr=        │
                └──┬───┬───┬───┘            └───────────────────┘
       TB2 (domínio)│   │   │TB3 (IPC)
      ┌─────────────▼┐  │  ┌▼──────────────┐
      │ Engine local │  │  │ Tauri / Rust  │
      │ TS (+Worker) │  │  │ (experimental)│
      └──────────────┘  │  └───────────────┘
                 TB4 (rede, JWT)
                ┌───────▼────────┐   TB5 ┌──────────────────┐
                │ Supabase:      │──────►│ Provedor LLM     │ (terceiro)
                │ RLS/RPC/RT/Edge│◄──────│ (resposta não    │
                └───────┬────────┘       │  confiável)      │
                        │ TB4'           └──────────────────┘
                ┌───────▼────────┐
                │ Outros usuários│ (Realtime: não confiáveis)
                └────────────────┘

┌──────────────┐ TB7 ┌───────────────┐ TB8 ┌─────────────────┐
│ Agente/LLM   │────►│ Host MCP      │────►│ Servidor MCP    │──► Engine TS (mesmo domínio)
│ externo      │     │ (Claude Code, │     │ stdio / HTTP    │
└──────────────┘     │ Codex, …)     │     └─────────────────┘
                     └───────────────┘
```

## 2. Fronteiras

| ID | Fronteira | Entra | Validação obrigatória | Pode executar? | Pode persistir? | Confirmação | Estado dos controles |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TB1 | Usuário → UI | Expressões, edições, instruções para IA | Parser, `validateCircuit`, limites | Sim, localmente, com budgets | IndexedDB local | Não (ação do próprio usuário) | `IMPLEMENTED` |
| TB2 | UI → engine | Documentos | Normalização + validação + preflight | Sim | — | — | `IMPLEMENTED` |
| TB3 | WebView → Rust (IPC) | `NativeSimulationRequest` | Revalidação Rust fail-closed | Sim, com budgets/cancelamento | Não | — | `EXPERIMENTAL`; CSP `null` (G-07) |
| TB4 | Cliente → Supabase | JWT, documentos, métricas | RLS, RPC `SECURITY INVOKER`, validação SQL | Não | Sim (projetos, versões) | Sync só por ação explícita | `IMPLEMENTED`; drift SQL (G-02); prova cross-user pendente |
| TB4' | Outros usuários → cliente (Realtime) | Snapshots, config e estado temporal | Guard de forma na recepção; `validateCircuit` na aplicação; frescor 30 s; `baseVersion` | Estado temporal só após aplicar | Só após aplicar | **Sim** — "Aplicar alteração remota" | `PARTIAL` (G-05; sem limites na recepção) |
| TB5 | Edge Function ↔ provedor LLM | Contexto do circuito (sai); JSON (entra) | Schema estrito na chamada; `isDocument` na volta; cliente revalida | Não | Não | **Sim** — "Aplicar otimização" | `PARTIAL` (G-03, G-08, G-12) |
| TB6 | Arquivos externos → app | `.veritas*`, DLS, `?expr=` | Parsers fail-closed, chaves fechadas, ≤5 MB, allowlist DLS | Nunca como código | Sim, transacional | Importação é ação explícita | `IMPLEMENTED` (K-01) |
| TB7 | Agente → host MCP | Chamadas de ferramenta | Política do host (allowlist, aprovação) | — | — | Depende do host | Fora do Veritas |
| TB8 | Host → servidor MCP | Argumentos | Zod + guards de domínio | Sim, no processo, com limites | **Não** (sem efeito colateral) | — | `IMPLEMENTED` (K-03, K-02) |
| TB8' | Rede → MCP HTTP | Requisições HTTP | Origin allowlist, bearer estático, headers, 1 MiB, 30 s | Idem | Não | — | `EXPERIMENTAL` |
| TB9 | Repositório → máquina do usuário (plugin) | `server.mjs` versionado | Nenhuma além de revisão de código | Sim (Node) | — | Instalação do plugin | Risco de cadeia de suprimento inerente ao modelo de plugin |

## 3. Classes de dado

| Classe | Exemplos | Confiança | Regra |
| --- | --- | --- | --- |
| Credenciais | JWT, chaves do provedor LLM, bearer MCP | Secreta | Nunca no domínio, no contexto de IA, em logs ou relatórios; chave LLM só no ambiente da Edge |
| Configuração pública | URL/publishable key Supabase | Pública | Segura só com RLS |
| Documento do usuário | Circuitos, testbenches, algoritmos | Privado; não confiável ao ser importado ou recebido | Validar sempre; sair da máquina só com ação explícita |
| Conteúdo textual livre | Nomes, rótulos, instrução para IA | Não confiável | Limitar tamanho; tratar como dado no prompt (G-12) |
| Saída de LLM | Resumo, sugestões, documento otimizado | Não confiável | Validar estrutura **e** comportamento antes de aplicar |
| Resultado determinístico | Tabelas, relatórios de verificação | Confiável **dentro da força declarada** | Não ampliar a força ao reapresentar |

## 4. Onde a IA não tem autoridade automática

| Ação | IA pode propor? | IA pode executar sozinha? | Justificativa |
| --- | --- | --- | --- |
| Calcular / verificar sobre dados fornecidos | — | **Sim** (L0) | Sem efeito colateral |
| Alterar o documento aberto | Sim | **Não** | AI-P1; NG-04 |
| Salvar no IndexedDB, exportar arquivo | Sim | **Não** | Persistência é do usuário |
| Sincronizar, compartilhar, convidar colaborador | Não recomendado | **Não** | Efeito externo, envolve terceiros |
| Aplicar estado remoto de colaboração | — | **Não** | Exige confirmação humana hoje |
| Declarar um resultado como verificado | — | **Não** | Só o verificador determinístico atribui força (NG-22) |
| Ampliar limites/budgets | — | **Não** | Limites são contrato, não preferência |
| Importar chips/arquivos de terceiros | Sim | **Não** | TB6 exige ação explícita |
| Acessar credenciais | — | **Nunca** | Classe secreta |

## 5. Riscos prioritários

| Prioridade | Risco | Referência |
| --- | --- | --- |
| P1 | Otimização por IA aplicável sem verificação comportamental | G-03 |
| P1 | HDL inválido apresentado como sucesso a agentes | K-02 |
| P1 | Limite de execução contornável no MCP | K-03 |
| P1 | Autenticação da Edge dependente de configuração não versionada | G-08 |
| P1 | Isolamento RLS/Realtime sem prova cross-user real | `docs/BETA-RLS-ACCEPTANCE.md` |
| P2 | CSP desativada no desktop | G-07 |
| P2 | Prompt injection por rótulos | G-12 |
| P2 | Bearer estático como única barreira se o MCP HTTP for exposto | I-02 |
| P2 | Hashes não criptográficos usados como identidade | G-09 |
