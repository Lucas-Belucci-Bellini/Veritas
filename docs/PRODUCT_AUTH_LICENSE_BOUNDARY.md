# VERITAS — Fronteira de Conta, Licença e Entitlement

**Status:** arquitetura planejada; não representa um sistema comercial implementado.

**Escopo:** Veritas e, como diretriz reutilizável, Baluarte, Vanguard e futuros produtos do mesmo portfólio. Cada repositório deve confirmar separadamente o que realmente existe.

## 1. Decisão

Os produtos comerciais do portfólio deverão separar uma **demo/teste gratuita** de uma **versão final paga**. A demo permite avaliar um escopo publicado. A versão final é a edição completa e oficial do produto e exige uma licença/entitlement válido. Como regra de distribuição, a edição final não será disponibilizada gratuitamente.

O login identifica a sessão e permite consultar o direito de uso. Ele não concede autoridade ao cliente para inventar uma licença, não autoriza upload automático de projetos e não transforma a nuvem em requisito para a simulação local.

No Veritas, o `AuthProvider` com Supabase já existe como infraestrutura técnica opcional de autenticação e sincronização. Isso não é uma licença comercial, não é ownership Steam e não confirma a existência de cobrança. O documento comercial completo está em [`COMMERCIAL_MODEL_STEAM.md`](./COMMERCIAL_MODEL_STEAM.md).

## 2. Boundaries obrigatórios

A autoridade comercial deverá ficar fora do domínio lógico:

```text
AccountProvider
    ↓
LicenseProvider / EntitlementProvider
    ↓
CapabilityResolver
    ↓
Application boundary
    ↓
Local project, DLC ou serviço cloud
    ↓
Simulator / CircuitDocument sem chamadas de pagamento
```

O `Simulator`, o `CircuitDocument`, o compilador de netlist e os verificadores não devem depender diretamente de Steamworks, Supabase Auth, Stripe, Steam Wallet ou qualquer outro provedor. Eles recebem apenas capabilities e configurações já validadas pela camada de aplicação.

| Camada | Responsabilidade | Não pode fazer |
| --- | --- | --- |
| `AccountProvider` | Login, logout, recuperação de sessão e tratamento de conta | Desbloquear recursos apenas por estado mutável do cliente |
| `LicenseProvider` | Verificar licença da edição final e sua validade | Confiar em preço, pagamento ou entitlement fornecido pelo usuário |
| `EntitlementProvider` | Resolver demo, edição, DLC e plano de serviço | Executar conteúdo remoto sem validação |
| `CapabilityResolver` | Converter direitos verificados em capacidades explícitas | Espalhar regra comercial pelo domínio |
| Storage local | Salvar, reabrir, exportar e recuperar dados do dispositivo | Apagar projetos quando login ou cloud falhar |
| Cloud adapter | Upload/download explícito, quota, histórico e colaboração | Receber projetos sem consentimento ou ser autoridade do circuito |

## 3. Estados de produto

| Estado | Login | Licença | Uso esperado |
| --- | --- | --- | --- |
| Desenvolvimento local | Provedor falso controlado ou configuração local | Grant de desenvolvimento não distribuível | Testes automatizados e QA interno |
| Demo/teste | Obrigatório na distribuição comercial planejada | Entitlement de demo limitado | Avaliar recursos dentro do escopo e limites publicados |
| Versão final | Obrigatório | Entitlement/licença de produto válido | Usar o produto completo adquirido |
| DLC | Herdado da edição e validado separadamente | Entitlement do módulo | Habilitar somente o módulo correspondente |
| Cloud | Obrigatório | Plano/entitlement do serviço | Sincronizar ou processar somente após ação explícita |
| Offline | Sessão/licença cacheada | Grant assinado e não expirado | Continuar dentro do grace period publicado |

A aplicação deve explicar ao usuário a diferença entre conta, compra da edição final, DLC e assinatura/uso de cloud. Um serviço cloud expirado não invalida automaticamente o arquivo local. Uma licença final ausente deve bloquear a operação comercial correspondente de modo recuperável, sem apagar o projeto.

## 4. Offline e recuperação

A primeira ativação comercial pode exigir rede para autenticar e consultar o entitlement, conforme as regras da plataforma. Depois disso, o cliente poderá usar um grant assinado e limitado para continuar offline durante um **grace period** documentado. O período, a renovação, a revogação e o comportamento após expiração precisam ser definidos antes da venda.

