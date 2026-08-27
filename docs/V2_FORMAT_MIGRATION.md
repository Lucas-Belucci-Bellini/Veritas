# Contrato de formatos e migrações — v2.8

## Estado do documento

Este documento inicia o inventário de formatos da fase **v2.8.0 — compatibilidade e migrações**. Ele não cria uma release, não altera a versão do aplicativo e não autoriza compatibilidade retroativa que ainda não tenha parser, fixture e teste. A regra principal permanece local-first/offline-first: importar um arquivo inválido não deve apagar, substituir ou completar silenciosamente dados locais.

> **Política:** uma versão desconhecida deve ser rejeitada; uma versão antiga só pode ser aceita por um migrador explícito, determinístico e testado; uma versão atual deve passar pelo parser e pela validação semântica antes de entrar no armazenamento.

## Inventário atual

| Área | Implementação atual | Versão observada | Estado de compatibilidade |
|---|---|---:|---|
| Projetos de expressão | IndexedDB `projects`, com `name`, `expression`, `notation` e timestamps | Banco Dexie v5; envelope de arquivo `veritas` v1 | Parser v1 rejeita versão não inteira/antiga/futura, campos desconhecidos, coleção com projeto inválido, expressão não analisável e arquivo acima de 5.000.000 bytes; migração retroativa ainda pendente |
| Circuitos visuais | IndexedDB `circuitProjects`, com `CircuitDocument` validado e normalizado | Envelope de arquivo `veritas-circuits` v1; documento `veritas-circuit` v1 | Parser v1 exige versão inteira atual, rejeita versão antiga sem migrador, versão futura, campos desconhecidos, projeto inválido e arquivo acima de 5.000.000 bytes |
| Chips customizados | IndexedDB `customChipProjects`, definição derivada de circuito local | Banco Dexie v5; definição interna `veritas-custom-chip` v1; envelope experimental `veritas-chip-library` v1 | Parser/serializer e importação atômica com refs file-local estão implementados e testados; a UI de biblioteca ainda não expõe o fluxo |
| Testbenches | IndexedDB `testbenchProjects`, associado a `circuitId` | Banco Dexie v5; envelope de arquivo `veritas-testbenches` v1 | Parser v1 rejeita versão não inteira/antiga/futura, campos desconhecidos, documentos inválidos e arquivo acima de 5.000.000 bytes; importação é transacional e a rota de UI confere existência/nome do circuito de destino |
| Algoritmos | IndexedDB `algorithmProjects`, com documento de fluxograma | Banco Dexie v5; documento `veritas-algorithm` v1 | O store valida erros semânticos na criação/atualização; ainda não há envelope de coleção/parser de arquivo, e versões antigas/shape fechado não têm gate de importação |
| Banco local | Cinco versões incrementais Dexie criaram stores de projetos, circuitos, algoritmos, chips e testbenches | Dexie v5 | A evolução estrutural existe; transformações semânticas de dados e rollback de migração ainda precisam ser catalogados |
| Request Worker/Tauri | Payload escalar bounded para execução, separado de persistência | Protocolo 1 | Não é formato de projeto; não deve ser usado como arquivo de usuário |
| Checkpoint | Contrato `SimulationWorkerCheckpointV1` isolado | Checkpoint 1 | Parser/serializer e assinatura existem, mas resume entre requests ainda não está habilitado |

## Gate já concluído para circuitos

`parseCircuitFile()` mantém o envelope `format: "veritas-circuits"` e `version: 1`, valida que a versão é inteira e positiva, rejeita versão futura e rejeita uma versão anterior enquanto não houver migrador registrado. Cada item de `projects` é validado individualmente; uma coleção com projeto inválido não é reduzida silenciosamente a uma coleção parcial. O documento resultante ainda passa pela validação estrutural, pelos tipos de componente permitidos, pelas referências de conexão, pelos limites de width e pela validação semântica do circuito.

Esse gate é uma **melhoria de segurança de importação**, não uma migração de versão. O mesmo comportamento foi aplicado ao envelope `.veritas` de expressões: versões não inteiras, antigas ou futuras são rejeitadas, uma coleção com entrada inválida não é reduzida silenciosamente e cada expressão é validada pelo parser canônico antes da importação. O fato de a versão atual aceitar um campo opcional `exportedAt` ausente em fixtures antigas não deve ser interpretado como autorização para aceitar qualquer shape legado. Campos, tipos e limites suportados devem continuar sendo determinados pelo contrato e pelos testes, não por correção heurística durante o carregamento.

## Limites deliberados para chips e algoritmos

Chips customizados e algoritmos não serão tratados como arquivos genéricos apenas porque seus documentos internos já carregam uma string `format` e uma versão. No caso de chips, `veritas-custom-chip` v1 descreve uma definição local validada e o envelope experimental `veritas-chip-library` v1 transporta uma coleção com refs file-local remapeáveis; o pipeline DLS continua sendo uma entrada externa separada. Instâncias de `custom-chip` devem continuar resolvendo apenas definições locais validadas, sem caminhos, URLs, scripts ou execução arbitrária.

