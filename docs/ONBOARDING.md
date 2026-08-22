# Guia de primeiros passos — Veritas

Este guia foi escrito para uma pessoa que nunca abriu o Veritas. O caminho principal funciona sem conta e sem configurar Supabase. A nuvem, a colaboração e a análise de IA são recursos opcionais que dependem de conexão e, em alguns casos, autenticação.

## O objetivo em dois minutos

Ao terminar o primeiro uso, você deverá conseguir escrever uma expressão booleana, ler a tabela verdade, observar o circuito equivalente, salvar o trabalho localmente e exportar uma cópia. O exercício mais curto é:

```text
(A AND B) OR NOT C
```

Digite a expressão na caixa principal. A tabela verdade é calculada automaticamente. Selecione uma linha para acender o caminho correspondente no circuito equivalente. Alterne entre `V / F` e `1 / 0` no controle **Valores** quando preferir outra representação.

## Passo a passo

### 1. Escreva uma expressão

Use os operadores `AND`, `OR` e `NOT`, parênteses e letras como `A`, `B` e `C`. O teclado virtual oferece símbolos de lógica e corrige a posição do cursor quando você insere ou apaga um operador. Se a expressão for inválida, a mensagem mostra o problema em português; corrija-a antes de usar a tabela.

Também é possível usar a notação de engenharia, como `A B'`, desde que as letras sejam separadas. O Veritas não transforma uma palavra digitada por engano em várias variáveis sem avisar.

### 2. Leia a tabela e o circuito

Com uma expressão válida, o Veritas mostra as combinações de entrada e o resultado. Quando **Passos intermediários** está ativado, cada subexpressão aparece em uma coluna adicional. Abaixo, o circuito equivalente é carregado sob demanda. Clique ou use `Enter`/`Espaço` em uma linha da tabela para observar os valores no circuito.

Para expressões com muitas variáveis, a tabela pode ser virtualizada. Isso evita renderizar todas as células de uma vez, mas não altera o resultado lógico.

### 3. Salve sem conta

Use os projetos salvos no navegador para nomear, reabrir, renomear e excluir expressões. Os dados ficam no IndexedDB local. O aviso de modo offline não é um erro: o cálculo e os projetos locais continuam disponíveis depois que o aplicativo já foi carregado.

Antes de limpar os dados do navegador ou trocar de dispositivo, use a exportação `.veritas` para criar uma cópia. A importação rejeita JSON quebrado, arquivos de outro programa e formatos futuros que o Veritas ainda não entende.

### 4. Explore o editor visual

No **Editor visual**, adicione entradas, constantes, portas e saídas na paleta. Arraste os pontos de saída para as entradas. O editor valida ciclos, conexões inválidas e larguras incompatíveis antes de salvar ou exportar. A tabela verdade permanece disponível para circuitos combinacionais; clocks, flip-flops e delays usam o painel de simulação temporal.

O editor também oferece exportação Verilog/VHDL para circuitos válidos e escalares/vetoriais compatíveis. Um circuito inválido deve ser corrigido, não contornado, antes da exportação.

### 5. Use nuvem e colaboração somente quando precisar

A autenticação é opcional. Quando as variáveis públicas do Supabase estão configuradas, entre na sua conta para sincronizar um circuito visual. A ação é explícita: projetos locais não são enviados automaticamente. O histórico remoto cria versões e a colaboração usa salas privadas com papéis de editor e visualizador.

Nunca compartilhe tokens ou chaves privadas. Para convidar alguém, use o identificador da conta dentro do painel de acesso. Um visualizador pode acompanhar o circuito, mas não deve publicar alterações.

### 6. IA e limites conhecidos

A análise e a otimização por IA estão disponíveis para circuitos combinacionais escalares quando existe sessão autorizada. O resultado é uma sugestão: revise antes de aplicar. Falhas de IA ou telemetria não devem interromper o editor local. Circuitos vetoriais e sequenciais podem mostrar o recurso desabilitado enquanto seus contratos específicos ainda não estiverem concluídos.

## Checklist de conclusão externa

Uma pessoa externa concluiu o onboarding quando consegue realizar os passos abaixo sem instrução privada do mantenedor:

| Verificação | Resultado esperado |
| --- | --- |
| Abrir a aplicação sem conta | A página carrega e explica os primeiros passos. |
| Digitar `(A AND B) OR NOT C` | A expressão é aceita e a tabela aparece. |
| Selecionar uma linha | O circuito equivalente reflete a atribuição. |
| Salvar e recarregar | O projeto local continua disponível no navegador. |
| Exportar e importar | A cópia `.veritas` retorna sem erro. |
| Entender a nuvem | A pessoa sabe que autenticação/sincronização são opcionais e explícitas. |
| Encontrar ajuda | O tutorial inicial e este documento explicam o próximo passo e os limites. |

Registre navegador, viewport, se estava online/offline, horário, passos concluídos e qualquer bloqueio. Não registre expressões privadas, cookies, tokens ou UUIDs de outras pessoas.

## Solução de problemas

Se a expressão não gerar tabela, leia a mensagem vermelha e verifique parênteses, operadores e separação das letras. Se os projetos locais não aparecerem, confirme se o navegador permite armazenamento para o site e não use uma janela anônima que descarte dados ao fechar. Se a nuvem estiver indisponível, continue localmente e exporte uma cópia; a falha de rede não deve apagar o circuito.

Se uma versão remota causar conflito, não repita o salvamento cegamente. Atualize o histórico, compare as versões e crie uma nova versão a partir da base autorizada. Em caso de deployment problemático, siga [`ROLLBACK-RUNBOOK.md`](./ROLLBACK-RUNBOOK.md) e preserve tags e histórico.

## Limitações beta

O Veritas ainda é uma prévia `v0.9.0-rc.4`. A promoção beta depende de evidências reais de RLS cross-user, Realtime entre contas, inspeção em navegadores/dispositivos, onboarding externo e rollback operacional. O checklist automatizado confirma a presença do tutorial e dos contratos locais; ele não substitui uma pessoa externa seguindo este guia.

## Referências

[1]: ../README.md "Veritas — visão geral técnica"

[2]: ./BETA-ACCESSIBILITY-ACCEPTANCE.md "Veritas — gate de acessibilidade e mobile"

[3]: ./ROLLBACK-RUNBOOK.md "Veritas — runbook de rollback"
