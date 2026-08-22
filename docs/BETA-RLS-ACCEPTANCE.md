# Procedimento de aceitação RLS-001 a RLS-022

**Produto:** Veritas  
**Versão candidata:** `v0.9.0-rc.7`
**Projeto Supabase:** `hcwzsxdcvmswebunznak`  
**Objetivo:** provar isolamento cross-user, autorização por papel, isolamento Realtime, conflito otimista e autenticação da Edge Function antes da promoção para beta.

## 1. Princípios de segurança

A matriz deve ser executada contra o projeto Supabase existente, usando sessões reais de usuários de teste e a publishable key. O teste não deve usar service role key para simular operações de usuário: a service role ignora RLS e produziria um falso positivo. SQL Editor e service role podem ser usados somente para preparar fixtures descartáveis, inspecionar policies e limpar dados depois da execução.

As policies do banco são a fonte de autorização. O fato de o cliente chamar `.eq('project_id', ...)`, ocultar botões para viewer ou validar um tópico não prova segurança. A confirmação exige que a mesma operação seja rejeitada quando executada com o JWT do usuário errado. O Supabase recomenda habilitar RLS em schemas expostos e usar policies PostgreSQL combinadas com Auth [1]. Para Realtime, Broadcast e Presence são autorizados por policies em `realtime.messages`; canais privados precisam usar `private: true` e o acesso público deve estar desabilitado [2].

## 2. Pré-requisitos

Antes da execução, confirme que as migrations abaixo estão aplicadas no projeto `hcwzsxdcvmswebunznak`:

| Área | Migration ou função |
|---|---|
| Contexto e projetos | `20260814181753_veritas_circuit_context_foundation.sql`, `20260814183500_veritas_circuit_projects.sql` |
| Histórico | `20260814190000_veritas_circuit_versions.sql`, `20260814191500_veritas_circuit_versions_insert_policy.sql` |
| Colaboração | `20260814202000_veritas_realtime_collaboration.sql` |
| Métricas | `20260814203500_veritas_ai_metrics.sql`, `20260814204500_veritas_ai_metrics_realtime_policy.sql` |
| Rooms e conflitos | `20260815000000_room_001_multi_room_conflict.sql`, `20260815001500_room_001_security_hardening.sql` |

Use quatro contas descartáveis para obter cobertura completa: `owner`, `other`, `editor` e `viewer`. Se não for possível criar quatro, use `owner` e `other` para a matriz de isolamento e duas contas adicionais para os cenários de papel. As contas não devem ser contas pessoais. Guarde os passwords em um gerenciador de segredos ou variáveis protegidas do ambiente; nunca os escreva no relatório.

Variáveis sugeridas para um runner autenticado são:

```bash
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_PUBLISHABLE_KEY="<publishable-key>"
export RLS_OWNER_EMAIL="..."
export RLS_OWNER_PASSWORD="..."
export RLS_OTHER_EMAIL="..."
export RLS_OTHER_PASSWORD="..."
export RLS_EDITOR_EMAIL="..."
export RLS_EDITOR_PASSWORD="..."
export RLS_VIEWER_EMAIL="..."
export RLS_VIEWER_PASSWORD="..."
export RLS_PROJECT_ID="<preenchido após fixture>"
export RLS_ROOM_ID="alpha"
```

A publishable key é aceitável no cliente conforme a arquitetura do Supabase, mas nenhuma service key ou chave de provedor pode aparecer no frontend, no log ou no relatório. O token recebido pelo login deve permanecer somente em memória no runner e ser descartado ao final.

## 3. Preparação da fixture

Crie a fixture com um nome único, por exemplo `beta-rls-20260815-<nonce>`. O owner deve criar um projeto pelo caminho autenticado normal, salvar um circuito mínimo e criar a room `alpha` pela RPC `veritas_create_circuit_room`. Em seguida, o owner deve convidar `editor` com role `editor` e `viewer` com role `viewer` pela RPC de colaboradores.

