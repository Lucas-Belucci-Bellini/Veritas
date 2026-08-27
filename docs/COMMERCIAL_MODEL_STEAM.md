# VERITAS — Modelo Comercial para Steam, DLCs e Serviços de Nuvem

**Status:** política de produto planejada; não representa integração Steam, venda ou serviço de nuvem já disponível.

**Data:** 2026-08-27

**Objetivo:** definir como o Veritas poderá ser distribuído como um Digital Logic Simulator próprio na Steam sem destruir o princípio local-first, sem transformar o núcleo educacional em uma barreira de pagamento e sem prometer armazenamento de código gratuito em infraestrutura que tem custo operacional.

## 1. Decisão de produto

O Veritas será planejado como um produto **free-to-play com núcleo local gratuito**, complementado por módulos avançados pagos e serviços online opcionais pagos. A versão básica deve ser útil por si só: o usuário poderá criar, editar, simular e salvar localmente circuitos digitais sem precisar criar conta, contratar nuvem ou manter conexão permanente.

A Steam documenta que jogos free-to-play podem oferecer conteúdo adicional por DLC ou por compras dentro do jogo, e que DLC pode ser conteúdo distribuído ou apenas uma licença/entitlement [1]. A decisão do Veritas é utilizar essa flexibilidade de modo simples e compreensível:

```text
Veritas Base — gratuito
├── Editor e simulador local
├── Circuitos combinacionais e sequenciais básicos
├── Testbench local
├── Save/reopen local
├── Import/export local permitido
├── PWA/web offline quando compatível
└── Sem conta obrigatória e sem nuvem obrigatória

DLCs/expansões — pagos, opcionais
├── Módulos profissionais de HDL e co-simulação
├── Pacotes avançados de componentes e instrumentos
├── Workspace grande e ferramentas de escala
├── Automação/verification avançada local
├── Conteúdo educacional e cenários extras
└── Recursos que adicionam capacidade local real

Serviços online — pagos, opcionais
├── Backup e armazenamento criptografado na nuvem
├── Sincronização entre dispositivos
├── Histórico remoto e recuperação ampliada
├── Colaboração hospedada
├── Workspaces de equipe
└── Serviços de compute/verification remoto quando existirem
```

Essa política é um **plano de monetização**, não uma autorização para bloquear funcionalidades locais atuais nem uma confirmação de que a Steamworks ou um backend de cobrança já estejam implementados.

## 2. O que fica gratuito

O núcleo gratuito deve ser suficientemente completo para que o Veritas continue sendo um Digital Logic Simulator legítimo mesmo sem DLC e sem conexão. O usuário não deve pagar para acessar a lógica básica, para abrir um arquivo local ou para continuar usando seus próprios projetos offline.

| Capacidade | Base gratuita |
| --- | --- |
| Criar e editar circuitos básicos | Sim |
| Simular combinacional e sequencial básico localmente | Sim |
| Clocks, waveform e testbench básico local | Sim |
| Salvar e reabrir no dispositivo | Sim |
| Importar e exportar formatos locais suportados | Sim, sujeito aos limites e validação |
| Usar o modo offline | Sim |
| Abrir projetos próprios já baixados | Sim |
| Usar o editor sem conta | Sim, quando o ambiente oferecer a aplicação local |
| Verificar circuitos pequenos e médios localmente | Sim |
| Receber correções e atualizações de segurança | Sim |
| Acessar o projeto sem publicidade obrigatória | Sim |

O armazenamento local não é uma concessão temporária. Ele é parte da identidade do produto. Os dados do projeto devem continuar sob controle do usuário e devem possuir exportação compreensível, mesmo quando o usuário nunca comprar uma expansão.

O núcleo gratuito não deve ser artificialmente degradado para induzir a compra. O princípio é cobrar por **capacidade adicional, conteúdo adicional ou serviço de infraestrutura**, não por remover uma barreira criada de propósito.

## 3. O que pode ser DLC ou expansão paga

DLC deve conter uma unidade clara de valor. A Steam trata DLC como conteúdo adicional que pode ser gratuito ou pago e recomenda que o jogo verifique a propriedade do conteúdo [2]. No Veritas, cada DLC deve ter descrição própria, identificador estável, compatibilidade declarada e comportamento seguro quando ausente.

