# Modularizar `app/app.js` — Plano de implementação

> **Estado: EXECUTADO em 19–22/11/2026 e publicado na `main`.** As Tasks 1 a 11 foram feitas; a Task 10 (`nube`) e a parte
> `entrada` da Task 8 ficaram para o fim, depois do cutover D1. Onde o texto abaixo diverge do código (lista de 38 handlers,
> `cargar-app.js`, `app/js/calculo.js` ES, números de versão do `sw.js`), vale o código e o `CLAUDE.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o `app/app.js` único (4.670 linhas) por módulos ES nativos em `app/js/`, sem mudar nenhum comportamento.

**Architecture:** Primeiro uma rede de segurança (teste de paridade de preço, guarda do service worker, roteiro de fumaça no navegador); depois o arquivo inteiro vira módulo (`type="module"`, handlers inline saindo de `window.PM`); depois as seções saem uma a uma, das que menos dependem para as mais enroladas, cada módulo num commit.

**Tech Stack:** HTML + JS puro (ES modules nativos), `node:test` (Node 22), Playwright só no ambiente do Claude (não é dependência do repo).

**Spec:** `docs/superpowers/specs/2026-11-19-modularizar-app-design.md` (contexto: `docs/superpowers/specs/2026-11-18-arquitetura-publico-interno-design.md`).

## Global Constraints

- Sem build, sem npm, sem framework. O que está no repo é o que vai ao ar.
- Zero mudança de comportamento. Código movido é código movido: sem renomear, sem "melhorar".
- `server/Codigo.gs`, o shape de `D`, `cadastro-worker/`, `index.html` da raiz e `app/presupuesto*.js` **não são tocados**. Logo, não há deploy de Apps Script (sem "Versão: NUEVA").
- Cada arquivo novo em `app/` entra em `ARCHIVOS` de `app/sw.js`, e `CACHE` sobe de versão (hoje `playmind3d-v24`) em todo commit que muda a lista ou o conteúdo servido.
- Testes: `node --test tests/*.test.js` (nunca `node --test tests/`). Código e interface em espanhol (es-AR); commits em português, um por mudança, terminando com as duas linhas de atribuição da sessão.
- Trabalhar e dar push só na branch `ccr-bd131b54-aplkzd`, ao fim de cada tarefa. **Não mergear na `main`**: push na `main` publica o site.

## Review Focus

1. `round` fracionário (ex. `0.5`): `calc()` usa `ceilTo` (teto inteiro quando passo ≤ 1) e `calcular_()` usa `Math.ceil(x/paso)*paso`; podem divergir. Teste na Task 1.
2. Parar de salvar sem aviso depois de mexer em `estado`/`nube`: um editar → salvar deve mandar `save` com estado < 50.000 caracteres. Roteiro de fumaça (Task 3), rodado após cada módulo.
3. `sw.js` usa `cache.addAll(ARCHIVOS)`: um só caminho inexistente faz o service worker inteiro não instalar (app sem offline). Teste na Task 2.
4. Botão com `onclick="fn()"` que ficou sem `PM.` só falha ao clicar (ReferenceError). Teste estático e checagem no navegador (Task 4).
5. Estado antigo sem campos opcionais (`radar`, `packs`, `opiniones`, `cfg.leti`, `cfg.merma`) e tela branca por ordem de avaliação dos módulos: o roteiro de fumaça semeia um estado antigo e exige zero erros no console (Task 3).

---

## Mapa de arquivos

Criar `app/js/`: `util.js` (helpers do cabeçalho: `$ el uid num money pct hhmm ceilTo hoy fechaCorta`), `estado.js` (seção `almacenamiento`), `ui.js` (de `plumbing`: `toast`, `showTab`, `renderAll`, `renderLight`), `calculo.js`, `stock.js`, `fotos.js`, `catalogo.js`, `editor.js`, `pedido.js`, `vitrina.js`, `pos.js` (seção `punto de venta`), `ventas.js`, `entrada.js`, `radar.js`, `chat.js` (seção `cadastro por chat`), `ajustes.js`, `nube.js`, `main.js` (boot, registro do service worker, `window.PM`).
Criar também: `tests/helpers/cargar-app.js`, `tests/calculo-paridad.test.js`, `tests/sw-archivos.test.js`, `tests/handlers-inline.test.js`, `tests/estado.test.js`, `scripts/humo.js`.
Modificar: `app/index.html`, `app/sw.js`, `CLAUDE.md`. Remover no fim: `app/app.js` (movido para `app/js/main.js` na Task 4 e esvaziado até virar o boot).

## Procedimento de extração (usado nas Tasks 5 a 10, uma vez por módulo)

Cada módulo é **um commit** (`refactor: extrai <módulo> de app.js, sem mudar comportamento`). Passos, na ordem:

- [ ] **P1.** Criar `app/js/<modulo>.js` com o bloco entre o marcador `/* ---------- <seção> ---------- */` e o próximo marcador, copiado sem alterações, e apagá-lo de `main.js`.
- [ ] **P2.** Fechar as importações: para cada nome de topo declarado no bloco, `grep -nw <nome> app/js/*.js app/index.html`. Os usados fora do bloco são `export`; os nomes de outras seções usados dentro do bloco são `import { … } from './<dono>.js'` (extensão `.js` sempre). Quem importava o nome de `./main.js` passa a importar do módulo novo.
- [ ] **P3.** Variável `let`/`var` reatribuída por **outro** módulo (`grep -nE "\bNOME\s*=[^=]"`): o dono exporta `export function set<Nome>(v)` e os outros chamam essa função; nunca `export let` reatribuído de fora. Conhecidos: `D` (→ `reemplazarEstado`), `listoParaSubir`, provavelmente `MODO_VENTA`.
- [ ] **P4.** Todo comando executável de topo do bloco (`$("#x").addEventListener…`, `querySelectorAll…`, IIFEs como `var X = (function(){…})()` que leiam outro módulo) vai para `export function iniciar<Modulo>()`, chamada por `main.js` na mesma ordem relativa em que a seção aparecia no arquivo original. Declarações puras (funções, constantes literais) ficam no topo.
- [ ] **P5.** Se o bloco tem handlers inline (lista na Task 4), `main.js` os importa e continua expondo-os em `window.PM`.
- [ ] **P6.** `app/sw.js`: acrescentar `'./js/<modulo>.js'` a `ARCHIVOS` e subir `CACHE` (`v24` → `v25`…).
- [ ] **P7.** Verificar: `node --check app/js/<modulo>.js` e `node --check app/js/main.js`; `node --test tests/*.test.js` → tudo PASS; `node scripts/humo.js` → exit 0. Se tocou `estado`, `nube`, `ui` ou `main`, conferir também a linha de saída do roundtrip de `save`.
- [ ] **P8.** Commit; ao fim da tarefa, `git push -u origin ccr-bd131b54-aplkzd`.

---

### Task 1: Paridade de preço `calc()` × `calcular_()`

**Files:**
- Create: `tests/helpers/cargar-app.js`, `tests/calculo-paridad.test.js`

**Interfaces:**
- Produces: `cargarApp(): { calc(p: object): {custo:number, preco:number}, setD(estado: object): void }` — roda `app/app.js` de `/* ---------- almacenamiento` (inclusive o cabeçalho) até o marcador `/* ---------- stock` numa `vm` com `document`, `window`, `localStorage`, `navigator` simulados. Tasks 4 e 6 trocam o carregamento (Task 6 passa a usar `import()`).

- [ ] **Step 1: Escrever `tests/calculo-paridad.test.js`** carregando `app/app.js` via `cargarApp()` e `server/Codigo.gs` via `vm` (como em `tests/servidor-foto.test.js`). Um estado base com 1 filamento (`id:"f1"`, `precoKg:24000`), 1 impressora (`id:"i1"`) e `cfg:{kwh, maoObra, risco, mult, round:100, merma:12}`. Para cada caso, `assert.equal(app.calc(p).preco, srv.calcular_(p, estado).preco)` e o mesmo para `custo`. Casos (nome do `test`): `filamento apagado cae al primero` (`p.fil:"fX"`); `merma ausente vale 12` (`delete cfg.merma`); `gramos a un decimal` (`peso: 33.33`); `precio manual 0 se ignora` (`manual:"0"` e `manual:-5`) e `precio manual positivo manda` (`manual: 4500`); `round fraccionario` (`cfg.round: 0.5`).
- [ ] **Step 2: Rodar** `node --test tests/calculo-paridad.test.js`. Esperado: PASS nos quatro primeiros. Se `round fraccionario` falhar, **não corrigir** (mudaria comportamento): marcá-lo `{ todo: "calc usa ceilTo, calcular_ usa Math.ceil(x/paso)*paso con round<1" }` e levar o achado a Pedro na mensagem final.
- [ ] **Step 3: Commit** `test: paridade entre calc() do app e calcular_() do servidor`.

### Task 2: Guarda da lista `ARCHIVOS` do service worker

**Files:**
- Create: `tests/sw-archivos.test.js`

**Interfaces:**
- Produces: teste que falha se algum caminho de `ARCHIVOS` em `app/sw.js` (relativos a `app/`, e `/assets/...` relativos à raiz do repo) não existir, **ou** se algum `.js` sob `app/` (exceto `sw.js`) não estiver listado.

- [ ] **Step 1: Escrever o teste** `ARCHIVOS no apunta a archivos inexistentes` e `todo .js de app/ está en ARCHIVOS` (extrair a lista com regex sobre `const ARCHIVOS = [ … ];`, ignorar `'./'`).
- [ ] **Step 2: Rodar** `node --test tests/sw-archivos.test.js`. Esperado: PASS no estado atual; se falhar, o próprio `sw.js` já tem um erro: corrigir a lista só se for caminho morto óbvio e dizer isso no commit.
- [ ] **Step 3: Commit** `test: guarda que sw.js lista exatamente os arquivos de app/`.

### Task 3: Roteiro de fumaça no navegador

**Files:**
- Create: `scripts/humo.js`

**Interfaces:**
- Produces: `node scripts/humo.js` → exit 0 se tudo ok, exit 1 com a lista de falhas. Usa `require('playwright')` (do ambiente do Claude; comentar no topo que não é dependência do repo) e um servidor estático `node:http` na raiz do repo em porta livre.

- [ ] **Step 1: Implementar o roteiro.** Semear `localStorage["playmind3d:v2"]` com um estado **antigo** (formato de `defaults()`, mas sem `radar`, `packs`, `opiniones`, `cfg.leti`, `cfg.merma`; com `cfg.token:"t"`, `cfg.email:"x@x"`, 1 filamento, 1 impressora, 1 peça de nome `Pieza humo`). `page.route` para `**/script.google.com/**`, com `access-control-allow-origin: *`: `POST` com `action:"load"` → `{ok:true, data:<o mesmo estado>, v:"1"}`; `action:"save"` → `{ok:true, v:"2"}` e guardar o corpo recebido; qualquer outra → `{ok:true}`.
- [ ] **Step 2: Checagens**, nesta ordem: (a) abrir `/app/` e esperar a tela principal; (b) clicar cada `[role=tab][data-tab]` não escondido, esperando `aria-selected="true"`; (c) em Ajustes, escrever num campo de texto visível, disparar `change`, esperar 2,5 s e exigir ≥ 1 `save` gravado cujo `data` contenha o valor e cujo `JSON.stringify(data).length < 50000`; (d) **zero** eventos `pageerror` e zero `console.error` durante tudo.
- [ ] **Step 3: Rodar contra o código atual.** Esperado: exit 0. Se (b) ou (c) não funcionarem por detalhes de seletor, ajustar o roteiro, não o app.
- [ ] **Step 4: Commit** `test: roteiro de fumaça no navegador (abas, save, zero erros)`. Push.

### Task 4: Virar módulo sem cortar

**Files:**
- Modify: `app/index.html` (linha do `<script src="app.js">`, e os `on*=` inline), `app/sw.js`, `tests/helpers/cargar-app.js`
- Move: `app/app.js` → `app/js/main.js` (`git mv`)
- Create: `tests/handlers-inline.test.js`

**Interfaces:**
- Produces: `window.PM`, objeto único montado no fim de `main.js`, com exatamente estes 38 handlers: `salir alternarClave nuevaPieza abrirInsumos buscarMercado addAlPedido gastoSinVenta pegarLink abrirPegar nuevaIdea cargarRadarAgosto traerMundo enviarPresupuesto mandarWA registrarVenta vaciarPedido compartirPresupuesto descargarPresupuesto compartirVitrina bajarVitrina abrirPOS salirModoVenta cerrarPOS traerDeLaNubeManual subirAhora exportar addFil addImp addIns addPack addOpi addCanal abrirChatCad alternarTamanoMind cerrarChatCad confirmarChatCad enviarChatCad quitarFotoChat`.

- [ ] **Step 1: Escrever `tests/handlers-inline.test.js`** com `todo handler inline de app/index.html pasa por PM`: para cada atributo `on(click|change|input|keyup|submit)="…"` do HTML cuja expressão chama uma função global (ignorar os 6 que só fazem `document.getElementById('…').click()`), exigir o prefixo `PM.`; e um segundo `test` que exige que cada nome chamado exista como chave no objeto `window.PM = { … }` de `app/js/main.js`.
- [ ] **Step 2: Rodar.** Esperado: FAIL.
- [ ] **Step 3: Implementar.** `git mv app/app.js app/js/main.js`; no HTML trocar `<script src="app.js">` por `<script type="module" src="js/main.js">` (os scripts clássicos `vendor/*`, `presupuesto*.js` ficam antes e não mudam); reescrever cada `onclick="fn(`… por `onclick="PM.fn(`…; no fim de `main.js` montar `window.PM = { … }` com os 38 nomes. Antes, `grep` em `app/presupuesto-pdf.js` e `app/vendor/fredoka.js` por globais que viriam de `app.js`; se existir alguma, expô-la em `PM` ou em `window` explicitamente. Em `sw.js` trocar `'./app.js'` por `'./js/main.js'` e subir `CACHE`. Em `cargar-app.js` apontar para `app/js/main.js`.
- [ ] **Step 4: Rodar** `node --check app/js/main.js` (confirma que o `node --check` aceita sintaxe de módulo; se não, usar `node --input-type=module --check < app/js/main.js` daqui em diante), `node --test tests/*.test.js` → PASS, `node scripts/humo.js` → exit 0. No `humo.js` acrescentar: para cada handler listado acima, `typeof window.PM[nome] === "function"`.
- [ ] **Step 5: Commit** `refactor: app.js vira módulo ES (main.js) com handlers em window.PM`. Push.

### Task 5: `util`, `estado` e `ui`

**Files:**
- Create: `app/js/util.js`, `app/js/estado.js`, `app/js/ui.js`, `tests/estado.test.js`
- Modify: `app/js/main.js`, `app/sw.js`

**Interfaces:**
- `util.js` exporta os 10 helpers do cabeçalho (`$ el uid num money pct hhmm ceilTo hoy fechaCorta`).
- `estado.js` exporta `D` (`export let D`), `reemplazarEstado(x: object): void` (único lugar que faz `D = x`), `defaults`, `local`, `KEY`, `SERVIDOR`, `WORKER_CADASTRO`, `LOGO`, `LOGO_FULL` e o que mais as outras seções usarem (regra P2). As 3 reatribuições atuais de `D` (duas em `nube`, uma no boot) passam a chamar `reemplazarEstado(Object.assign(defaults(), …))`.
- `ui.js` exporta `toast(m: string): void`, `showTab(n: string): void`, `renderAll(): void`, `renderLight(): void` (as funções de `plumbing`; `tId` fica privado). Importa de `./main.js` o que ainda não foi extraído; as próximas tarefas repontam esses imports.

- [ ] **Step 1: Escrever `tests/estado.test.js`:** `reemplazarEstado cambia D visto por otros módulos` (`const E = await import("../app/js/estado.js"); E.reemplazarEstado({a:1}); assert.deepEqual(E.D, {a:1})`) e `defaults() trae v:2 y las listas vacías esperadas` (`produtos`, `vendas`, `radar`, `packs`, `opiniones`).
- [ ] **Step 2: Rodar.** Esperado: FAIL (módulo não existe).
- [ ] **Step 3: Extrair** `util.js`, depois `estado.js`, depois `ui.js`, cada um pelo Procedimento de extração (P1–P8).
- [ ] **Step 4: Rodar** `node --test tests/*.test.js` → PASS e `node scripts/humo.js` → exit 0 (inclui o roundtrip de `save`).

### Task 6: `calculo` e `stock`

**Files:**
- Create: `app/js/calculo.js`, `app/js/stock.js`
- Modify: `app/js/main.js`, `app/sw.js`, `tests/helpers/cargar-app.js`

**Interfaces:**
- `calculo.js` exporta `calc(p)`, `gramosCon`, `unitario` e `prod`; `cargarApp()` passa a devolver `{ calc, setD }` via `import()` de `util.js`, `estado.js`, `calculo.js` (sem `vm`), com `setD = reemplazarEstado`.

- [ ] **Step 1: Extrair `calculo`** (P1–P8). `tests/calculo-paridad.test.js` não muda; se o helper trocado fizer algum caso falhar, o módulo moveu algo errado.
- [ ] **Step 2: Extrair `stock`** (P1–P8).
- [ ] **Step 3: Rodar** `node --test tests/*.test.js` → PASS (paridade verde com o carregamento por `import()`) e `node scripts/humo.js` → exit 0.

### Task 7: `fotos`, `catalogo`, `editor`

**Files:**
- Create: `app/js/fotos.js`, `app/js/catalogo.js`, `app/js/editor.js`
- Modify: `app/js/main.js`, `app/sw.js`

**Interfaces:**
- `editor.js` fornece os handlers `nuevaPieza abrirInsumos buscarMercado addAlPedido gastoSinVenta` (continuam em `PM`, via import em `main.js`).

- [ ] **Step 1:** Extrair `fotos`, depois `catalogo`, depois `editor`, um commit cada (P1–P8). Esta é a "linha de corte" do spec: concluída a tarefa, tudo que o redesenho do catálogo toca (`catalogo`, `editor`, `fotos`, `calculo`, `estado`) já é módulo. Avisar Pedro aqui, com `git log --oneline`, que ele pode parar e começar o redesenho.
- [ ] **Step 2: Rodar** os testes e o `humo.js` depois de cada módulo.

### Task 8: `pedido`, `vitrina`, `pos`, `ventas`, `entrada`

**Files:**
- Create: `app/js/pedido.js`, `app/js/vitrina.js`, `app/js/pos.js`, `app/js/ventas.js`, `app/js/entrada.js`
- Modify: `app/js/main.js`, `app/sw.js`

**Interfaces:**
- `pedido` é dono de `armandoPresu` e `presuListo`; `pos` (seção `punto de venta`) é dona de `POS` e fornece `abrirPOS cerrarPOS salirModoVenta`; `entrada` fornece `salir alternarClave`. Handlers continuam em `PM`.

- [ ] **Step 1:** Extrair nesta ordem, um commit cada: `entrada`, `vitrina`, `pedido`, `pos`, `ventas` (P1–P8). `salirModoVenta` provavelmente reatribui `MODO_VENTA`: aplicar P3.
- [ ] **Step 2: Rodar** testes e `humo.js` depois de cada módulo.

### Task 9: `radar`, `chat`, `ajustes`

**Files:**
- Create: `app/js/radar.js`, `app/js/chat.js`, `app/js/ajustes.js`
- Modify: `app/js/main.js`, `app/sw.js`

**Interfaces:**
- `radar` é dono de `ORIGENES ESTADOS MUNDO MODO_VENTA PIEZA_PENDIENTE` e fornece `pegarLink abrirPegar nuevaIdea cargarRadarAgosto traerMundo`; `chat` é dono de `CHAT` e `MIND_GRANDE` e fornece `abrirChatCad alternarTamanoMind cerrarChatCad confirmarChatCad enviarChatCad quitarFotoChat`; `ajustes` é dono de `CFG_ATADO` e fornece `addFil addImp addIns addPack addOpi addCanal`.
- `radar` (892 linhas) entra **inteiro** num módulo; não dividir agora.

- [ ] **Step 1:** Extrair `radar`, `chat`, `ajustes`, um commit cada (P1–P8). `MODO_VENTA` e `PIEZA_PENDIENTE` são IIFEs de topo: aplicar P4 se leem outro módulo.
- [ ] **Step 2: Rodar** testes e `humo.js` depois de cada módulo.

### Task 10: `nube` e o que sobra de `main.js`

**Files:**
- Create: `app/js/nube.js`
- Modify: `app/js/main.js`, `app/sw.js`, `app/js/ui.js`

**Interfaces:**
- `nube.js` é dono de `syncTimer reintentoTimer avisoSyncPendiente listoParaSubir` e exporta `save`, `subirALaNube`, `bajarDeLaNube`, `sincronizarAlAbrir`, `setListoParaSubir(v: boolean): void` (o boot em `main.js` fazia `listoParaSubir = false`) e os handlers `traerDeLaNubeManual subirAhora exportar`.
- `main.js` termina contendo só: imports, chamada ordenada das `iniciar…()`, o registro do service worker, a IIFE de boot e `window.PM`. O `querySelectorAll("#posFormas button")` solto vai para `iniciarPos()`.

- [ ] **Step 1:** Extrair `nube` (P1–P8). As duas reatribuições de `D` em `nube` já usam `reemplazarEstado` (Task 5).
- [ ] **Step 2:** Repontar em `ui.js` e demais todo `import … from './main.js'` que sobrou para o módulo dono; `grep -n "from './main.js'" app/js/*.js` deve retornar vazio.
- [ ] **Step 3: Rodar** `node --test tests/*.test.js` → PASS, `node scripts/humo.js` → exit 0, e abrir `/app/` com `python3 -m http.server` conferindo à mão: login, uma venda, editar peça, conferir o catálogo.
- [ ] **Step 4: Commit e push.**

### Task 11: Documentação e fechamento

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1:** Atualizar o `CLAUDE.md`: linha de `app/app.js` no mapa de arquivos → `app/js/*.js` + `main.js`; a seção "Seções de `app/app.js`" vira a tabela módulo → responsabilidade → handlers; "Como trabalhar aqui" (`node --check app/js/*.js`, `node scripts/humo.js`, `tests/` com os arquivos novos); a dívida "`app.js` é um arquivo só" sai; acrescentar a regra de que arquivo novo em `app/js/` entra em `ARCHIVOS` (agora garantido por `tests/sw-archivos.test.js`).
- [ ] **Step 2: Rodar** `node --test tests/*.test.js` e `node scripts/humo.js`; conferir `git status` limpo e `app/app.js` inexistente.
- [ ] **Step 3: Commit** `docs: CLAUDE.md descreve a nova estrutura em módulos`. Push.
- [ ] **Step 4:** Reportar a Pedro: o que foi movido, o resultado do `round fraccionario` (Task 1), e que mergear na `main` (que publica o site) é decisão dele, de preferência fora do horário de pico e testando no celular instalado como PWA.
