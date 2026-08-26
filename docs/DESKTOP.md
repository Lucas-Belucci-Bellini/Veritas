# Veritas Desktop

## Objetivo

O Veritas Desktop é o shell nativo do simulador construído sobre o frontend Vite/React já existente. A primeira prévia do shell é `0.1.0-alpha.1`; ela não substitui a numeração do núcleo web nem altera o contrato da V1. O runtime nativo usa Tauri 2 e embute o diretório `dist/`, mantendo o cálculo, a simulação, a biblioteca IndexedDB e a exportação no dispositivo do usuário.

A escolha privilegia um aplicativo leve em vez de empacotar um runtime Node ou um navegador completo. Não há servidor local obrigatório, conta, telemetria ou sincronização automática. Os recursos que dependem de autenticação ou nuvem continuam opcionais e não são necessários para o fluxo offline.

## Alvos de distribuição

| Sistema | Formato planejado | Runner de produção | Estado atual |
| --- | --- | --- | --- |
| Windows 10/11 | Instalador NSIS `.exe`; MSI poderá ser habilitado depois | `windows-latest` | Workflow preparado; build nativo deve rodar em Windows com WebView2 e C++ Build Tools |
| macOS | `.app` e `.dmg` | `macos-latest` | Workflow preparado; assinatura/notarização dependem de certificados Apple do mantenedor |
| Linux x86_64 | `.deb` e `.AppImage` | `ubuntu-22.04` | Bundle validado localmente no sandbox |

O pacote Linux validado nesta etapa é `Veritas_0.1.0-alpha.1_amd64.deb` e `Veritas_0.1.0-alpha.1_amd64.AppImage`. O executável otimizado foi gerado pelo Tauri com o nome `veritas`. A configuração declara os três sistemas, mas o sandbox Linux não pode afirmar uma compilação nativa de Windows ou macOS sem seus respectivos toolchains e runners.

## Desenvolvimento local

Depois de instalar as dependências JavaScript, o shell pode ser executado com `npm run desktop:dev`. O comando usa o servidor Vite em `http://localhost:5173`, a porta é fixa para evitar que o Tauri carregue uma aplicação diferente e o watcher ignora `src-tauri/`. Para compilar o shell sem empacotar, use `npm run tauri -- build --no-bundle`. Para os pacotes Linux, use `npm run desktop:build:linux` em uma máquina com as bibliotecas WebKitGTK e GTK exigidas pela distribuição.

O manifesto nativo está em [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json), o código de entrada em [`src-tauri/src/`](../src-tauri/src/) e os scripts no [`package.json`](../package.json). O workflow [`desktop-release.yml`](../.github/workflows/desktop-release.yml) constrói os artefatos em runners nativos e os anexa a uma release existente do GitHub. Ele não cria uma release sem uma tag já validada, evitando publicar uma versão não testada por acidente.

## Testes por maturidade

A versão `0.5.0` será o primeiro marco público de testes do aplicativo. Antes de promovê-la, cada plataforma precisa ter instalação limpa, inicialização sem rede, persistência IndexedDB, importação/exportação `.veritas`, simulação combinacional, simulação temporal, exportação Verilog/VHDL e remoção limpa. Também serão exigidos testes de atualização, tamanho do artefato, ausência de chamadas de rede no modo offline e smoke visual do canvas.

| Marco | Critério de promoção |
| --- | --- |
| `0.1.x-alpha` | Shell experimental; apenas validação técnica do empacotamento e do carregamento offline |
| `0.5.0` | Início formal dos testes de uso; matriz Windows/macOS/Linux com checklist repetível e registro dos defeitos conhecidos |
| `0.5.x–0.9.x` | Correção, regressão, desempenho, acessibilidade, segurança local e compatibilidade de arquivos |
| `1.0.0` | Somente após estabilidade comprovada em todos os alvos suportados, zero bloqueios críticos abertos, atualização/remoção verificadas, documentação final e decisão explícita de promoção |

A existência de um instalador `.exe` não será tratada como sinônimo de estabilidade. O Windows será considerado suportado somente quando o `.exe` instalar e remover corretamente em ambiente limpo, abrir sem conta, operar offline e passar a mesma suíte funcional do núcleo.

## Windows e o instalador `.exe`

O workflow usa o bundle NSIS do Tauri e produz um instalador `.exe` em `src-tauri/target/release/bundle/nsis/`. O Windows precisa do WebView2 e das Microsoft C++ Build Tools para desenvolvimento e build. O modo configurado usa o bootstrapper silencioso do WebView2 quando o runtime não estiver presente; a política final de distribuição será confirmada nos testes da 0.5.0 para equilibrar instalação leve e execução offline.

A distribuição pública do `.exe` deverá receber assinatura Authenticode antes de ser tratada como release estável. Certificados, segredo de assinatura e eventual notarização não serão armazenados no repositório. Enquanto a assinatura não estiver configurada, o artefato pode ser usado para testes internos, mas deve ser identificado como prévia.

## Segurança e privacidade

O shell Tauri não adiciona endpoints, banco remoto ou credenciais. O `frontendDist` é embutido no binário e o app continua usando as fronteiras existentes do Veritas: avaliação determinística, importação DLS por allowlist, IndexedDB local e exportações explícitas. Qualquer integração de nuvem permanece opt-in e fora do caminho de inicialização offline.

## Referências

[1]: https://v2.tauri.app/start/frontend/vite/ "Tauri 2 — integração com Vite"
[2]: https://v2.tauri.app/start/create-project/ "Tauri 2 — adicionar Tauri a um projeto existente"
[3]: https://v2.tauri.app/reference/config/ "Tauri 2 — referência de configuração e bundles"
[4]: https://v2.tauri.app/start/prerequisites/ "Tauri 2 — pré-requisitos por sistema operacional"

As decisões de integração seguem a configuração documentada oficialmente pelo Tauri: Vite usa `devUrl` e `frontendDist`, os bundles suportam NSIS, AppImage, deb, app e dmg, e os pré-requisitos variam por sistema operacional.[1] [2] [3] [4]