| DLC planejado | Tipo de valor | Pode funcionar offline? |
| --- | --- | --- |
| Veritas HDL Studio | Editor, lint, conversão e fluxos avançados de HDL | Sim, para recursos locais; integração externa pode exigir configuração própria |
| Veritas Hardware Lab | Instrumentos, probes, analisadores, displays e componentes profissionais | Sim |
| Veritas Scale Lab | Compiler/IR compacto, viewport grande, profiling e benchmarks | Sim, quando instalado localmente |
| Veritas Verification Pro | Suites de verification, contraexemplos, regressão e relatórios avançados | Sim, para execução local |
| Veritas Education Packs | Tutoriais, projetos, desafios e roteiros didáticos | Sim |
| Veritas Collaboration Tools | Ferramentas de colaboração local/exportável e preparação de workspaces | Sim, mas colaboração hospedada é serviço separado |
| Veritas HDL Backends | Pacotes ou adaptadores para Yosys/Verilator quando legal e tecnicamente distribuíveis | Depende do backend; sempre opt-in e isolado |

Um DLC não deve ser usado para cobrar pela correção de bugs do núcleo, por segurança, por abrir projetos locais ou por evitar uma perda causada pelo próprio produto. Correções, compatibilidade e integridade do formato são responsabilidade da aplicação base.

A existência de um DLC no roadmap não significa que ele será lançado. Cada módulo precisa ter implementação, testes, documentação, compatibilidade com os formatos, verificação de ownership, política de atualização e critérios de saída próprios.

## 4. Serviços de nuvem pagos

A nuvem possui custo real de armazenamento, transferência, banco de dados, backups, monitoramento, segurança, suporte e processamento. Por isso, **guardar códigos, circuitos e projetos na nuvem não será uma obrigação gratuita e ilimitada**. O usuário poderá continuar salvando localmente sem custo de serviço.

Os serviços de nuvem devem ser opcionais e separados do núcleo local:

| Serviço | Política planejada |
| --- | --- |
| Backup criptografado | Plano pago ou franquia explicitamente limitada; nunca apagar o arquivo local se o serviço estiver indisponível |
| Sync entre dispositivos | Serviço pago, com limites transparentes de projetos, tamanho, frequência e histórico |
| Histórico remoto | Serviço pago, com retenção declarada e exportação do histórico |
| Colaboração hospedada | Serviço pago por capacidade/uso, com papéis e auditoria |
| Compute remoto | Serviço pago por uso ou pacote, sempre com budget, cancelamento e relatório |
| Workspace de equipe | Serviço pago ou plano profissional, com controle de membros e permissões |
| Recovery ampliado | Serviço pago opcional, mas o usuário deve manter exportação local básica |

Nenhum serviço deve sugerir que o código do usuário será usado para treinar modelos, vendido ou exposto a outros usuários. O comportamento padrão deve ser minimização de dados, criptografia em trânsito e em repouso quando a nuvem for utilizada, controle de acesso e exclusão/exportação iniciada pelo usuário conforme a política publicada.

O produto deve dizer claramente o que é armazenado, por quanto tempo, em qual região quando aplicável, qual é o limite do plano, como baixar os dados e o que acontece após cancelamento. Não será permitido esconder o limite de armazenamento em uma mensagem vaga como “nuvem premium”.

## 5. Princípios de justiça comercial

O modelo comercial deve ser entendível antes da compra. O usuário precisa saber se está comprando um módulo local permanente, uma licença de conteúdo ou um serviço recorrente. A aplicação deve indicar quando uma funcionalidade depende de conta, conexão, entitlement Steam ou serviço ativo.

Regras:

1. A funcionalidade básica continua utilizável offline.
2. Projetos locais continuam abrindo sem autenticação externa.
3. Exportação e importação locais não dependem de assinatura.
4. O usuário não perde o arquivo local por expiração de nuvem.
5. Um DLC pago não deve quebrar a abertura de um projeto que usa apenas recursos base.
6. Se um projeto usa um DLC ausente, o Veritas deve oferecer diagnóstico e recuperação, não apagar componentes silenciosamente.
7. A cobrança não pode substituir correções de segurança ou compatibilidade.
8. Não haverá publicidade intrusiva dentro do editor.
9. Não haverá paywall para continuar usando a simulação básica.
10. Limites de nuvem, retenção e custo devem ser exibidos antes da operação.

A documentação da Steam recomenda pensar em valor para o cliente e alerta contra barreiras artificiais e modelos que cobrem para eliminar frustração [3]. Essa orientação é compatível com o posicionamento do Veritas: os pagamentos devem financiar conteúdo adicional e infraestrutura escolhida, não punir o uso local.

## 6. Steam: DLC, free-to-play e ownership

A distribuição alvo é a Steam, mas a integração Steamworks ainda é um trabalho futuro. A Steam documenta que DLC possui app ID próprio, pode ser armazenado em depot próprio ou incluído com o jogo base, e que o aplicativo deve verificar a propriedade do DLC antes de habilitar o conteúdo [2].

