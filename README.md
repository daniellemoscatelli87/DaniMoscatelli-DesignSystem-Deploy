# DaniMoscatelli-DesignSystem-Deploy

Automação de build, versionamento e publicação do DM Design System, integrado ao Figma Make e ao GitHub Pages.

## Como funciona

1. O Figma Make envia o código ao branch `main` de `daniellemoscatelli87/DaniMoscatelli-DesignSystem`.
2. A cada 15 minutos, o fluxo [`publish.yml`](.github/workflows/publish.yml) deste repositório confere se o `main` mudou. Se não mudou, termina sem fazer nada.
3. Se mudou, cria a versão seguinte (`v1`, `v2`, ...), grava a tag `vN` na fonte (o código daquela versão fica congelado no Git) e gera o inventário do que existe: grupos e itens do menu, seções, âncoras, componentes e tokens (`versoes/vN.json`).
4. Compara o inventário com a versão que está no ar:
   - **nada sumiu** → faz o build e publica no branch `gh-pages`, que o GitHub Pages serve e o site mostra em `danimoscatelli.com.br/designsystem`;
   - **algo sumiu** → a versão fica registrada como **retida**, o site continua com a versão anterior e o fluxo falha mostrando o que faltou. Para publicar mesmo assim, rode o fluxo manualmente (Actions → Publicar DM Design System → Run workflow) com `aceitar_remocoes` marcado.
5. Para voltar a uma versão anterior, rode o fluxo manualmente com `acao = voltar` e `versao = vN`.

No ar fica só a versão atual. As anteriores ficam no Git: a fonte na tag `vN` do repositório do design system e o build no histórico do branch `gh-pages`.

## Registro

- `versoes/versoes.json`: versão atual, lista de versões (status `publicada` ou `retida`, commit da fonte, o que sumiu e o que entrou) e histórico do que foi ao ar.
- `versoes/vN.json`: inventário de cada versão.

## Proteções

- Se o Figma Make apagar a linha `base: '/DaniMoscatelli-DesignSystem/'` do `vite.config.ts`, nada é publicado (sem ela o endereço do site deixa de carregar).
- Este repositório não é tocado pelo Figma Make. O fluxo que ficava dentro do repositório do design system foi apagado por ele duas vezes, por isso a automação vive aqui.

## Segredo necessário

`DEPLOY_TOKEN`: token com permissão de escrita no repositório do design system (publica o `gh-pages` e grava as tags).