A fixture precisa conter, no mínimo, um projeto, uma versão, uma linha de contexto de IA, uma métrica de IA e as rooms `main` e `alpha`. Registre os IDs retornados, mas não publique tokens. A criação pode ser feita pela aplicação ou por um runner usando o cliente Supabase autenticado como owner. O SQL Editor não deve ser usado como evidência de autorização porque ele normalmente executa com privilégios administrativos.

Valide a preparação com o owner:

```ts
const { data: ownerProject } = await owner
  .from('veritas_circuit_projects')
  .select('id, user_id, name')
  .eq('name', fixtureName)
  .single()

const { error: roomError } = await owner.rpc('veritas_create_circuit_room', {
  p_project_id: ownerProject.id,
  p_room_id: 'alpha',
  p_kind: 'document',
})
```

Para a versão inicial, use o fluxo normal de sincronização do Veritas, pois ele calcula o hash, change summary e `p_base_version`. Não insira versões diretamente com service role e depois declare a política aprovada; a aceitação precisa validar o caminho que o produto utiliza.

## 4. Como registrar resultados

Crie um arquivo fora do diretório público, por exemplo `artifacts/rls-acceptance-20260815.md`. Cada cenário deve ter uma linha com o identificador e um resultado explícito, porque o `beta:preflight` pode verificar o relatório automaticamente:

```text
RLS-001 PASS — anon não recebeu linhas protegidas
RLS-002 PASS — owner leu somente a própria fixture
...
RLS-022 PASS — documento inválido não foi persistido
```

Para cada cenário, registre também usuário lógico, operação, tabela/tópico/RPC, resultado esperado, resultado observado, horário e evidência. Não registre `access_token`, password, headers completos ou payloads que contenham documento privado. Se um cenário falhar, use `FAIL`, interrompa a promoção e abra um incidente P0/P1 conforme a seção de severidade.

## 5. Execução dos cenários RLS-001 a RLS-022

A tabela abaixo é o roteiro executável. “Rejeitado” pode ser um erro de policy/RPC, uma resposta HTTP de autorização ou zero linhas/zero eventos, desde que o estado da fixture seja verificado depois.