A arquitetura futura deve ter um `EntitlementProvider` abstrato:

```text
EntitlementProvider
├── LocalDevelopmentProvider
├── SteamProvider
├── WebAccountProvider
└── OfflineGraceProvider
```

O `SteamProvider` não deve contaminar o domínio do simulador. Ele apenas responde a perguntas como:

```text
has_entitlement("veritas-hdl-studio")
has_entitlement("veritas-scale-lab")
service_status("cloud-sync")
```

O domínio continua validando se o projeto pode ser aberto, editado e simulado. A ausência de entitlement deve bloquear somente o módulo correspondente. Um projeto base não deve depender da presença do Steam client para avaliar uma porta AND.

A verificação de entitlement deve ocorrer:

- no carregamento do aplicativo;
- antes de habilitar uma DLC;
- após atualização do conteúdo;
- ao abrir um projeto que referencia um módulo pago;
- em modo offline, usando uma política de grace period documentada e limitada;
- ao detectar alteração de versão ou estado de licença.

Ownership local não é autorização para confiar em código arbitrário. O conteúdo de DLC ainda precisa ser validado por schema, hash, versão e allowlist. A aplicação nunca deve executar um arquivo baixado só porque ele veio de um depot autorizado.

## 7. Nuvem, conta e sincronização

A nuvem deve ser um adaptador de serviço, não uma dependência do `CircuitDocument` ou do `Simulator`.

```text
Local Project
  ├── Structural document
  ├── Local testbenches
  ├── Local runtime snapshots
  └── Exportable package

Optional Cloud Adapter
  ├── Account/authentication
  ├── Entitlement and plan
  ├── Encrypted upload/download
  ├── Version/conflict control
  ├── Quota and metering
  ├── Retention/recovery
  └── Delete/export contract
```

A sincronização deve usar versões de documento, checksums e resolução explícita de conflito. Nunca se deve sobrescrever silenciosamente um projeto local só porque uma cópia remota é mais nova. O usuário precisa conseguir escolher, comparar ou recuperar versões.

O serviço não deve receber snapshots temporais a cada frame. O cliente envia alterações estruturais, chunks, checkpoints escolhidos ou pacotes versionados, sempre com limites. Logs devem evitar conteúdo sensível por padrão e separar métricas operacionais de dados do projeto.

Quando o usuário cancelar o serviço:

1. a aplicação informa a data de retenção, se houver;
2. oferece exportação dos projetos e histórico permitido;
3. interrompe novos uploads;
4. mantém o modo local intacto;
5. remove ou anonimiza dados segundo a política publicada;
6. registra o resultado sem bloquear o arquivo local.

## 8. Segurança, pagamentos e fraude

Nenhuma cobrança deve ser implementada dentro do Veritas sem uma fronteira segura de entitlement. A aplicação cliente pode solicitar uma compra ou abrir a página oficial, mas não deve ser a autoridade final para concessão de serviços cloud ou itens de valor.

A documentação da Steam informa que compras dentro do jogo devem usar a API de microtransações/Steam Wallet e que um backend próprio deve reconciliar transações e considerar fraude/chargebacks [4]. Portanto, a ordem futura é:

```text
Steam purchase / store
        ↓
Steam entitlement or transaction state
        ↓
Verified backend reconciliation
        ↓
Signed entitlement record
        ↓
Client capability gate
        ↓
Local module/service access
```

Antes de qualquer integração real, serão necessários:

- conta de publisher e configuração Steamworks;
- backend mínimo para reconciliação, se microtransações forem usadas;
- armazenamento de entitlements sem guardar dados de pagamento desnecessários;
- assinatura/verificação de respostas;
- proteção contra replay e troca de conta;
- tratamento de refunds, chargebacks e expiração;
- rate limits e auditoria;
- testes em ambiente de desenvolvimento da Steam;
- política de suporte e recuperação de compras;
- documentação de privacidade e retenção;
- revisão de requisitos legais e fiscais aplicáveis antes do lançamento.

Não será criado um sistema de moeda virtual para o Veritas. O produto vende software adicional e serviços identificáveis, não uma economia especulativa. A precificação ainda não está definida e não deve ser inventada no código ou no roadmap técnico.

## 9. Compatibilidade local e cross-platform

DLCs locais devem declarar os sistemas suportados. A meta de distribuição do Veritas continua sendo Windows, macOS e Linux, com `Veritas-Setup.exe` no Windows. Um DLC não pode ser considerado pronto apenas porque instala no ambiente de desenvolvimento.

