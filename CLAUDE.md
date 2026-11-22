# PlayMind 3d — contexto do projeto

App de gestão de uma microempresa de impressão 3D (custos, preços, estoque, vendas
e catálogo público). Usuários reais: 3 pessoas da família. Volume: dezenas de peças
e vendas, não milhares.

**Idioma do código e da interface: espanhol (es-AR).** Comentários e textos novos
devem seguir em espanhol. Conversas com o dono do projeto são em português.

## Arquitetura em uma frase

PWA estático (HTML+JS puro, sem framework, sem build) hospedado no GitHub Pages,
que fala com um Google Apps Script publicado como Web App, que guarda **todo o estado
da aplicação como um único JSON dentro de uma célula do Google Sheets**.

```
navegador ──fetch──> Apps Script (/exec) ──> Google Sheets (aba `datos`, chave `estado`)
                                        └──> Google Drive (fotos das peças)
```

## Mapa de arquivos

| Caminho | O que é |
|---|---|
| `app/index.html` | Shell da app: markup das abas. Sem CSS e sem JS inline. |
| `app/app.css` | Todo o estilo. Design tokens em `:root`. |
| `app/js/*.js` | Toda a lógica da app, em módulos ES (`<script type="module" src="js/main.js">`). Ver a tabela de módulos abaixo. |
| `app/sw.js` | Service worker. **Subir a versão do `CACHE` a cada deploy** e a linha "Versión de la app" em `app/index.html` (Ajustes) junto. O número atual está na 2ª linha do arquivo (não repita aqui: fica velho a cada deploy). |
| `app/manifest.json` | PWA. `scope` e `start_url` = `/app/`. |
| `index.html` (raiz) | Catálogo público (página nova desde 22/11/2026; código em `catalogo/`). Consome `?action=catalogo`, não faz login. Também há `robots.txt` e `sitemap.xml` na raiz. |
| `vender/index.html` | Página curta de venda. |
| `catalogo/` | Código do catálogo público novo (publicado em 22/11/2026): módulos ES, sem build, importados do protótipo do v0 (branch `v0/catalog-v2`) e adaptados. O `index.html` da raiz é a página e aponta para os arquivos desta pasta (`./catalogo/...`). Lê `?action=catalogo` do Apps Script, sem login. Ficha ao clicar na peça, com abas "1. Limpia / 2. En mano / 3. En uso" (só as fotos que existem); `?pieza=Nombre` abre a ficha. Rodapé só com o Instagram (os outros links não estão confirmados). Testes: `tests/catalogo-v2.test.js`; smoke: `node scripts/humo-catalogo.js`. Catálogo anterior: commit `e6d7b8d` (`git show e6d7b8d:index.html`). Não portou do antigo: "✎ Editar esta pieza" (`?admin=1`) e o filtro de cor; ver pendências do admin. |
| `assets/` | Imagens. `logo-app.png` e `logo-app-full.png` são usados pela app. |
| `server/Codigo.gs` | O Apps Script. **Não roda daqui** — é copiado e colado no editor. |
| `CNAME` | Domínio do site: `playmind3d.com`. Não apagar, o GitHub Pages lê daí. |
| `.nojekyll` | Desliga o Jekyll, que pularia arquivos e pastas começados com `_`. |
| `app/calculo.js` | Cálculo de custo e preço como módulo puro (Node e navegador); base do Worker novo. |
| `app/protocolo.js` | Protocolo de dois servidores como módulo puro (sem DOM nem rede; Node e navegador): decide se cada ação vai ao Apps Script ou ao Worker e como reagir a `migrado`, `revertido`, `clave` e `auth_no_disponible`. Testado em `tests/protocolo.test.js`; o `cadastro-worker` também o usa. |
| `api-worker/` | Worker `playmind3d-api` (Cloudflare + D1), migração do Sheets em andamento: implementa a API POST completa do estado (load/save com merge e versão otimista, editarPieza/agregarPieza/agregarFilamento/resumenNegocio), o catálogo público e a validação de sessão via Apps Script. Publicado em staging (o D1 de staging guarda o estado real do dono) e em produção: `playmind3d-api-prod` (banco `playmind-prod`, vazio), no ar em `MODO=solo-lectura`, com a migração 0002 aplicada nos dois bancos; em `solo-lectura` o Worker recusa com `revertido` toda ação de estado (`load` incluído), só o catálogo e `/salud` respondem. O código do app (`app/js/main.js` com `SERVIDOR_ESTADO`, e `app/protocolo.js`) já sabe trocar para o Worker de produção quando o Apps Script responde `migrado`; enquanto a chave `d1:migrado` estiver desligada o app só fala com o Apps Script. `wrangler` e npm só aqui e em `cadastro-worker/`. |
| `scripts/migracion-d1.js` | Gera o SQL de carga do estado no D1 e compara contagens e hash. Usa só arquivos de `datos-privados/` (ignorada pelo git: estado real nunca vai para o repositório). |
| `docs/migracion-d1*.md` | Estado da migração, limites medidos do D1 e o que a próxima etapa precisa saber. |
| `cadastro-worker/` | Worker da Cloudflare com Gemini para cadastro por chat; chama o Apps Script. |
| `scripts/medir-catalogo.js` | Mede o tempo do catálogo e o peso das fotos. `node scripts/medir-catalogo.js` |
| `scripts/ensayo-protocolo.js` | Ensaio do protocolo de dois servidores no navegador, com o Playwright do ambiente (nada é instalado no repo) e todas as chamadas aos dois servidores interceptadas. `node scripts/ensayo-protocolo.js` |
| `cadastro-worker/test/` | Teste `node:test` do cliente do Apps Script do `cadastro-worker` (1 arquivo: `appsscript.test.js`). |
| `docs/migracion-d1-corte.md` | Roteiro do dia do corte do Apps Script/Sheets para o Worker/D1 e do rollback (Etapa 1b). |
| `tests/` | Testes `node:test` (15 arquivos aqui, 10 em `api-worker/test/` e 1 em `cadastro-worker/test/`). Rodar com `node --test tests/*.test.js api-worker/test/*.test.js cadastro-worker/test/*.test.js`. Precisa de Node 22.13 ou mais novo (os de `api-worker/` usam `node:sqlite`). |
| `docs/superpowers/` | Specs e planos de trabalho. |
| `docs/calculo-de-custo.md` | Explicação em português da fórmula de preço, pra humanos — não é lida pelo app. Cópia dela vive também no Drive, pasta `2brain-compartilhado-Pedro&Raquel/Playmind`, pra Raquel usar com o Claude dela. |

