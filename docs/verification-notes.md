# Verificação manual — 2026-08-14

A aplicação foi aberta localmente em modo de desenvolvimento após o build. A tela principal continuou carregando a calculadora, a tabela verdade, o circuito derivado da expressão, formas normais, mapa de Karnaugh, projetos e biblioteca de chips.

A seção **Editor visual combinacional** apareceu abaixo dos painéis existentes, com a identificação de prévia v0.7.0, tutorial expansível, paleta de Entrada, Constante, AND, OR, NOT, XOR e Saída, além de um canvas React Flow com o exemplo inicial de uma porta AND.

O estado inicial mostrou corretamente o aviso de validação para entradas desconectadas quando o componente foi renderizado antes da carga do exemplo. A interface também exibiu os controles de zoom e o status do circuito. O build final separou `CircuitEditor` em um chunk próprio e não apresentou o aviso anterior de chunk inicial acima de 500 kB.

Esta verificação confirma a renderização e a composição da interface. A interação de arrastar conexões deve continuar sendo coberta por testes de domínio e, em uma próxima iteração, por testes de navegador automatizados.

## Verificação da tabela verdade e persistência — 2026-08-14

A aplicação local foi aberta em `http://127.0.0.1:5173`. A tela principal continuou renderizando a calculadora e o circuito equivalente existentes. Na prévia do editor visual, os controles `Novo exemplo`, `Salvar local`, `Exportar` e `Importar` apareceram junto da paleta de componentes e do tutorial.

O circuito AND de demonstração exibiu a mensagem de validação esperada para uma entrada desconectada quando o canvas foi carregado. Isso confirma que a validação visual impede que uma tabela enganosa seja mostrada antes de o usuário completar as conexões. A estrutura da interface também exibiu o espaço preparado para projeto local e a tabela verdade automática quando o circuito está válido.

A verificação foi apenas local e não executou login nem escrita no Supabase pelo navegador. A camada Supabase foi aplicada separadamente via migração protegida por RLS.

## Verificação após correção do estado inicial — 2026-08-14

Após recarregar a aplicação, o exemplo inicial passou a exibir três conexões React Flow entre `I1`, `I2`, a porta AND e `O4`. O status mudou para **Circuito visual válido: 2 entrada(s), 4 linha(s)**.

A tabela verdade do editor apareceu com as quatro linhas esperadas: `F F F`, `F V F`, `V F F` e `V V V`, além dos controles `V / F`, seleção de linha e a mensagem de que um clique acende o circuito. A correção foi a inicialização dos edges com `createDemoEdges()` em vez de iniciar o editor sem fios.
