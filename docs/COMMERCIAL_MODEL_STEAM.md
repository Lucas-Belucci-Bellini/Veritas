# VERITAS — Modelo Comercial para Steam, DLCs e Serviços de Nuvem

**Status:** política de produto planejada; o código possui infraestrutura técnica de autenticação Supabase opcional, mas demo comercial, edição final paga, licenciamento, entitlements Steam e cobrança ainda não estão implementados.

**Data:** 2026-08-27

**Objetivo:** definir como o Veritas poderá ser distribuído como um Digital Logic Simulator próprio na Steam em duas etapas — demo/teste gratuita e edição final paga — com login, licença e entitlements verificáveis, sem perder local-first, privacy-first e recuperação dos projetos do usuário.

## 0. Diretriz transversal da família de produtos

Esta política nasceu no Veritas, mas a intenção comercial do proprietário é aplicá-la também a **Baluarte, Vanguard e outros produtos futuros**: cada produto poderá oferecer uma demo/teste gratuita para avaliação e reservar a versão final completa para uma compra/licença paga. Login, sessão, licença e entitlements devem ser projetados desde o início como fronteiras de produto, sem espalhar a autoridade comercial pelo domínio funcional.

Esta seção é uma diretriz entre projetos, não uma afirmação de que Baluarte, Vanguard ou qualquer outro produto já possua login, pagamentos, licenças, página de loja ou backend comercial implementados. Cada repositório deverá registrar seu próprio estado, escopo da demo, edição final, política de dados, critérios de QA e integração de distribuição. Os boundaries reutilizáveis de conta, licença e entitlement estão especificados em [`PRODUCT_AUTH_LICENSE_BOUNDARY.md`](./PRODUCT_AUTH_LICENSE_BOUNDARY.md).

## 1. Decisão de produto

O Veritas será planejado como um produto comercial em duas edições: uma **demo/teste gratuita**, para avaliação controlada, e uma **versão final paga**, que será a edição completa e oficial do produto. Ambas terão sistema de login planejado para identificar sessão, versão e direitos de uso; a versão final exigirá licença/entitlement válido. A nuvem continuará sendo uma camada separada e opcional: login/licença não significam upload automático dos projetos nem conexão permanente durante a simulação local.

A Steam documenta modelos de DLC e a necessidade de verificar a propriedade do conteúdo antes de habilitá-lo [1]. A decisão do Veritas é separar claramente avaliação gratuita, produto final pago, expansões e serviços, sem apresentar uma demo como se fosse a edição final:

```text
Veritas Demo/Teste — gratuita, com login
├── Fluxo de avaliação claramente limitado e documentado
├── Editor e simulador local dentro do escopo da demo
├── Exemplos, testbench e projetos de demonstração
├── Salvamento local e exportação conforme os limites publicados
├── Sem cobrança durante o período/escopo de teste
└── Sem upload automático para a nuvem

Veritas Final — paga, com login e licença
├── Produto completo do marco comercial correspondente
├── Editor, simulador, verification e formatos contratados
├── Save/reopen local dos projetos autorizados
├── Import/export local conforme compatibilidade
├── Uso offline conforme licença cacheada e grace period publicado
└── Nenhuma nuvem obrigatória para a simulação local

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

Essa política é um **plano comercial**, não uma autorização para fingir que a demo ou a edição final já existem, nem uma confirmação de que Steamworks, licenciamento, cobrança ou backend de entitlements estejam implementados.

## 2. Demo gratuita e limites de avaliação

A demo gratuita existe para que o usuário possa avaliar o produto antes de comprar a edição final. Ela deve ser funcional dentro de um escopo explicitamente publicado, com limites compreensíveis de recursos, tamanho, exemplos, exportação, duração ou módulos. Esses limites não podem ser escondidos nem usados para simular defeitos; devem aparecer antes do uso e antes da compra.

A edição final não será gratuita como regra de produto. Ela será uma versão comercial paga, com login e verificação de licença/entitlement. O login serve para a sessão e para o direito de uso; não autoriza a aplicação a enviar projetos para a nuvem sem consentimento.

| Capacidade | Demo gratuita | Edição final paga |
| --- | --- | --- |
| Criar e editar circuitos | Sim, dentro do escopo publicado | Sim, conforme o contrato da edição |
| Simular combinacional e sequencial | Sim, dentro do escopo publicado | Sim, conforme o contrato da edição |
| Clocks, waveform e testbench | Escopo de demonstração | Recursos contratados |
| Salvar e reabrir localmente | Sim, com limites publicados | Sim, sem depender de cloud |
| Importar e exportar formatos | Somente os formatos liberados | Formatos suportados pela licença |
| Login | Planejado/necessário para a sessão demo | Planejado/necessário para licença e sessão |
| Uso offline | Após sessão válida, conforme grace period | Após licença cacheada, conforme grace period |
| Abrir projetos próprios baixados | Sim quando compatível com a demo | Sim quando compatível com a licença |
| Verificar circuitos localmente | Escopo de demonstração | Escopo contratado |
| Correções de segurança | Sim | Sim |
| Publicidade intrusiva | Não | Não |

O armazenamento local não é uma concessão temporária. Ele é parte da identidade do produto. Os dados do projeto devem continuar sob controle do usuário, ter formato documentado e possuir exportação compreensível. A demo pode produzir projetos de avaliação; a edição final paga deve abrir os projetos compatíveis sem exigir contratação de cloud.

A demo pode ter limitações comerciais, mas elas devem ser honestas e visíveis. A cobrança da edição final deve representar acesso ao produto completo e suporte/compatibilidade do marco contratado, não uma barreira artificial criada para punir o uso básico durante uma licença válida.

## 3. Versão final paga, DLCs e expansões

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

A edição final paga deve incluir as correções, a segurança e a compatibilidade prometidas para o seu marco. Um DLC não deve ser usado para cobrar pela correção de bugs do núcleo, por abrir um projeto compatível da edição licenciada ou por evitar uma perda causada pelo próprio produto. Correções, compatibilidade e integridade do formato são responsabilidade da aplicação base.

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

Nenhum serviço deve sugerir que o código do usuário será usado para treinar modelos, vendido ou exposto a outros usuários. O login da demo ou da edição final não é consentimento para nuvem. O comportamento padrão deve ser minimização de dados, criptografia em trânsito e em repouso quando a nuvem for utilizada, controle de acesso e exclusão/exportação iniciada pelo usuário conforme a política publicada.

O produto deve dizer claramente o que é armazenado, por quanto tempo, em qual região quando aplicável, qual é o limite do plano, como baixar os dados e o que acontece após cancelamento. Não será permitido esconder o limite de armazenamento em uma mensagem vaga como “nuvem premium”.

## 5. Princípios de justiça comercial

O modelo comercial deve ser entendível antes da compra. O usuário precisa saber se está comprando um módulo local permanente, uma licença de conteúdo ou um serviço recorrente. A aplicação deve indicar quando uma funcionalidade depende de conta, conexão, entitlement Steam ou serviço ativo.

Regras:

1. A demo gratuita deve ter escopo, limites e duração claramente informados.
2. A edição final será paga e terá login/licença/entitlement verificáveis.
3. Depois de uma sessão válida, o modo local deve continuar utilizável segundo a política de grace period publicada.
4. Projetos locais compatíveis não podem depender de uma contratação de cloud.
5. Exportação e importação locais não podem ser removidas apenas para forçar assinatura de nuvem.
6. O usuário não perde o arquivo local por expiração de licença cloud ou indisponibilidade temporária do serviço.
7. Um DLC pago não deve quebrar a abertura de um projeto que usa apenas recursos autorizados da edição final.
8. Se um projeto usa um DLC ausente ou uma licença final ausente, o Veritas deve oferecer diagnóstico e recuperação, não apagar componentes silenciosamente.
9. A cobrança não pode substituir correções de segurança ou compatibilidade prometidas.
10. Não haverá publicidade intrusiva dentro do editor.
11. Limites de demo, licença, nuvem, retenção e custo devem ser exibidos antes da operação.

A documentação da Steam recomenda pensar em valor para o cliente e alerta contra barreiras artificiais e modelos que cobrem para eliminar frustração [3]. Essa orientação é compatível com o posicionamento do Veritas: os pagamentos devem financiar conteúdo adicional e infraestrutura escolhida, não punir o uso local.

## 6. Steam: demo, edição final paga, DLC e ownership

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

O domínio continua validando se o projeto pode ser aberto, editado e simulado. A ausência de entitlement deve bloquear somente a edição, o DLC ou o serviço correspondente, conforme o contrato publicado, e deve gerar uma mensagem recuperável. Um projeto autorizado não deve depender da presença permanente do Steam client para avaliar uma porta AND durante o grace period offline.

A verificação de entitlement deve ocorrer:

- no carregamento do aplicativo;
- antes de habilitar uma DLC;
- após atualização do conteúdo;
- ao abrir um projeto que referencia um módulo pago;
- em modo offline, usando uma política de grace period documentada e limitada;
- ao detectar alteração de versão ou estado de licença.

Ownership local não é autorização para confiar em código arbitrário. O conteúdo de DLC ainda precisa ser validado por schema, hash, versão e allowlist. A aplicação nunca deve executar um arquivo baixado só porque ele veio de um depot autorizado.

## 7. Nuvem, conta e sincronização

A nuvem deve ser um adaptador de serviço, não uma dependência do `CircuitDocument` ou do `Simulator`. O sistema de login/licença também deve ficar atrás de uma fronteira de aplicação, sem espalhar chamadas de provedor no domínio de simulação.

```text
Product Account / License Adapter
  ├── Authentication
  ├── Demo session or paid entitlement
  ├── Offline grace policy
  └── Recovery / sign-out behavior

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