## Módulos de `app/js/`

O antigo `app/app.js` foi dividido em módulos ES, sem mudar comportamento. Sem build:
o navegador carrega os módulos direto. Use `grep -n` para achar, não leia tudo.

| Módulo | O que guarda |
|---|---|
| `main.js` | Só a ligação: chama os `iniciar<Modulo>()` em ordem, liga os botões e campos do HTML (`plumbing`), registra o service worker, roda o arranque `init()` e monta `window.PM` e `window.PM_ENSAYO`. Não ponha lógica nova aqui. |
| `entrada.js` | Login: `mostrarEntrada`, `entrar`, `claveVencida`, `salir`, `alternarClave`. |
| `nube.js` | Sincronização: protocolo de dois servidores (`SERVIDOR_ESTADO`, `MODO_SERVIDOR`, `pedirEstado`), `pedir`, `save`, `subirALaNube`, `bajarDeLaNube`, `sincronizarAlAbrir`, `exportar`, e o estado `listoParaSubir` (setter `setListoParaSubir`). |
| `util.js` | Helpers puros (`$`, `el`, `num`, `money`…). |
| `estado.js` | O estado `D`, `reemplazarEstado`, `defaults`, `local`, constantes `SERVIDOR`/`WORKER_CADASTRO`/`KEY`/`LOGO`. |
| `ui.js` | `toast`, `showTab`, `renderAll`, `renderLight`. |
| `calculo.js` | Delegadores finos para o global `Calculo` (`app/calculo.js`) + `migrarInsumos`. |
| `stock.js` · `fotos.js` · `catalogo.js` · `editor.js` · `pedido.js` · `vitrina.js` · `ventas.js` · `radar.js` · `ajustes.js` | Uma por seção antiga, mesmo nome. |
| `pos.js` | Seção `punto de venta`. |
| `chat.js` | Seção `cadastro por chat`. |

