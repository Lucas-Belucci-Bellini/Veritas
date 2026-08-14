# Verificação manual — 2026-08-14

A aplicação foi aberta localmente em modo de desenvolvimento após o build. A tela principal continuou carregando a calculadora, a tabela verdade, o circuito derivado da expressão, formas normais, mapa de Karnaugh, projetos e biblioteca de chips.

A seção **Editor visual combinacional** apareceu abaixo dos painéis existentes, com a identificação de prévia v0.7.0, tutorial expansível, paleta de Entrada, Constante, AND, OR, NOT, XOR e Saída, além de um canvas React Flow com o exemplo inicial de uma porta AND.

O estado inicial mostrou corretamente o aviso de validação para entradas desconectadas quando o componente foi renderizado antes da carga do exemplo. A interface também exibiu os controles de zoom e o status do circuito. O build final separou `CircuitEditor` em um chunk próprio e não apresentou o aviso anterior de chunk inicial acima de 500 kB.

Esta verificação confirma a renderização e a composição da interface. A interação de arrastar conexões deve continuar sendo coberta por testes de domínio e, em uma próxima iteração, por testes de navegador automatizados.
