# Matriz de QA — Veritas Desktop

## Regra de promoção

Um workflow concluído prova somente que uma etapa de automação terminou. Cada plataforma deve avançar separadamente por **código compilado**, **artefato gerado**, **artefato verificado**, **aplicação executada**, **smoke aprovado**, **testes automatizados** e **release candidate**. Qualquer etapa que não possa ser executada deve permanecer como **NOT VERIFIED**, nunca como `PASSED`.

## Estado da prévia `0.1.0-alpha.1`

| Plataforma | Build | Artefato | Integridade/metadata | Startup | Editor/simulação | Persistência/remoção | Estado de promoção |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Linux x86_64 | PASSED | PASSED | PASSED | SMOKE VERIFIED: `.deb` instalado e binário iniciado sob Xvfb | NOT VERIFIED por fluxo interativo completo | Instalação/remoção do `.deb`: SMOKE VERIFIED; persistência: NOT VERIFIED | Prévia técnica |
| Windows x64 | PASSED no runner nativo | PASSED: NSIS `.exe` | PASSED: PE32/NSIS, `MZ`, SHA-256 | SMOKE VERIFIED no runner nativo | NOT VERIFIED | Instalação/atalho/desinstalação: SMOKE VERIFIED; persistência: NOT VERIFIED | Não estável |
| macOS arm64 | PASSED no runner nativo | PASSED: `.dmg` e `.app.zip` | PASSED: trailer DMG/ZIP íntegro, SHA-256 | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | Não estável |