`app/calculo.js` **não** é módulo: é script clássico (global `Calculo`), também
empacotado pelo Worker da Cloudflare. Deve continuar clássico.

Regras dos módulos:

- **Handlers inline:** toda função chamada por um `on*=` de `app/index.html` precisa
  estar exposta em `window.PM` (`main.js`) e ser chamada como `PM.fn(...)`.
  `tests/handlers-inline.test.js` confere (os nomes saem do HTML).
- `D` só se reatribui via `reemplazarEstado(x)`; quem importa lê o binding vivo.
- Um `let`/`var` exportado só é reatribuído pelo módulo dono; os outros usam um setter
  exportado (ex.: `setFotosTmp`, `setPosForma`).
- O código executável de topo de cada seção vive numa função `iniciar<Modulo>()` que o
  `main.js` chama numa ordem fixa (a ordem das antigas seções do `app.js`). Exceções
  inofensivas, só de leitura: `radar.js` mantém no topo o IIFE `PIEZA_PENDIENTE` e
  `nube.js` inicializa `MODO_SERVIDOR` lendo o `localStorage`. Os listeners de
  `plumbing` ficam no topo de `main.js`, que é o lugar deles.
- `window.PM_ENSAYO` (fim de `main.js`) existe só para `scripts/ensayo-protocolo.js`, que precisa
  ler `D`, `listoParaSubir` e o reintento e chamar `subirALaNube()`/`save()`. Não use em código da app.
- Há ciclos de import deliberados (por exemplo `nube.js` ↔ `entrada.js`); só são seguros
  porque nada roda na avaliação dos módulos. **Não adicione leituras de topo de bindings
  de outro módulo.**

## O estado (`D`)

Objeto global único. Chaves de topo:

`cfg` (config e credenciais) · `canais` · `filamentos` · `impressoras` · `insumos` ·
`produtos` · `vendas` · `pedido` · `pedidoFil` · `radar` · `packs` · `opiniones` · `v`

Persistência: `local` (IndexedDB/localStorage) no cliente + sync com o servidor via
`action=save` / `action=load`. **Todo save envia o estado completo.**

## Restrições que não são negociáveis

1. **Célula de Sheets = 50.000 caracteres.** O estado inteiro serializado tem que
   caber. Nunca guarde imagem em base64 dentro de `D`. Fotos vão para o Drive
   (`moverFotosADrive_` no servidor); logos são arquivos em `/assets/`. No
   catálogo público (`catalogoPublico_`), as fotos do Drive saem redimensionadas
   (`=w800`) por `fotoChica_`.
2. **Sem build step no app.** Em `app/` nada de npm, bundler ou framework. O que
   está no repo é exatamente o que vai pro ar. Prettier é a única ferramenta, e é
   opcional. (Os Workers `api-worker/` e `cadastro-worker/` usam npm e `wrangler`,
   isolados em suas pastas; o `wrangler.toml` da raiz é o da restrição 8.)
3. **Não quebrar o formato do JSON salvo.** Mudou o shape de `D`? Escreva migração
   em `init()` (`app/js/main.js`, o IIFE de arranque) ou nas funções `migrar*` que ele
   chama (os carregadores como `bajarDeLaNube` também as chamam), como a que trata logo
   base64 legado.
4. **Nunca voltar a colocar credencial no código.** Usuário novo ou troca de clave
   se faz pelo menu da planilha, sem redeploy.
5. **Deploy do Apps Script:** salvar não basta. `Implementar > Administrar
   implementaciones > lápis > Versão: NUEVA`. Se alterou `server/Codigo.gs`, lembre
   o usuário disso.
   Vale também para as chaves da migração no Apps Script: Script Properties
   `d1:migrado` e `d1:catalogoUrl`, os três itens "D1:" do menu "PlayMind 3d" e as
   actions novas `subirFotos`, `guardarSnapshot` e `exportarEstado`. Ligar `d1:migrado` **é** o corte
   (as cópias antigas do app deixam de salvar); não ligar antes de o plano 1b entrar.
