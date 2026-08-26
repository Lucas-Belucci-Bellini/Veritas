# Matriz de QA — Veritas Desktop

## Regra de promoção

Um workflow concluído prova somente que uma etapa de automação terminou. Cada plataforma deve avançar separadamente por **código compilado**, **artefato gerado**, **artefato verificado**, **aplicação executada**, **smoke aprovado**, **testes automatizados** e **release candidate**. Qualquer etapa que não possa ser executada deve permanecer como **NOT VERIFIED**, nunca como `PASSED`.

## Estado da prévia `0.1.0-alpha.1`

| Plataforma | Build | Artefato | Integridade/metadata | Startup | Editor/simulação | Persistência/remoção | Estado de promoção |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Linux x86_64 | PASSED | PASSED | PASSED | PASSED em execução controlada | NOT VERIFIED por fluxo interativo completo | NOT VERIFIED | Prévia técnica |
| Windows x64 | PASSED no runner nativo | PASSED: NSIS `.exe` | PASSED: PE32/NSIS, `MZ`, SHA-256 | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Não estável |
| macOS arm64 | PASSED no runner nativo | PASSED: `.dmg` e `.app.zip` | PASSED: trailer DMG/ZIP íntegro, SHA-256 | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Não estável |

A release pública [`desktop-v0.1.0-alpha.1`](https://github.com/Lucas-Belucci-Bellini/Veritas/releases/tag/desktop-v0.1.0-alpha.1) é uma **pré-release**. Ela contém artefatos para os três alvos, `SHA256SUMS` e `desktop-release-manifest.json`, mas não é uma declaração de suporte estável.

## Gate Windows — instalador `.exe`

| Verificação | Critério | Estado em `0.1.0-alpha.1` |
| --- | --- | --- |
| Build Windows | Job nativo concluído | PASSED |
| Executável/instalador | Arquivo `.exe` presente e PE/NSIS | PASSED |
| SHA-256 | Hash publicado e reproduzível | PASSED |
| Release | Asset anexado a uma release prévia | PASSED |
| Instalação limpa | Instalar em Windows limpo | NOT VERIFIED |
| Atalho | Criar e abrir atalho | NOT VERIFIED |
| Inicialização | Abrir sem erro | NOT VERIFIED |
| Editor | Criar e editar circuito | NOT VERIFIED |
| Persistência | Salvar e reabrir projeto | NOT VERIFIED |
| Offline | Repetir fluxo sem rede | NOT VERIFIED |
| Simulação | Avaliar circuito e sequência | NOT VERIFIED |
| Encerramento | Fechar normalmente | NOT VERIFIED |
| Desinstalação | Remover sem deixar instalação inválida | NOT VERIFIED |
| Atualização | Atualizar preservando projetos | NOT VERIFIED |

## Gate macOS

O runner macOS confirmou build, bundle e upload de `Veritas_0.1.0-alpha.1_aarch64.dmg` e do ZIP do `.app`. Startup, editor, simulação, IndexedDB, atualização, assinatura e notarização continuam **NOT VERIFIED**. O suporte final deve incluir uma matriz para arm64 e, se o produto prometer Intel, um alvo Intel separado.

## Gate Linux

O Linux possui a maior evidência desta prévia. O build Tauri, o pacote Debian, o AppImage, os metadados e a inicialização controlada do binário foram verificados no sandbox. Ainda faltam instalação limpa do `.deb`, execução distribuída do AppImage em uma distribuição independente, atualização, remoção e smoke funcional interativo completo.

## Gates automatizados do núcleo e da distribuição

| Gate | Cobertura atual | Estado |
| --- | --- | --- |
| Regressão cruzada permanente | 12 casos: AND, NAND, OR, NOR, XOR, XNOR, NOT, meio somador, somador completo e multiplexador; todas as combinações possíveis em cada caso | PASSED localmente |
| Helpers de métricas desktop | 4 testes: parser de RSS, tamanho de arquivos, binário ausente e geração de JSON/Markdown sem rede | PASSED localmente |
| Medição Linux | `npm run desktop:metrics`, baseline de tamanho, spawn e RSS ocioso; simulação e installed size explicitamente não inferidos | PASSED para medidas disponíveis; demais campos `NOT VERIFIED` |

A regressão cruzada usa `buildTruthTable(parse(expression))` como intenção e `createDocumentRuntime()`/`Simulator` como execução do `CircuitDocument`. Qualquer divergência ou não-estabilização faz o teste falhar e impede o gate automatizado da release; isso não transforma um teste local em validação de runtime desktop.

## Início formal dos testes — desktop `0.5.0`

A `0.5.0` só será aberta quando houver builds por plataforma e um conjunto de máquinas ou runners capazes de executar os fluxos. O checklist mínimo será repetido em cada sistema: instalar, criar circuito, conectar portas, simular, salvar projeto local, fechar, reabrir, exportar/importar `.veritas`, exportar Verilog/VHDL, testar sem rede, atualizar e desinstalar. O resultado deverá incluir logs, versões do sistema, hash dos artefatos e a classificação de cada caso como `BUILD VERIFIED`, `RUNTIME VERIFIED`, `SMOKE VERIFIED`, `FAILED` ou `NOT VERIFIED`.

## Promoção estável — desktop `1.0.0`

A `1.0.0` não será criada por calendário nem porque um instalador existe. Ela exige estabilidade comprovada em todos os alvos suportados, zero defeitos críticos abertos, regressão do núcleo, acessibilidade, desempenho dentro dos limites publicados, instalação/atualização/remoção verificadas, assinatura de distribuição configurada e documentação final. Se um alvo não atender ao gate, a promoção deve ser bloqueada ou o alvo deve ser explicitamente retirado da matriz suportada.