| ID | Sessão | Procedimento | Resultado esperado |
|---|---|---|---|
| RLS-001 | anônimo | Use o cliente sem `signIn` e tente `select` em `veritas_circuit_projects`, `veritas_circuit_context`, `veritas_circuit_versions`, `veritas_circuit_rooms` e `veritas_ai_metrics`. | Erro ou zero linhas; nenhuma fixture aparece. |
| RLS-002 | owner | Consulte o projeto, contexto, versões, rooms e métricas criados pelo owner. | O owner lê suas próprias linhas. |
| RLS-003 | other | Com o UUID conhecido da fixture, repita os `select` do RLS-002. | Zero linhas para dados do owner e nenhum dado de outro projeto. |
| RLS-004 | other | Tente inserir contexto, métrica ou projeto declarando `user_id` igual ao owner. | Insert rejeitado por `with check`; nenhuma linha extra. |
| RLS-005 | other | Tente update e delete por UUIDs do projeto, contexto, métrica e versões do owner. | Zero linhas afetadas ou erro; compare hashes e contagens antes/depois. |
| RLS-006 | owner | Chame `veritas_add_circuit_collaborator` para editor e viewer; tente role fora de `editor`/`viewer` como controle negativo. | Convites válidos funcionam; role inválido falha. |
| RLS-007 | editor/other | Chame add/remove de colaborador em nome de um usuário que não é owner. | RPC falha com erro de owner; relações permanecem iguais. |
| RLS-008 | editor | Consulte projeto, colaboradores, rooms e versões do projeto compartilhado. | Leitura autorizada somente nesse projeto. |
| RLS-009 | viewer | Tente update do projeto, insert direto de versão e `veritas_sync_circuit_project`. | Todas as escritas são rejeitadas; `updated_at`, hash e max version não mudam. |
| RLS-010 | editor | Leia a versão atual, faça uma alteração válida e sincronize com `p_base_version` correto. | RPC cria uma versão com `user_id = auth.uid()` do editor. |
| RLS-011 | owner/editor | Faça ambos lerem a mesma versão; salve primeiro com base correta e depois tente salvar o segundo com a base antiga. | Segundo RPC falha com `CIRCUIT_CONFLICT current=N`; nenhum snapshot é perdido. |
| RLS-012 | editor | Conecte em `veritas:project:{id}:room:ghost` e tente Presence e `circuit_snapshot`. | Room não permitida não recebe nem publica eventos. |
| RLS-013 | membro de A | Use o UUID de projeto B e uma room válida de B no tópico. | Join, Presence e Broadcast são negados; nenhum evento de B chega ao cliente. |
| RLS-014 | editor/viewer | Conecte em `main` e `alpha` autorizados, publique Presence e observe `presenceState`. | Presence funciona somente no projeto/room autorizados. |
| RLS-015 | viewer | Envie `broadcast` com `event = circuit_snapshot` para a room autorizada. | Publicação é negada; editor não recebe alteração do viewer. |
| RLS-016 | editor | Envie `circuit_snapshot` válido pela room `main` e pela `alpha`. | Broadcast é permitido apenas para o editor/owner em rooms válidas. |
| RLS-017 | autenticado | Envie evento Broadcast diferente de `circuit_snapshot` no document room. | Evento é rejeitado pelo contrato ROOM-001; Presence não é afetado. |
| RLS-018 | other | Tente assinar `veritas:ai-metrics:{ownerId}` e publicar/receber métricas do owner. | Nenhuma métrica ou evento do owner é visível. |
| RLS-019 | sem JWT | Faça POST para `veritas-circuit-ai` sem bearer token e com token expirado. | HTTP `401`/não autorizado; não há processamento privilegiado. |
| RLS-020 | owner/editor | Faça POST autenticado com contexto pequeno e válido; repita com instrução opcional. | Resposta estável de análise/fallback; métrica, quando emitida, pertence ao usuário autenticado. |
| RLS-021 | autenticado | Envie `user_id`, `project_id` ou contexto de outro usuário no body tentando elevar acesso. | Campos não concedem autorização; função rejeita ou ignora a tentativa. |
| RLS-022 | editor | Envie pela sync um documento com ciclo, referência inexistente ou width inválido. | A RPC rejeita com `22023`/`Invalid circuit document` antes da persistência; projeto, hash e histórico permanecem consistentes. |

## 6. Verificações específicas de Realtime

Para cada cliente, use o tópico completo `veritas:project:{projectId}:room:{roomId}` e configure o canal como privado. Registre o status de subscribe, o tópico, o papel lógico, o resultado de `track`, o resultado de `send` e os eventos recebidos durante uma janela curta de observação. Faça os testes com duas sessões abertas simultaneamente: o cliente autorizado deve receber o evento esperado; o cliente de outro projeto ou de outra room deve permanecer silencioso.

A autorização do Realtime ocorre quando o cliente entra no tópico. Portanto, teste novamente depois de alterar o papel de colaborador e depois de remover o colaborador; uma conexão antiga não deve ser considerada prova de autorização futura. Refaça o join com o JWT atualizado e confirme o resultado.

## 7. Verificações do RPC de conflito e histórico

Capture `version_number` antes do teste RLS-011. Faça o primeiro salvamento com `p_base_version = N`; depois tente o segundo salvamento com `p_base_version = N`. O resultado esperado é uma nova versão `N+1` para o primeiro e erro explícito para o segundo. Consulte o histórico como owner/editor e confirme que ambas as versões esperadas permanecem disponíveis, sem update/delete de versões anteriores.

Se a aplicação produzir `CIRCUIT_CONFLICT current=N`, o runner deve guardar apenas o código/mensagem sanitizada. Não inclua o documento completo no relatório. A resolução do conflito é uma ação explícita do usuário, nunca um merge silencioso feito pelo teste.

## 8. Verificações da Edge Function