6. **`sw.js`:** qualquer arquivo novo em `app/` precisa entrar em `ARCHIVOS` e o
   `CACHE` precisa mudar de versão, senão os usuários ficam com a versão antiga (inclui `app/js/*.js`;
   `tests/sw-archivos.test.js` confere a lista).
7. **Hospedagem do domínio próprio = GitHub Pages, servindo a branch `main` na
   raiz.** Push na `main` já publica. O domínio é do Wix, que **não deixa trocar
   os nameservers** dos próprios domínios — por isso não dá para apontar
   `playmind3d.com` para Cloudflare Workers nem para o apex do Cloudflare Pages,
   que exigem nameservers da Cloudflare. O DNS fica no Wix: quatro registros A
   para os IPs do GitHub e um CNAME de `www`.
8. **`wrangler.toml` e `.assetsignore` existem de novo, mas não competem com o
   GitHub Pages.** Publicam o mesmo repositório em paralelo em
   `playmind3d.pdroarraes.workers.dev` (subdomínio gratuito da Cloudflare, sem
   depender de nameservers) — não em `playmind3d.com`. Serve como staging até o
   domínio poder ser transferido pra Cloudflare (só depois de 60 dias da compra
   no Wix). `.assetsignore` exclui `.git/`, `.wrangler/` e `wrangler.toml` do
   deploy: sem isso, o Wrangler sobe a pasta `.git/` inteira como arquivo
   estático público.
9. **O cálculo de preço existe duas vezes: `Calculo.calcular` em `app/calculo.js`
   (o `calc()` de `app/js/calculo.js` só delega a ele) e `calcular_()` em
   `server/Codigo.gs`.** Mexeu em uma, mexa na outra na mesma
   hora; `tests/calculo-paridad.test.js` (217 casos dourados, mais ids duplicados)
   falha se divergirem. Quando o catálogo passar para o Worker (Etapa 1 da
   migração), o `calcular_` deixa de existir e sobra uma cópia só. Não é
   preferência de estilo: o preço do catálogo público sai do
   servidor e o que vocês veem sai do app, então divergir significa cobrar do
   cliente um valor diferente do que aparece na tela. Em ago/2026 elas estavam
   divergentes em quatro pontos — o pior era a peça apontando para um filamento
   apagado, que dava $5.300 no app e $2.250 no catálogo. Pontos onde precisam
   concordar: fallback para o primeiro filamento/impressora quando o id não
   existe mais, arredondamento dos gramas a uma casa, `merma` assumindo 12
   quando não houver valor, e preço manual só valendo se for maior que zero.
10. **Toda função que grava a célula `estado` (hoje `guardarEstado_`, `guardarSnapshot_` e
   `editarPieza_`) deve chamar `invalidarCatalogo_()` logo após o `setValues`
   bem-sucedido.** O catálogo público é servido de um cache de 15 minutos
   (`CATALOGO_TTL_S`); sem isso, os visitantes veriam preço e estoque velhos. O cache também usa uma
   marca de geração (`catalogo:gen`) para não guardar um catálogo calculado antes de uma gravação.

## Dívidas conhecidas (não corrigir sem combinar)

- ~~Senhas em texto plano no código~~ — resolvido: hash SHA-256 com sal por pessoa,
  guardado em Script Properties. Gestão pelo menu "PlayMind 3d" da planilha.
- ~~Segredo na query string~~ — resolvido: tudo privado vai por POST. `doGet` só
  responde `action=catalogo`, que é público de propósito.
- Sessões duram 90 dias (`SESION_DIAS`) e vivem em Script Properties (`ses:<token>`).
  Não há rate limiting no login: tentativa de força bruta só esbarra na cota do
  Apps Script. Aceitável para 3 pessoas; revisar se abrir para mais gente.