| Camada | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Núcleo gratuito | Build, runtime e smoke reais | Build, runtime e smoke reais | Build, runtime e smoke reais |
| DLC local | Asset, entitlement, loading e execução | Asset, entitlement, loading e execução | Asset, entitlement, loading e execução |
| Serviço cloud | Login, sync, conflito, offline e recovery | Login, sync, conflito, offline e recovery | Login, sync, conflito, offline e recovery |
| Steam overlay/ownership | Verificação nativa | Verificação nativa | Verificação nativa |
| Atualização/rollback | Testado | Testado | Testado |

Até que essas provas existam, a documentação deve usar `BUILD VERIFIED`, `ARTIFACT VERIFIED`, `RUNTIME VERIFIED`, `SMOKE VERIFIED` e `NOT VERIFIED` separadamente.

## 10. Relação com o roadmap técnico

O modelo comercial não muda a ordem de segurança do roadmap. A infraestrutura de pagamento e nuvem só entra depois de o núcleo ser confiável.

| Marco | Relação com o modelo comercial |
| --- | --- |
| v2.6.0 | Verification local e relatórios confiáveis; nenhuma cobrança necessária |
| v2.7.0 | Budgets e segurança para evitar que serviços locais ou remotos congelem a aplicação |
| v2.8.0 | Formato versionado, exportação, migração e recovery antes de oferecer sync |
| v2.9.0 | Inventário de APIs e boundaries entre núcleo, DLC, cloud e Steam |
| v3.0.0 | Core modular capaz de carregar módulos sem contaminar o simulador base |
| v3.1–v3.2 | Capabilities e plugins seguros para módulos adicionais |
| v3.3–v3.8 | Workspace profissional, escala, HDL e possíveis DLCs locais |
| v4.x | Packages, reprodutibilidade, serviços opt-in, entitlements e distribuição assinada |
| v5.0.0 | Plataforma madura, Steam-ready, multiplataforma, com política comercial comprovada |

A monetização não deve acelerar a promoção de releases. Uma versão só pode ser anunciada como estável quando os critérios técnicos, de QA, segurança e distribuição estiverem cumpridos, independentemente de haver um DLC planejado.

## 11. Mensagem pública planejada

Texto que poderá ser usado futuramente na descrição do produto, depois de validação comercial e aprovação da Steam:

> **Veritas é um Digital Logic Simulator local-first.** A versão base é gratuita e permite criar, simular, testar e salvar circuitos localmente. Expansões opcionais adicionam ferramentas profissionais, conteúdos educacionais, HDL e recursos avançados. Serviços de nuvem, como backup, sincronização e colaboração hospedada, são opcionais e podem exigir um plano pago para cobrir armazenamento, segurança e operação. Seus projetos locais não dependem da nuvem para continuar funcionando.

Esse texto não deve ser publicado na Steam antes de a integração comercial, a política de privacidade, a forma de cobrança e os limites dos serviços estarem aprovados e implementados.

## 12. Critérios para considerar o modelo implementado

O modelo comercial só estará implementado quando houver:

1. definição formal do conteúdo gratuito e de cada DLC;
2. módulos desacoplados por capability e versão;
3. entitlements verificáveis e fail-closed;
4. modo offline local funcional sem conta;
5. exportação e recuperação dos projetos locais;
6. serviço cloud separado e com quotas transparentes;
7. autenticação, autorização e exclusão documentadas;
8. reconciliação segura de compras e refunds quando aplicável;
9. testes sem rede e com Steam indisponível;
10. testes Windows/macOS/Linux;
11. documentação de preços, limites, privacidade e suporte;
12. store pages e processo de revisão da Steam concluídos;
13. verificação de `Veritas-Setup.exe`, DMG/app bundle e Linux packages;
14. nenhuma regressão P0/P1 no núcleo gratuito;
15. plano de rollback para cliente, DLC e backend.

Até lá, o estado correto é **PLANNED / NOT IMPLEMENTED**.

## 13. Referências

[1]: https://partner.steamgames.com/doc/store/freetoplay "Steamworks — Free To Play Games"
[2]: https://partner.steamgames.com/doc/store/application/dlc "Steamworks — Downloadable Content (DLC)"
[3]: https://partner.steamgames.com/doc/features/microtransactions "Steamworks — Microtransactions and best practices"
[4]: https://partner.steamgames.com/doc/features/microtransactions/implementation "Steamworks — Microtransactions Implementation Guide"
[5]: https://partner.steamgames.com/doc/store/pricing "Steamworks — Pricing"
[6]: ./VERITAS_25K_SCALABLE_ARCHITECTURE.md "Veritas — Arquitetura escalável até 25 mil chips"
[7]: ./VERITAS_MASTER_BUILD_QUEUE.md "Veritas — Fila mestre até v5.0.0"
