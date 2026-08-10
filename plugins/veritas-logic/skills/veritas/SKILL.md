---
name: veritas
description: Lógica booleana e circuitos digitais com resultados exatos — tabelas verdade, simplificação mínima, mapas de Karnaugh, formas normais SOP/POS, simulação de circuitos com clock e flip-flops, e uma biblioteca de 1121 chips. Use sempre que aparecer expressão booleana, álgebra de Boole, tabela verdade, De Morgan, mintermo, maxtermo, soma de produtos, produto de somas, mapa de Karnaugh, porta lógica, circuito digital, flip-flop ou somador.
---

# Veritas — lógica booleana

Estas ferramentas calculam. Não resolva tabela verdade nem simplificação de
cabeça: uma expressão com 5 variáveis tem 32 linhas, e errar uma delas passa
despercebido. Mande para a ferramenta e use a resposta.

## Qual ferramenta usar

| A pergunta é… | Ferramenta |
| --- | --- |
| "qual a tabela verdade de…" | `truth_table` |
| "quanto dá … para A=1, B=0" | `evaluate_expression` |
| "simplifique", "reduza", "quantas portas economiza" | `simplify_expression` |
| "SOP", "POS", "mintermos", "maxtermos", "forma canônica" | `normal_forms` |
| "mapa de Karnaugh", "agrupamentos" | `karnaugh_map` |
| clock, flip-flop, contador, latch, "depende do estado anterior" | `simulate_circuit` |
| "existe um somador pronto?", "como é o Full Adder" | `list_chips`, `get_chip` |

## Notação aceita

As quatro convenções funcionam ao mesmo tempo, e podem ser misturadas:

| Operação | Matemática | Programação | Texto | Engenharia |
| --- | --- | --- | --- | --- |
| E | `∧` | `&&` | `AND` | `A B` (justaposto), `·`, `*` |
| OU | `∨` | `\|\|` | `OR` | `+` |
| NÃO | `¬` | `!` | `NOT` | `A'` (apóstrofo depois) |
| XOR | `⊕` | `^` | `XOR` | |
| Implica | `→` | `->` | `IMPLICA` | |
| Equivale | `↔` | `<->` | `EQUIVALE` | |

Também há `NAND`, `NOR` e `XNOR`.

Isso quer dizer que uma expressão copiada de um livro ou de uma lista de
exercícios entra **como está escrita**:

```
(A + B)(A + B')        →  simplify_expression  →  A
A' B C + B C           →  simplify_expression  →  B ∧ C
(A + B' C)'            →  simplify_expression  →  ¬A ∧ ¬C ∨ ¬A ∧ B
```

Variáveis são uma letra só, opcionalmente com dígito (`A`, `Q2`). Letras
coladas (`AB`) são recusadas de propósito — escreva `A B`.

## Detalhes que evitam resposta errada

- **`V` e `F` são variáveis**, não constantes. As constantes são `1` e `0`.
- **Precedência**: `¬` > `∧` > `⊕` > `∨` > `→` > `↔`. A implicação associa à
  direita. Na dúvida, ponha parênteses.
- **SOP e POS não são a mesma conta.** `normal_forms` devolve as duas, mínimas
  e canônicas, com a contagem de operadores — qual sai mais barata depende da
  expressão.
- **Classificar ≠ calcular.** `normal_forms` também diz se a expressão *como
  foi escrita* já está em soma de produtos ou produto de somas. `(A B)' + C`
  não é SOP, porque a negação cobre um grupo em vez de uma variável.
- **Circuito sequencial tem tempo.** Em `simulate_circuit` cada componente
  gasta um tique para propagar, então a saída de um flip-flop muda um tique
  *depois* da borda do clock. Isso é o atraso de propagação, não erro.

## Erros

Erro de sintaxe volta apontando a posição. Leia a mensagem antes de reescrever
a expressão no chute:

```
Falta fechar 1 parêntese.

    (A AND
    ^
```
