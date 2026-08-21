# Runbook de rollback — Veritas

**Objetivo:** recuperar um deployment ou release problemática sem apagar histórico, mover tags imutáveis, reescrever migrations ou perder circuitos locais/remotos.

> Este runbook descreve uma operação de recuperação. O ensaio automatizado usa somente verificações de refs, arquivos e testes locais; ele não executa `vercel rollback`, não despublica release, não faz `git push --force` e não altera o Supabase.

## 1. Quando interromper a promoção

Interrompa imediatamente a promoção e classifique como **P0** qualquer vazamento cross-user, bypass de JWT, perda irrecuperável de circuito, alteração indevida de dados de outro usuário, migration irreversível sem caminho de recuperação ou deployment sem uma versão conhecida para restaurar. Classifique como **P1** uma quebra relevante do fluxo principal, exportação HDL inválida, contrato MCP quebrado, colaboração inutilizável, app offline indisponível, acessibilidade impeditiva ou tutorial impossível.

Não crie uma nova tag para “testar” a recuperação. Preserve a tag problemática e o commit correspondente para investigação. Uma correção posterior deve receber uma nova tag SemVer.

## 2. Preparação e captura de evidência

Registre o horário UTC, a URL afetada, a tag e o SHA do commit, o sintoma observado, o último deployment conhecido como saudável, o responsável pela decisão e o impacto estimado. Salve os logs públicos do smoke sem incluir tokens, cookies, UUIDs privados ou payloads de usuários.

```bash
git status --short
git show --no-patch --decorate v0.9.0-rc.1
git rev-list -n 1 v0.9.0-rc.1
git rev-parse v0.8.0-rc.1
```

As tags são imutáveis para fins operacionais: **não mova tags publicadas** e **não apague releases** para esconder o incidente. Não execute `git tag -f`, `git push --force` ou `git update-ref` em tag publicada.

## 3. Recuperação do deployment

Use o painel do provedor de deployment para promover novamente o deployment anterior conhecido como saudável. Se a plataforma oferecer um comando de rollback, confirme visualmente o projeto, a URL e o deployment alvo antes de executar. A ação manual de produção fica fora do runner automático porque requer autorização operacional e pode alterar tráfego real.

Quando a recuperação for concluída, execute:

```bash
SMOKE_URL=https://veritas-opal-seven.vercel.app npm run smoke:release
```

O smoke deve confirmar homepage, manifesto PWA e service worker. Em seguida, abra o app em uma janela anônima e verifique que a página carrega sem autenticação.

## 4. Verificação local-first e histórico

Abra um circuito local já existente, recarregue a página e confirme que IndexedDB continua acessível sem variáveis Supabase. Não limpe o armazenamento do navegador como parte do rollback. Se houver uma exportação `.veritas-circuits.json`, preserve-a como cópia adicional antes de qualquer teste destrutivo autorizado.

Para recuperação remota, use somente uma sessão autenticada do proprietário ou membro autorizado. Liste as versões, abra uma versão anterior como prévia e sincronize uma nova versão; não sobrescreva a versão histórica nem remova versões anteriores. Se a RPC retornar `CIRCUIT_CONFLICT`, pare e trate o conflito, sem repetir a escrita cegamente.

## 5. Critérios de saída

O rollback só pode ser encerrado quando a URL restaurada responde ao smoke, um circuito local abre e mantém dados, uma versão remota autorizada pode ser lida, os eventos de colaboração não vazam para outro projeto e não existem alterações forçadas em tags/migrations. Registre a versão problemática, a versão restaurada, horário, resultado de cada verificação e o plano de correção.

| Verificação | Evidência mínima | Falha |
|---|---|---|
| Ref/tag | Tag problemática e tag saudável resolvem para SHAs distintos e estáveis. | P0 se houver reescrita ou ausência de referência. |
| Deployment | Smoke público aprovado após a promoção do deployment saudável. | P1; P0 se não houver caminho de recuperação. |
| IndexedDB | Circuito local abre após reload sem Supabase configurado. | P0 se houver perda irrecuperável. |
| Histórico | Versão autorizada abre e nova versão não remove versões anteriores. | P0 se houver perda; P1 se restauração não for executável. |
| Supabase/Realtime | RLS e tópico continuam isolados após a recuperação. | P0 em qualquer vazamento. |
| Registro | Horário, versões, sintomas, decisão e correção futura documentados. | P1 se não houver rastreabilidade operacional. |

## 6. Ensaio automatizado

O comando abaixo não modifica tags, releases, deployment, Supabase ou IndexedDB. Ele valida as invariantes do workflow, a existência de uma tag atual e de uma release anterior, o conteúdo deste runbook e os testes de recuperação local/histórico.

```bash
ROLLBACK_CURRENT_TAG=v0.9.0-rc.1 \
ROLLBACK_REPORT_PATH=artifacts/rollback-acceptance.md \
npm run beta:rollback
```

O relatório só deve ser anexado ao manifesto beta quando RB-001 a RB-005 estiverem em `PASS`. Um `SKIP`, `PENDING` ou `FAIL` mantém `ROLLBACK-EVIDENCE-INCOMPLETE` e bloqueia a promoção.

## 7. Referências

[1]: ../docs/RELEASE-GATES.md "Veritas — gates de release"

[2]: ../docs/RELEASE-PLAN.md "Veritas — plano de lançamento"

[3]: https://vercel.com/docs/deployments/rollback-a-previous-deployment "Vercel — rollback de deployment anterior"

[4]: https://semver.org/ "Semantic Versioning 2.0.0"
