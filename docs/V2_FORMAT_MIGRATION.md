# Contrato de formatos e migrações — v2.8

## Estado do documento

Este documento inicia o inventário de formatos da fase **v2.8.0 — compatibilidade e migrações**. Ele não cria uma release, não altera a versão do aplicativo e não autoriza compatibilidade retroativa que ainda não tenha parser, fixture e teste. A regra principal permanece local-first/offline-first: importar um arquivo inválido não deve apagar, substituir ou completar silenciosamente dados locais.

> **Política:** uma versão desconhecida deve ser rejeitada; uma versão antiga só pode ser aceita por um migrador explícito, determinístico e testado; uma versão atual deve passar pelo parser e pela validação semântica antes de entrar no armazenamento.

## Inventário atual

| Área | Implementação atual | Versão observada | Estado de compatibilidade |
|---|---|---:|---|
| Projetos de expressão | IndexedDB `projects`, com `name`, `expression`, `notation` e timestamps | Banco Dexie v5; envelope de arquivo `veritas` v1 | Exportação/importação v1 existe, mas o parser ainda precisa do mesmo endurecimento aplicado aos circuitos |
| Circuitos visuais | IndexedDB `circuitProjects`, com `CircuitDocument` validado e normalizado | Envelope de arquivo `veritas-circuits` v1; documento `veritas-circuit` v1 | Parser v1 exige versão inteira atual, rejeita versão antiga sem migrador, rejeita versão futura e não filtra projeto inválido silenciosamente |
| Chips customizados | IndexedDB `customChipProjects`, definição derivada de circuito local | Banco Dexie v5 | Não há envelope de arquivo independente fechado no inventário atual; exportação/migração explícita permanece pendente |
| Testbenches | IndexedDB `testbenchProjects`, associado a `circuitId` | Banco Dexie v5 | Não há envelope de arquivo independente fechado no inventário atual; associação por id precisa de política de importação |
| Algoritmos | IndexedDB `algorithmProjects`, com documento de fluxograma | Banco Dexie v5 | Não há envelope de arquivo independente fechado no inventário atual |
| Banco local | Cinco versões incrementais Dexie criaram stores de projetos, circuitos, algoritmos, chips e testbenches | Dexie v5 | A evolução estrutural existe; transformações semânticas de dados e rollback de migração ainda precisam ser catalogados |
| Request Worker/Tauri | Payload escalar bounded para execução, separado de persistência | Protocolo 1 | Não é formato de projeto; não deve ser usado como arquivo de usuário |
| Checkpoint | Contrato `SimulationWorkerCheckpointV1` isolado | Checkpoint 1 | Parser/serializer e assinatura existem, mas resume entre requests ainda não está habilitado |

## Gate já concluído para circuitos

`parseCircuitFile()` mantém o envelope `format: "veritas-circuits"` e `version: 1`, valida que a versão é inteira e positiva, rejeita versão futura e rejeita uma versão anterior enquanto não houver migrador registrado. Cada item de `projects` é validado individualmente; uma coleção com projeto inválido não é reduzida silenciosamente a uma coleção parcial. O documento resultante ainda passa pela validação estrutural, pelos tipos de componente permitidos, pelas referências de conexão, pelos limites de width e pela validação semântica do circuito.

Esse gate é uma **melhoria de segurança de importação**, não uma migração de versão. O fato de a versão atual aceitar um campo opcional `exportedAt` ausente em fixtures antigas não deve ser interpretado como autorização para aceitar qualquer shape legado. Campos, tipos e limites suportados devem continuar sendo determinados pelo contrato e pelos testes, não por correção heurística durante o carregamento.

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
| Falha durante importação | Manter o banco inalterado por operação transacional ou por staging descartável |

## Próximos incrementos v2.8

O próximo gate deve endurecer o envelope `veritas` de projetos de expressão com a mesma disciplina de versão inteira, projeto inválido e não filtragem silenciosa. Depois, cada formato que ganhar exportação deverá receber uma fixture atual, uma fixture de JSON quebrado, uma fixture de versão futura, uma fixture de versão antiga e uma fixture de shape semântico inválido. A migração de IndexedDB deve ser documentada separadamente da migração de arquivos, pois abrir uma versão de banco e importar um arquivo são operações com riscos e rollback diferentes.

A associação entre circuito, chip customizado e testbench deve usar referências declaradas e validar dependências antes da escrita. Um arquivo de circuito não deve carregar uma definição de chip arbitrária por caminho, URL ou script; quando a dependência não estiver no envelope permitido, a importação deve parar e explicar o que falta. O checkpoint nativo continuará isolado até existir uma política de identidade, linhagem, budget e restore transacional.

## Critérios de aceitação

A fase só poderá avançar quando todos os formatos efetivamente exportáveis estiverem inventariados, cada parser tiver um comportamento explícito para versão atual, futura, antiga e inválida, e as migrações aprovadas tiverem round-trip determinístico. O gate deve ser executado em web, PWA e Tauri com as mesmas fixtures sempre que o formato for compartilhado. A atualização não pode apagar projetos locais; desinstalação e reabertura precisam ter evidência independente; e falhas devem permanecer visíveis como `FAILED` ou `NOT VERIFIED`, nunca como sucesso implícito.

Enquanto esses critérios não forem atendidos, a classificação correta é **v2.8 em desenvolvimento / Unreleased**. Nenhum resultado deste documento promove suporte a projetos de 5k/25k chips, sincronização cloud, Steam, login comercial ou integração do engine Rust ao editor canônico.