- ~~Sem controle de concorrência~~ — resolvido: o carimbo de hora da coluna 3 da
  aba `datos` virou número de versão. O cliente recebe em `load`, devolve em cada
  `save`, e se não bater `guardarEstado_` chama `fusionar_` em vez de sobrescrever.
  **Ainda em aberto:** duas pessoas editando o *mesmo* item ao mesmo tempo — vale o
  último que salvar. E apagar a partir de uma cópia desatualizada não tem efeito
  (o item volta), escolha deliberada para não apagar em silêncio o que outro
  acabou de cadastrar.
- **Teto de 50.000 caracteres da célula, com as vendas crescendo para sempre.**
  É o limite que vai quebrar o sistema primeiro: quando estourar, o `setValue` de
  `guardarEstado_` falha e o app simplesmente para de salvar. Em ago/2026 eram 26
  peças (~7,4 KB só na parte pública do catálogo), sem medição exata do estado
  inteiro. Decidido em ago/2026 deixar como está e revisitar quando incomodar. As
  saídas discutidas: mover as vendas antigas para uma aba própria (alívio barato)
  ou migrar para Cloudflare D1 (o Worker já existe na mesma conta). Trocar de
  banco **não** dispensa a sincronização offline, que é a parte difícil.
  Agora dá para ver o espaço em uso no menu da planilha: "PlayMind 3d > Ver cuánto
  espacio queda". Gatilho proposto para revisitar a decisão do banco: 70% =
  35.000 caracteres.
- Um token de sessão revogado pode continuar valendo no Worker por até 10 minutos
  (cache por isolate de `validarSesion`).
- Cobertura de testes pequena: há 26 arquivos `node:test` (15 em `tests/`, 10 em `api-worker/test/`, 1 em `cadastro-worker/test/`), rodados com
  `node --test tests/*.test.js api-worker/test/*.test.js cadastro-worker/test/*.test.js`. Não use `node --test tests/` — no Node 22 ele trata
  o diretório como módulo e falha. Os módulos de `app/js/` só têm testes de `estado`, `stock`, delegadores do cálculo e handlers; a interface é coberta pelo `scripts/humo.js` e o protocolo de dois servidores pelo `scripts/ensayo-protocolo.js`.
- `copy(...)` é chamada em `radar.js` (duas vezes) e em `ajustes.js` (uma), mas nenhuma
  função `copy` está definida em lugar nenhum: esses botões lançam ReferenceError ao
  clicar. Vem de antes da modularização; não foi corrigido.

## Como trabalhar aqui

- Antes de editar, `grep -n` o módulo certo em `app/js/`. Não abra arquivos inteiros sem necessidade.
- Um commit por mudança, mensagem em português.
- Depois de mexer em JS: `node --check app/js/<arquivo>.js`, `node --test tests/*.test.js`
  e `node scripts/humo.js` (smoke com Playwright: sobe `/app/` com um estado em formato
  antigo, visita todas as abas e confere save < 50.000 caracteres, zero erros de
  console e os handlers de `PM`). Playwright **não** é dependência do repo: existe no
  ambiente cloud do Claude.
- Checagem estática entre módulos (rodar da raiz do repo; ESLint global do ambiente cloud,
  não é dependência): `eslint -c scripts/eslint.config.mjs app/js/*.js`. Linha de base:
  exatamente 3 erros `no-undef` de `copy` (bug latente conhecido, chamada em `radar.js` e
  `ajustes.js` e definida em lugar nenhum). Qualquer outra coisa = `import`/`export` faltando.
- Chamar função de outro módulo exige `export` no módulo dono e `import` onde se usa; o erro
  só aparece quando aquele caminho de código roda (toque/clique). Por isso, rode o eslint
  sempre que mover ou adicionar código entre módulos.
- Teste abrindo `python3 -m http.server` na raiz e acessando `/app/`. A app agora carrega
  módulos ES: no Windows o Python pode servir `.js` como `text/plain` (mapeamento MIME do
  registro) e a página fica em branco; se acontecer, corrija o MIME ou use outro servidor estático.