O grace period não deve virar uma licença eterna nem uma exigência de conexão a cada frame. O cliente não deve armazenar senha ou dados de pagamento desnecessários. Se a conta estiver indisponível, o produto deve apresentar um estado honesto, permitir exportar/recuperar dados locais e oferecer o caminho de reautenticação; não deve converter uma falha de rede em corrupção de projeto.

## 5. Privacidade e cloud

Login não é consentimento para armazenar circuitos. O upload deve ser uma ação explícita ou estar coberto por um consentimento específico e revogável. Antes do primeiro envio, o produto deve informar o que será armazenado, por quanto tempo, em qual região quando aplicável, quais quotas existem e como exportar ou excluir os dados.

A autoridade do servidor deve ser limitada a conta, entitlement, quota, versões e operações de serviço. A semântica do circuito continua sendo validada localmente e, quando houver processamento remoto, também no backend com schema, limites, hash, versão e logs minimizados. Nenhum projeto deve ser usado para treinamento, vendido ou exposto a terceiros sem base legal, consentimento e política publicada.

## 6. Steam e provedores

A edição final, os DLCs e os serviços podem usar provedores diferentes, mas todos devem implementar o mesmo contrato abstrato. Exemplos de adaptadores futuros:

```text
SteamEntitlementProvider
WebAccountEntitlementProvider
LocalDevelopmentProvider
OfflineGraceProvider
```

O cliente pode abrir a Store ou solicitar uma operação, mas a concessão final deve vir de uma resposta verificável do provedor/ backend autorizado. Pagamentos, refunds, chargebacks e reconciliação não podem ser decididos apenas por flags locais ou por dados enviados pelo cliente.

## 7. Gates antes de venda

Nenhum produto deverá ser anunciado como edição final paga até possuir:

1. escopo e limites da demo publicados;
2. conta, recuperação e logout testados;
3. licença/entitlement verificável no servidor ou provedor oficial;
4. proteção contra replay, troca de conta e manipulação do cliente;
5. grace period offline e comportamento de expiração documentados;
6. save/reopen/export local testado com login, rede e cloud indisponíveis;
7. fallback recuperável para DLC ausente ou licença inválida;
8. política de privacidade, retenção, exclusão e suporte aprovada;
9. fluxo de refund/revogação e recuperação de compra testado;
10. QA de Windows, macOS e Linux proporcional à promessa;
11. critérios legais, fiscais e de distribuição revisados antes do lançamento;
12. rollback de cliente, licenças, DLCs e backend ensaiado.

Até que esses gates sejam cumpridos, o estado do Veritas é **PLANNED / NOT IMPLEMENTED** para demo comercial, edição final paga, licenciamento, ownership Steam e cobrança. A autenticação técnica existente deve continuar sendo descrita como prévia, sem prometer produto comercial pronto.

## 8. Aplicação a outros produtos

Baluarte, Vanguard e futuros projetos podem reutilizar esta arquitetura, mas nenhum estado deve ser inferido a partir do Veritas. Cada repositório precisa registrar seu próprio provedor de conta, modelo de licença, matriz de capabilities, regras offline, armazenamento local, serviços cloud, critérios de preço e evidência de QA.

O objetivo comercial é legítimo: transformar software próprio em receita recorrente ou venda de licenças sem depender de publicidade intrusiva e sem explorar os dados dos usuários. A sustentabilidade financeira deve vir de valor real — edição completa, módulos adicionais e infraestrutura escolhida — com comunicação clara e recuperação dos dados do cliente.

## Referências internas

- [`COMMERCIAL_MODEL_STEAM.md`](./COMMERCIAL_MODEL_STEAM.md) — política de demo, edição final paga, DLCs e serviços cloud.
- [`ROADMAP.md`](./ROADMAP.md) — sequência técnica do Veritas até v5.0.0.
- [`VERITAS_MASTER_BUILD_QUEUE.md`](./VERITAS_MASTER_BUILD_QUEUE.md) — fila operacional de fases e gates.
- [`VERITAS_25K_SCALABLE_ARCHITECTURE.md`](./VERITAS_25K_SCALABLE_ARCHITECTURE.md) — separação entre runtime, escala e fronteira comercial.
- [`tests/desktop/QA_MATRIX.md`](../tests/desktop/QA_MATRIX.md) — classificação de evidências por plataforma.