A release pública [`desktop-v0.1.0-alpha.1`](https://github.com/Lucas-Belucci-Bellini/Veritas/releases/tag/desktop-v0.1.0-alpha.1) é uma **pré-release**. Ela contém artefatos para os três alvos, `SHA256SUMS` e `desktop-release-manifest.json`, mas não é uma declaração de suporte estável.

## Gate Windows — instalador `.exe`

| Verificação | Critério | Estado em `0.1.0-alpha.1` |
| --- | --- | --- |
| Build Windows | Job nativo concluído | PASSED |
| Executável/instalador | Arquivo `.exe` presente e PE/NSIS | PASSED |
| SHA-256 | Hash publicado e reproduzível | PASSED |
| Release | Asset anexado a uma release prévia | PASSED |
| Instalação limpa | Instalar em diretório temporário no runner Windows nativo | SMOKE VERIFIED; Windows limpo de usuário final ainda não verificado |
| Atalho | Criar e localizar atalho Veritas | SMOKE VERIFIED no runner Windows; abrir pelo atalho ainda não verificado |
| Inicialização | Abrir sem erro por 8 segundos | SMOKE VERIFIED no runner Windows; startup da UI/editor ainda não verificado |
| Editor | Criar e editar circuito | NOT VERIFIED |
| Persistência | Salvar e reabrir projeto | NOT VERIFIED |
| Offline | Repetir fluxo sem rede | NOT VERIFIED |
| Simulação | Avaliar circuito e sequência | NOT VERIFIED |
| Encerramento | Fechar normalmente | NOT VERIFIED; smoke encerra o processo de teste à força após startup |
| Desinstalação | Remover sem deixar instalação inválida | SMOKE VERIFIED no runner Windows; máquina de usuário final ainda não verificada |
| Atualização | Atualizar preservando projetos | NOT VERIFIED |

## Gate macOS

O runner macOS confirmou build, bundle e upload de `Veritas_0.1.0-alpha.1_aarch64.dmg` e do ZIP do `.app`. Startup, editor, simulação, IndexedDB, atualização, assinatura e notarização continuam **NOT VERIFIED**. O smoke de instalação Windows não é evidência para macOS. O suporte final deve incluir uma matriz para arm64 e, se o produto prometer Intel, um alvo Intel separado.

## Gate Linux

O Linux possui a maior evidência desta prévia. O build Tauri, o pacote Debian, o AppImage, os metadados e a inicialização controlada do binário foram verificados no sandbox. O runner Linux também instalou o `.deb`, confirmou `/usr/bin/veritas` e `Veritas.desktop`, iniciou o app sob Xvfb e removeu o pacote; esses pontos são `SMOKE VERIFIED`. Ainda faltam execução distribuída do AppImage em uma distribuição independente, atualização e smoke funcional interativo completo do editor/simulador.

## Gates automatizados do núcleo e da distribuição

| Gate | Cobertura atual | Estado |
| --- | --- | --- |
| Regressão cruzada permanente | 12 casos: AND, NAND, OR, NOR, XOR, XNOR, NOT, meio somador, somador completo e multiplexador; todas as combinações possíveis em cada caso | PASSED localmente |
| Helpers de métricas desktop | 4 testes: parser de RSS, tamanho de arquivos, binário ausente e geração de JSON/Markdown sem rede | PASSED localmente |
| Gerador de manifesto/checksum | 2 testes: determinismo para os cinco assets allowlisted e rejeição fail-closed de arquivo inesperado | PASSED localmente |
| Testbench sequencial UI→domínio | 4 testes puros de rascunho e 1 regressão cross-layer com registrador, além de 19 testes do runner de domínio | PASSED localmente |
| Testbench local persistente | 4 testes: CRUD por circuito, ordenação, round-trip/import e rejeição de JSON/formato/modos inválidos | PASSED localmente |
| Medição Linux | `npm run desktop:metrics`, baseline de tamanho, spawn e RSS ocioso; simulação e installed size explicitamente não inferidos | PASSED para medidas disponíveis; demais campos `NOT VERIFIED` |
| BENCH-001 — escala de gates | `npm run bench:circuit-scale`; cadeia determinística `input → N × NOT → output`, runtime `Simulator`, warmup separado, checksum e JSON/Markdown | BASELINE RECORDED: caminho `CircuitDocument` mediu 10/100 no Linux x86_64; 500/1000/5000 `NOT SUPPORTED` pelos limites atuais; FPS, memória desktop e startup nativo `NOT VERIFIED` |
| BENCH-002 — capacidade bruta do runtime | Mesmo fixture como `Netlist` bruto, executado diretamente pelo `Simulator`, sem alterar limites do editor | BASELINE RECORDED: 10/100/500/1000/5000 medidos no Linux x86_64; isso não promove suporte oficial, persistência, editor ou renderização nessa escala |

A regressão cruzada usa `buildTruthTable(parse(expression))` como intenção e `createDocumentRuntime()`/`Simulator` como execução do `CircuitDocument`. Qualquer divergência ou não-estabilização faz o teste falhar e impede o gate automatizado da release; isso não transforma um teste local em validação de runtime desktop.

O BENCH-001 mediu, nesta execução Linux x86_64/Node `v22.13.0`, 0,577 ms em 220 ticks para 10 gates e 17,271 ms em 2.020 ticks para 100 gates. O BENCH-002 também executou o Netlist bruto nos cinco alvos, incluindo 5000 gates em 6.273,959 ms/15.003 ticks. Os valores são baseline da máquina/processo, não são comparáveis entre plataformas sem ambiente equivalente e não promovem suporte editorial, persistência ou renderização nessa escala.

## Início formal dos testes — desktop `0.5.0`

A `0.5.0` só será aberta quando houver builds por plataforma e um conjunto de máquinas ou runners capazes de executar os fluxos. O checklist mínimo será repetido em cada sistema: instalar, criar circuito, conectar portas, simular, salvar projeto local, fechar, reabrir, exportar/importar `.veritas`, exportar Verilog/VHDL, testar sem rede, atualizar e desinstalar. O resultado deverá incluir logs, versões do sistema, hash dos artefatos e a classificação de cada caso como `BUILD VERIFIED`, `RUNTIME VERIFIED`, `SMOKE VERIFIED`, `FAILED` ou `NOT VERIFIED`.

## Promoção estável — desktop `1.0.0`

A `1.0.0` não será criada por calendário nem porque um instalador existe. Ela exige estabilidade comprovada em todos os alvos suportados, zero defeitos críticos abertos, regressão do núcleo, acessibilidade, desempenho dentro dos limites publicados, instalação/atualização/remoção verificadas, assinatura de distribuição configurada e documentação final. Se um alvo não atender ao gate, a promoção deve ser bloqueada ou o alvo deve ser explicitamente retirado da matriz suportada.