Use o endpoint implantado com um cliente HTTP controlado. Para RLS-019, envie requisição sem bearer e token expirado. Para RLS-020, use o access token recém-obtido do owner/editor e um body pequeno. Para RLS-021, inclua campos de outro usuário somente como tentativa de abuso; não envie documentos reais.

Confirme status HTTP, shape da resposta, ausência de segredos nos logs e associação correta de métricas. Uma falha de telemetria deve deixar a análise principal funcionando, mas qualquer bypass de JWT bloqueia beta como P0.

## 9. Limpeza e critérios de aprovação

Depois de exportar o relatório, remova a fixture pelo caminho autorizado ou execute limpeza administrativa controlada no projeto, preservando somente os artefatos de evidência sem dados privados. Confirme que não ficaram usuários de teste, rooms, projetos ou métricas órfãos.

A matriz passa somente se RLS-001 a RLS-022 tiverem `PASS` explícito, nenhum dado cruzar usuários/projetos, viewer não escrever, rooms não vazarem eventos, a Edge Function rejeitar chamadas sem JWT, o RPC preservar o histórico e o documento inválido não for persistido. Qualquer violação de isolamento ou autenticação é P0 e impede a tag beta.

Para executar o preflight com o relatório:

```bash
BETA_EXPECTED_VERSION=0.9.0-rc.7 \
SMOKE_URL=https://veritas-opal-seven.vercel.app \
BETA_PREFLIGHT_REQUIRE_SMOKE=1 \
BETA_PREFLIGHT_REQUIRE_RLS=1 \
BETA_RLS_REPORT=artifacts/rls-acceptance-20260815.md \
npm run beta:preflight
```

O runner versionado pode executar a matriz com o fluxo abaixo, sempre usando somente a publishable key e credenciais de quatro contas descartáveis em variáveis de ambiente:

```bash
RLS_RUNNER_ALLOW_REAL=1 \
RLS_REQUIRE_REALTIME=1 \
RLS_REQUIRE_EDGE=1 \
RLS_EDGE_FUNCTION_URL="https://<project-ref>.supabase.co/functions/v1/veritas-circuit-ai" \
RLS_REPORT_PATH=artifacts/rls-acceptance-$(date +%Y%m%d-%H%M%S).md \
npm run beta:rls
```

O runner cria uma fixture com prefixo único, executa RLS-001 a RLS-022, tenta limpar a fixture no `finally` e grava somente IDs lógicos, status, operações e mensagens truncadas/sanitizadas. Ele nunca imprime passwords, access tokens ou headers. Sem `RLS_RUNNER_ALLOW_REAL=1`, ele aborta antes de ler qualquer credencial; sem Realtime/Edge habilitados, os casos ficam `SKIP` e não podem ser usados para liberar beta.

A RPC `veritas_sync_circuit_project` também executa `private.veritas_validate_circuit_document` no servidor antes de inserir ou atualizar qualquer projeto. A função verifica formato `veritas-circuit`, versão 1, nome, nós/tipos/posições, portas, nós referenciados, entradas obrigatórias, larguras, conexões duplicadas e ciclos combinacionais; feedback que passa por `clock`, `dff`, `tff` ou `delay` continua permitido. Isso reduz o risco de um cliente adulterado persistir um documento que o editor local rejeitaria, mas não substitui os testes cross-user.

O preflight verifica os gates locais, o smoke público e a presença de `PASS` para todos os IDs. Ele não cria sessões Supabase automaticamente e não substitui a execução humana/controlada da matriz. O relatório gerado pelo runner deve ser revisado e anexado ao manifesto beta somente depois de confirmar a limpeza da fixture e os resultados reais.

## Referências

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Docs — Row Level Security"

[2]: https://supabase.com/docs/guides/realtime/authorization "Supabase Docs — Realtime Authorization"

[3]: ../supabase/migrations/20260815000000_room_001_multi_room_conflict.sql "Veritas — ROOM-001 multi-room e conflito"

[4]: ../supabase/migrations/20260815001500_room_001_security_hardening.sql "Veritas — hardening de segurança ROOM-001"