Nenhuma cobrança ou desbloqueio da edição final deve ser implementado dentro do Veritas sem uma fronteira segura de entitlement. A aplicação cliente pode solicitar login, compra ou abrir a página oficial, mas não deve ser a autoridade final para conceder a edição final, DLCs ou serviços cloud.

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
| Demo gratuita | Build, login, runtime e smoke reais | Build, login, runtime e smoke reais | Build, login, runtime e smoke reais |
| Edição final paga | Build, login/licença, runtime e smoke reais | Build, login/licença, runtime e smoke reais | Build, login/licença, runtime e smoke reais |
| DLC local | Asset, entitlement, loading e execução | Asset, entitlement, loading e execução | Asset, entitlement, loading e execução |
| Serviço cloud | Login, sync, conflito, offline e recovery | Login, sync, conflito, offline e recovery | Login, sync, conflito, offline e recovery |
| Steam overlay/ownership | Verificação nativa | Verificação nativa | Verificação nativa |
| Atualização/rollback | Testado | Testado | Testado |

Até que essas provas existam, a documentação deve usar `BUILD VERIFIED`, `ARTIFACT VERIFIED`, `RUNTIME VERIFIED`, `SMOKE VERIFIED` e `NOT VERIFIED` separadamente.

## 10. Relação com o roadmap técnico

O modelo comercial não muda a ordem de segurança do roadmap. A autenticação/licença deve ser isolada da simulação, a demo deve ser honesta e a edição final só pode ser vendida depois que o núcleo e a recuperação local forem confiáveis. A infraestrutura de pagamento e nuvem só entra depois dos boundaries e dos gates técnicos.

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
| v5.0.0 | Plataforma madura, Steam-ready, multiplataforma, com demo gratuita, edição final paga e política comercial comprovada |

A monetização não deve acelerar a promoção de releases. Uma versão só pode ser anunciada como estável quando os critérios técnicos, de QA, segurança e distribuição estiverem cumpridos, independentemente de haver um DLC planejado.

## 11. Mensagem pública planejada

Texto que poderá ser usado futuramente na descrição do produto, depois de validação comercial e aprovação da Steam:

> **Veritas é um Digital Logic Simulator local-first.** Uma demo gratuita permite avaliar o produto dentro de um escopo claramente informado. A edição final é paga, exige login/licença para validar o direito de uso e entrega o conjunto completo do marco comercial adquirido. Expansões opcionais adicionam ferramentas profissionais, conteúdos educacionais, HDL e recursos avançados. Serviços de nuvem, como backup, sincronização e colaboração hospedada, são opcionais e podem exigir um plano pago. Projetos locais compatíveis não dependem de uma contratação de nuvem para continuar funcionando dentro das regras da licença.

Esse texto não deve ser publicado na Steam antes de a integração comercial, a política de privacidade, a forma de cobrança e os limites dos serviços estarem aprovados e implementados.

## 12. Critérios para considerar o modelo implementado

O modelo comercial só estará implementado quando houver:

1. definição formal do escopo da demo gratuita, da edição final paga e de cada DLC;
2. módulos desacoplados por capability e versão;
3. login, licença e entitlements verificáveis e fail-closed;
4. política de sessão, cache e grace period offline testada;
5. exportação e recuperação dos projetos locais, sem dependência de cloud;
6. serviço cloud separado e com quotas transparentes;
7. autenticação, autorização e exclusão documentadas;
8. reconciliação segura de compras e refunds quando aplicável;
9. testes sem rede e com Steam indisponível;
10. testes Windows/macOS/Linux;
11. documentação de preços, limites, privacidade e suporte;
12. store pages e processo de revisão da Steam concluídos;
13. verificação de `Veritas-Setup.exe`, DMG/app bundle e Linux packages;
14. nenhuma regressão P0/P1 na demo, na edição final ou nos componentes compartilhados;
15. plano de rollback para cliente, DLC e backend.

Até lá, o estado correto é **PLANNED / NOT IMPLEMENTED**. A existência do `AuthProvider` técnico não equivale a uma licença comercial, integração Steam ou produto final pago publicado.

## 13. Referências

[1]: https://partner.steamgames.com/doc/store/freetoplay "Steamworks — Free To Play Games"
[2]: https://partner.steamgames.com/doc/store/application/dlc "Steamworks — Downloadable Content (DLC)"
[3]: https://partner.steamgames.com/doc/features/microtransactions "Steamworks — Microtransactions and best practices"
[4]: https://partner.steamgames.com/doc/features/microtransactions/implementation "Steamworks — Microtransactions Implementation Guide"
[5]: https://partner.steamgames.com/doc/store/pricing "Steamworks — Pricing"
[6]: ./VERITAS_25K_SCALABLE_ARCHITECTURE.md "Veritas — Arquitetura escalável até 25 mil chips"
[7]: ./VERITAS_MASTER_BUILD_QUEUE.md "Veritas — Fila mestre até v5.0.0"