No caso de algoritmos, `veritas-algorithm` v1 descreve um fluxograma e possui validador semântico; o storage agora bloqueia criação/atualização quando há erros, mas ainda guarda o documento diretamente no store Dexie e não oferece parser/serializer de coleção. Para chips, o envelope experimental já possui limites, schema fechado, refs declaradas e importação transacional, mas a exposição pela UI continua pendente. A classificação correta é `PASSED` para o contrato/API portátil de chips e `NOT VERIFIED` para exportação/importação de algoritmos e para o fluxo de produto da biblioteca de chips.

| Formato | O que já existe | O que não deve ser alegado |
|---|---|---|
| `veritas-custom-chip` v1 / `veritas-chip-library` v1 | Definição local validada, envelope de coleção experimental, refs file-local, ordenação de dependências e importação Dexie atômica | Não é ainda um fluxo exposto na UI; não há importação genérica de scripts/HDL/URLs |
| `veritas-algorithm` v1 | Documento versionado, validador de nós/targets/variáveis e executor local | Não é ainda um envelope de coleção, não há migrador legado e não há execução de código importado |

## Política de migração planejada

Cada formato persistente deverá possuir um envelope com identificador estável, versão inteira, metadados mínimos e payload. O parser deve separar quatro decisões: reconhecer o envelope, decidir se a versão é suportada, migrar para a representação canônica quando houver migrador e validar o resultado antes de gravar. A migração não deve chamar código importado, avaliar expressões arbitrárias, acessar a rede ou alterar o banco até que toda a entrada tenha sido validada.

| Caso | Comportamento obrigatório |
|---|---|
| JSON inválido | Rejeitar sem alterar o banco e devolver erro acionável |
| Formato desconhecido | Rejeitar; não tentar inferência por extensão ou por campos parecidos |
| Versão futura | Rejeitar e preservar o arquivo original para atualização posterior |
| Versão antiga com migrador | Migrar sobre uma cópia, validar o resultado, registrar a versão de origem e só então permitir importação |
| Versão antiga sem migrador | Rejeitar explicitamente como incompatível; não descartar campos nem importar parcialmente |
| Projeto inválido dentro da coleção | Rejeitar a coleção inteira ou usar uma operação de pré-visualização explícita; nunca filtrar silenciosamente |
| Referência entre documentos | Resolver por identidade declarada e confirmar colisões; não reutilizar ids locais por acaso |
| Falha durante importação | Manter o banco inalterado por operação transacional ou por staging descartável | Implementado para projetos, circuitos, testbenches e biblioteca portátil de chips via transação Dexie; falhas de parsing ocorrem antes da escrita. Migrações entre versões e dependências de múltiplos stores ainda pendentes |

## Próximos incrementos v2.8

A disciplina estrutural inicial dos envelopes `veritas`, `veritas-circuits`, `veritas-testbenches` e `veritas-chip-library` está implementada no escopo de chaves permitidas, tipos básicos, limite de 5.000.000 bytes e validação semântica de expressões, com rejeição de campos desconhecidos e sem filtragem silenciosa. As escritas dos lotes de projetos, circuitos, testbenches e chips usam transação Dexie; a importação de testbenches ainda precisa de uma fixture de falha entre linhas, enquanto a biblioteca de chips já cobre rollback após falha de definição. O próximo gate deve definir migradores explícitos para versões antigas ou confirmar a rejeição documentada de cada versão legada, além de decidir quando a API portátil de chips poderá ser exposta na UI. Depois, cada formato que ganhar exportação deverá receber uma fixture atual, uma fixture de JSON quebrado, uma fixture de versão futura, uma fixture de versão antiga e uma fixture de shape semântico inválido; o testbench já possui cobertura inicial dessas categorias e precisa apenas ampliar a prova transacional e a política de associação ao circuito. A migração de IndexedDB deve ser documentada separadamente da migração de arquivos, pois abrir uma versão de banco e importar um arquivo são operações com riscos e rollback diferentes.

A associação entre circuito, chip customizado e testbench deve usar referências declaradas e validar dependências antes da escrita. O envelope de biblioteca de chips já remapeia referências de arquivo para ids locais dentro de uma transação e rejeita colisões de nomes; a exposição do fluxo na UI ainda deve passar por um gate separado. A importação de testbench pelo hook da UI passa o nome do circuito selecionado; o backend confere que o `circuitId` ainda existe e que o nome não mudou, tudo dentro da transação Dexie. Um arquivo de circuito não deve carregar uma definição de chip arbitrária por caminho, URL ou script; quando a dependência não estiver no envelope permitido, a importação deve parar e explicar o que falta. O checkpoint nativo continuará isolado até existir uma política de identidade, linhagem, budget e restore transacional.

## Critérios de aceitação

A fase só poderá avançar quando todos os formatos efetivamente exportáveis estiverem inventariados, cada parser tiver um comportamento explícito para versão atual, futura, antiga e inválida, e as migrações aprovadas tiverem round-trip determinístico. O gate deve ser executado em web, PWA e Tauri com as mesmas fixtures sempre que o formato for compartilhado. A atualização não pode apagar projetos locais; desinstalação e reabertura precisam ter evidência independente; e falhas devem permanecer visíveis como `FAILED` ou `NOT VERIFIED`, nunca como sucesso implícito.

Enquanto esses critérios não forem atendidos, a classificação correta é **v2.8 em desenvolvimento / Unreleased**. Nenhum resultado deste documento promove suporte a projetos de 5k/25k chips, sincronização cloud, Steam, login comercial ou integração do engine Rust ao editor canônico.
