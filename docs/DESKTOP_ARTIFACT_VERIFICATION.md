# Verificação de artefatos desktop cross-platform

Este documento registra uma execução de verificação de artefatos sem criar tag, GitHub Release ou distribuição pública. O objetivo é provar que a matriz de build consegue produzir os contêineres Tauri esperados em runners nativos; isso não substitui instalação, abertura, simulação, cancelamento, persistência ou QA de usuário final.

## Execução registrada

O workflow manual `Veritas desktop artifact verification` foi executado no run [`33087842535`](https://github.com/Lucas-Belucci-Bellini/Veritas/actions/runs/33087842535), usando o commit `9db1cc1e0967bce9ab0fc6566ddf78f07e14439f` da `main`. A matriz terminou com `success` nos três jobs: Linux em 5m57s, Windows em 6m08s e macOS em 4m32s. Cada job instalou dependências, executou `tauri build`, verificou os caminhos esperados e fez upload temporário do artifact por plataforma.

| Plataforma | Artefato | Tamanho | SHA-256 | Evidência |
|---|---|---:|---|---|
| Linux x86-64 | `Veritas_0.1.0-alpha.1_amd64.AppImage` | 80.873.976 bytes | `0ce03f557b08da6a21fc1d06e0ed132cbc43388feac824cef079666ca9f1ad9f` | ELF x86-64 reconhecido; produzido no runner Linux |
| Linux x86-64 | `Veritas_0.1.0-alpha.1_amd64.deb` | 3.288.526 bytes | `df87920cbdfc5fc41267a6fa49581b16634d3e2ed1e961e29a17901b46d1eaf3` | Debian format 2.0; pacote amd64 e metadata inspecionados |
| Windows x64 | `Veritas-Setup.exe` | 2.278.320 bytes | `d6f958362a4f3cdba022f9280f5ad1d1533f231390259a45b47470bb617a72c4` | PE32 GUI reconhecido como instalador NSIS; nome normalizado pelo workflow |
| macOS arm64 | `Veritas_0.1.0-alpha.1_aarch64.app.zip` | 3.173.892 bytes | `451e89fe9f686a80c57a2536464448e6c23a3c5704547b1b9935e0d546a181de` | ZIP contém `Veritas.app`, binário arm64, `Info.plist` e `icon.icns` |
| macOS arm64 | `Veritas_0.1.0-alpha.1_aarch64.dmg` | 3.282.740 bytes | `6560f215f2d8ba0b72db9165b8020e168e60c7b9752fceeb5d4c9fdde3e14a46` | DMG produzido pelo runner macOS; montagem fora do runner não realizada |

## Classificação honesta

A execução é **BUILD VERIFIED** e **ARTIFACT VERIFIED** para Linux x86-64, Windows x64 e macOS arm64 nos runners declarados. O `Veritas-Setup.exe` existe e foi reconhecido estruturalmente, mas este workflow não executa o instalador. O workflow histórico de release possui um smoke Windows separado, porém esse resultado não deve ser atribuído automaticamente a esta execução de verificação.

Não há **RUNTIME VERIFIED** ou **SMOKE VERIFIED** neste registro. O sandbox Linux não executou os binários cross-platform; não houve instalação limpa, abertura da janela, uso do editor, execução do comando Tauri, recebimento de progresso, cancelamento, persistência, offline, upgrade, uninstall, assinatura, notarização ou teste macOS Intel. Os artifacts do workflow têm retenção temporária e não são uma release.

O commit que adicionou o workflow também não cria tag nem modifica a política de release. A criação de GitHub Release continua deliberada e separada, exigindo versão aprovada, checksums/manifest final, assets e evidência proporcional de cada plataforma.
