# Autenticação, sincronização e IA

## Configuração local

Copie `.env.example` para `.env.local` e preencha apenas as variáveis públicas do projeto Supabase:

```bash
cp .env.example .env.local
```

O frontend usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. A chave publishable pode ser exposta no bundle; **service keys nunca devem ser colocadas em variáveis `VITE_*`**. A autorização efetiva é feita pela sessão JWT e pelas políticas RLS do Supabase.

## Autenticação

O `AuthProvider` restaura a sessão persistida, acompanha `onAuthStateChange`, permite cadastro por e-mail, login por senha e logout. A confirmação de e-mail é controlada pela configuração de Auth do projeto Supabase. O painel aparece no cabeçalho apenas quando as variáveis públicas estão configuradas; sem elas, o Veritas continua funcionando localmente.

## Sincronização

O IndexedDB continua sendo a fonte local-first. Usuários autenticados podem usar **Sincronizar nuvem** no editor. O cliente envia somente o documento versionado `veritas-circuit`, seu nome e o hash determinístico do contexto. A tabela `public.veritas_circuit_projects` aceita somente registros do próprio `auth.uid()`, revoga acesso anônimo e possui índice único por usuário e hash.

A sincronização é um upsert idempotente: circuitos com o mesmo conteúdo não são duplicados para o mesmo usuário. A abertura e exclusão dos projetos remotos ocorrem no próprio editor. Não existe upload automático de circuitos locais sem uma ação explícita do usuário.

## Análise e otimização por IA

O editor envia `buildCircuitContext(document)` para a Edge Function autenticada `veritas-circuit-ai`. O JWT é obrigatório (`verify_jwt: true`). A função valida o contexto e limita o tamanho do payload antes de processar.

Quando `AI_PROVIDER_URL`, `AI_PROVIDER_KEY` e opcionalmente `AI_MODEL` estão configurados como secrets da Edge Function, ela chama o provedor LLM com saída JSON estruturada. O contexto não é enviado diretamente do navegador para uma API de modelo. Quando o provedor não está configurado ou falha, a função usa uma heurística conservadora que remove apenas componentes inalcançáveis a partir das saídas.

A aplicação nunca aplica uma otimização automaticamente. O resultado aparece com resumo, sugestões, provedor e confiança; o usuário precisa clicar em **Aplicar otimização**. Depois disso, o resultado é local e deve ser sincronizado novamente de forma explícita.

## Migrações e deploy

A migração local correspondente está em `supabase/migrations/20260814183500_veritas_circuit_projects.sql`. A Edge Function versionada está em `supabase/functions/veritas-circuit-ai/index.ts`. O deploy atual usa JWT obrigatório. Para um ambiente de produção, configure os secrets do provedor de IA no Supabase e mantenha as URLs de redirecionamento de Auth do domínio publicado atualizadas.
