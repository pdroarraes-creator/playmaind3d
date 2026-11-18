# Categorías múltiples y catálogos especializados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lista de categorias gerenciada, várias categorias por peça, filtro no app e no site, e catálogo especializado por categoria (link filtrado + PDF).

**Architecture:** Regras puras de categoria em `app/categorias.js` (testáveis em Node), espelhadas em `server/Codigo.gs` com teste de paridade. O PDF do catálogo reaproveita o motor de `app/presupuesto-pdf.js`. App, site e worker só consomem essas regras.

**Tech Stack:** JS puro sem build, jsPDF (já em `app/vendor/`), Google Apps Script, Cloudflare Worker (ESM), `node --test`, Playwright + Chrome para verificação de tela.

**Spec:** `docs/superpowers/specs/2026-11-18-categorias-design.md`

## Global Constraints

- Interface e código em es-AR; commits em **português**.
- Sem build: o que está no repo vai pro ar.
- Fonte da verdade = `p.cats` (array de nomes). `p.cat` = sempre `p.cats[0] || ""` (espelho).
- `D.categorias` = array de nomes em ordem. Comparação por slug (minúsculas, sem acento): `slugCat("Biología") === "biologia"`.
- Lista inicial (as que faltarem): `["Decoración", "Halloween", "Navidad", "Sensoriales", "Biología"]`, depois das já usadas nas peças.
- Peça nunca perde categoria: nome em `p.cats` fora de `D.categorias` entra no fim da lista.
- App antigo em cache: `p.cat` não vazio e fora de `p.cats` (por slug) → vira `p.cats[0]` (substitui o antigo primeiro).
- Chat de cadastro: só escolhe categorias existentes; nome desconhecido é ignorado, nunca cria.
- Migração nos 3 pontos onde hoje se chama `migrarPresupuestos(D);` em `app/app.js`.
- Mudou `server/Codigo.gs` → lembrar "Nueva versión". Mudou worker → lembrar `npx wrangler deploy` em `cadastro-worker/`.
- Arquivo novo em `app/` → `ARCHIVOS` de `app/sw.js`; `CACHE` de `playmind3d-v24` para `playmind3d-v25`.
- PDF nunca mostra custo/lucro/horas e não inclui peças com `oculta`.
- Teste: `node --test 'tests/*.test.js'`.

## Review Focus

1. Peça sem categoria → aparece em "Todas" no app e no site; na Vitrina vai para "Otras creaciones". (teste Task 1 `piezasDeCategoria` + verificação Task 5/6)
2. Variações de escrita ("navidad", "Biologia", " Navidad ") → mesma categoria, sem duplicar. (teste Task 1)
3. Renomear para um nome que já existe → as duas se fundem, sem duplicata em `D.categorias` nem em `p.cats`. (teste Task 1)
4. Apagar categoria usada → confirma com o número de peças; peça mantém as outras categorias; `p.cat` reajustado. (teste Task 1)
5. `?cat=` desconhecido, ou categoria sem peça visível → site sem filtro e sem erro; Catálogo PDF de categoria vazia → toast "No hay piezas visibles en esta categoría." (teste Task 4 + verificação Task 6)

---

### Task 1: Regras de categoria (puras) + migração no app

**Files:**
- Create: `app/categorias.js`, `tests/categorias.test.js`
- Modify: `app/app.js` (3 pontos de migração; `accionEditarPieza` ~linha 2704), `app/index.html` (script antes de `app.js`), `app/sw.js`

**Interfaces (globais no navegador, `module.exports` em Node; mesmo padrão de `app/presupuesto.js`):**
- `CATS_INICIALES: string[]`
- `slugCat(nombre) -> string`
- `migrarCategorias(D) -> void` — cria `D.categorias`, `p.cats`, aplica a regra do app antigo, repara órfãos, reajusta `p.cat`. Idempotente.
- `catsDesdeTexto(texto, lista, {crear}) -> {cats: string[], nuevas: string[]}` — divide por vírgula, casa por slug com `lista` devolvendo o nome da lista; desconhecidos entram em `nuevas` e em `cats` só se `crear` true.
- `ponerCats(p, cats) -> void` — dedup por slug, grava `p.cats` e `p.cat`.
- `agregarCategoria(D, nombre) -> string|null` — devolve o nome guardado (existente se slug igual), `null` se vazio.
- `renombrarCategoria(D, viejo, nuevo) -> void` — se `nuevo` já existe, funde.
- `moverCategoria(D, nombre, delta) -> void` — `delta` −1/+1.
- `borrarCategoria(D, nombre) -> number` — devolve quantas peças tinham a categoria.
- `usoCategoria(produtos, nombre) -> number`
- `piezasDeCategoria(produtos, nombre) -> produto[]` — `nombre` vazio = todas; casa por slug.
- `linkCategoria(nombre, base = "https://playmind3d.com/") -> string` — `base + "?cat=" + slugCat(nombre)`.
- `unirCategorias(a, b) -> string[]` — ordem de `a`, depois os de `b` que faltam (por slug).

- [ ] **Step 1: Testes** em `tests/categorias.test.js`:
  - `slug`: `slugCat(" Biología ") === "biologia"`, `slugCat("Decoración") === "decoracion"`.
  - `migra desde cat`: `{cfg:{}, produtos:[{cat:"Sensoriales"},{cat:""},{cat:"sensoriales"},{cat:"Llaveros"}]}` → `categorias` = `["Sensoriales","Llaveros","Decoración","Halloween","Navidad","Biología"]`; `produtos[0].cats` `["Sensoriales"]`, `[1].cats` `[]`, `[2].cats` `["Sensoriales"]` e `[2].cat` `"Sensoriales"`; rodar duas vezes dá o mesmo resultado.
  - `repara huérfanos`: `categorias:["Navidad"]`, peça `cats:["Halloween"]` → `categorias` termina com `"Halloween"`.
  - `app viejo`: peça `cats:["Navidad","Sensoriales"], cat:"Halloween"` com `"Halloween"` na lista → `cats` `["Halloween","Sensoriales"]`.
  - `texto`: lista `["Navidad","Biología"]`; `catsDesdeTexto("navidad, Natal ,biologia", lista, {crear:false})` → `cats` `["Navidad","Biología"]`, `nuevas` `["Natal"]`; com `crear:true` → `cats` `["Navidad","Natal","Biología"]`.
  - `renombra y funde`: peças `cats:["Natal"]` e `cats:["Natal","Navidad"]`, lista `["Navidad","Natal"]`; `renombrarCategoria(D,"Natal","navidad")` → lista `["Navidad"]`, peças `["Navidad"]` e `["Navidad"]`.
  - `borra`: 2 peças com `"Halloween"` (uma também `"Sensoriales"`) → retorna `2`; lista sem `"Halloween"`; peças `[]` (cat `""`) e `["Sensoriales"]` (cat `"Sensoriales"`).
  - `mueve`: `["A","B","C"]`, mover `"C"` −1 → `["A","C","B"]`; mover `"A"` −1 → igual.
  - `filtra`: `piezasDeCategoria(ps, "")` devolve todas; `piezasDeCategoria(ps, "navidad")` devolve só as com `"Navidad"`.
  - `link`: `linkCategoria("Biología") === "https://playmind3d.com/?cat=biologia"`.
  - `une`: `unirCategorias(["B","A"], ["a","C"])` → `["B","A","C"]`.
- [ ] **Step 2:** `node --test 'tests/*.test.js'` → os novos FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `app/categorias.js`.
- [ ] **Step 4:** Testes → PASS.
- [ ] **Step 5:** `app.js`: `migrarCategorias(D);` logo após cada `migrarPresupuestos(D);`. `accionEditarPieza`: `if (a.categoria != null) ponerCats(p, catsDesdeTexto(a.categoria, D.categorias, { crear: false }).cats);`. `index.html`: `<script src="categorias.js"></script>` antes de `presupuesto.js`. `sw.js`: `CACHE` v25 e `'./categorias.js'` em `ARCHIVOS`. `node --check app/app.js`.
- [ ] **Step 6: Commit** `feat(categorias): regras de categoria e migração das peças`

### Task 2: Servidor

**Files:**
- Modify: `server/Codigo.gs`
- Create: `tests/servidor-categorias.test.js`

**Interfaces:**
- Consumes: as regras da Task 1 (mesmo comportamento, reescrito em ES5 no `.gs`).
- Produces: `slugCat_`, `migrarCategorias_(data)`, `catsDesdeTexto_(texto, lista, crear)` (retorna `{cats, nuevas}`), `ponerCats_(p, cats)`; `leerEstadoYV_` devolve `data` já migrado; `fusionar_` une `categorias` com `unirCategorias` (lista do cliente primeiro); `catalogoPublico_()` → cada peça com `cats: [...]` e o objeto de retorno com `categorias: [...]` (ordem de `data.categorias`, só as com peça visível); `agregarPieza_(pieza)` aceita `pieza.cats` (array) ou `pieza.cat` (texto), com `crear: !pieza.catSoloExistentes` (nome novo vai pro fim da lista; vindo do chat não cria); `editarPieza_(nombre, campos)` aceita `campos.cats` (array, `crear: true`) e `campos.cat` (texto, `crear: true`); `resumenNegocio_` → cada peça `cat: cats.join(", ")` e o retorno com `categorias`; exportação (~linha 882) usa `cats.join(", ")`.

- [ ] **Step 1: Testes** (carregar `Codigo.gs` com `vm`, como `tests/servidor-foto.test.js`):
  - `paridad`: para os mesmos 4 casos de entrada de `migra desde cat`, `app viejo`, `repara huérfanos` e `texto` da Task 1, `migrarCategorias_`/`catsDesdeTexto_` dão exatamente o mesmo resultado que `migrarCategorias`/`catsDesdeTexto` de `app/categorias.js` (`assert.deepEqual` contra a versão do app).
  - `fusionar une categorías`: servidor `{categorias:["Navidad","Biología"], produtos:[]}`, cliente `{categorias:["Halloween","navidad"], produtos:[]}` → resultado `categorias` `["Halloween","navidad","Biología"]`.
  - `agregar desde chat no crea`: com `leerEstadoYV_`/`guardarEstado_` stubados sobre um estado em memória com `categorias:["Navidad"]`, `agregarPieza_({nome:"X", preco:100, cat:"Natal, navidad", catSoloExistentes:true})` → peça com `cats` `["Navidad"]` e lista inalterada; sem `catSoloExistentes` → `cats` `["Natal","Navidad"]` e `"Natal"` no fim da lista.
  - `fusionar repara`: depois de `fusionar_` + `migrarCategorias_`, peça vinda só do servidor com `cats:["Biología"]` mantém a categoria e `"Biología"` está na lista.
- [ ] **Step 2:** Testes → FAIL.
- [ ] **Step 3:** Implementar no `Codigo.gs` (migração chamada em `leerEstadoYV_` logo após o `JSON.parse`; demais pontos conforme Produces).
- [ ] **Step 4:** Testes → PASS.
- [ ] **Step 5: Commit** `feat(server): categorias múltiplas no estado, catálogo público e fusão`

### Task 3: Chat de cadastro (worker)

**Files:**
- Modify: `cadastro-worker/src/gemini.js`, `cadastro-worker/src/index.js`
- Create: `tests/worker-categorias.test.js`

**Interfaces:**
- Consumes: `resumenNegocio_` com `categorias` (Task 2); `agregarPieza_` aceitando `cat` texto (Task 2).
- Produces: `cadastrar_peca` com propriedade `categorias: {type:"string", description:"Uma ou mais das categorias existentes, exatamente como na lista, separadas por vírgula. Nunca invente categoria."}`; `editar_peca.categoria` com a mesma descrição; `traducirParaAgregarPieza` exportado (`export function`) e devolvendo `cat: propuesta.categorias || ""`.

O servidor (Task 2) já respeita `catSoloExistentes`.

- [ ] **Step 1: Testes** (`import()` dinâmico de `../cadastro-worker/src/index.js`): `traducirParaAgregarPieza({nome:"X", preco:100, categorias:"Navidad, Sensoriales"})` → `cat` `"Navidad, Sensoriales"`, `catSoloExistentes` `true`; sem `categorias` → `cat` `""`. Ler `gemini.js` como texto e verificar que contém `categorias` dentro do bloco de `cadastrar_peca` e a frase `"Nunca invente categoria"`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(cadastro): chat sugere só categorias existentes`

### Task 4: Catálogo PDF

**Files:**
- Modify: `app/categorias.js` (dados), `app/presupuesto-pdf.js` (desenho), `tests/categorias.test.js`, `tests/presupuesto-pdf.test.js`

**Interfaces:**
- Consumes: `piezasDeCategoria`, `linkCategoria` (Task 1); `cargarImagen` e helpers internos de `presupuesto-pdf.js`.
- Produces:
  - `armarCatalogo(produtos, nombre, {precioDe:(p)=>number, fecha:Date, marca, wa, ig}) -> Cat` em `categorias.js`, `Cat = {titulo, nombre, fecha, link, marca, wa, ig, items:[{nome, precio, foto, color}]}`; exclui `oculta`; `color` = `p.libre ? "" : "Elegís el color"`; ordenado por nome; `titulo = "Catálogo · " + nombre`.
  - `nombreArchivoCatalogo(nombre) -> "Catalogo-" + nome sem acento/espaços + ".pdf"` (ex. `"Catalogo-Biologia.pdf"`).
  - `async generarCatalogoPdf(cat, deps) -> Blob|ArrayBuffer|doc` em `presupuesto-pdf.js`, mesmas `deps` de `generarPdf` (`logo`, `pedirFoto`, `cargar`, `salida`, `comprimir`). Cabeçalho igual ao do presupuesto com "CATÁLOGO" e o nome da categoria; grade de 3 colunas (foto quadrada, nome com quebra, preço em destaque, linha de cor); página nova quando não couber; rodapé com WhatsApp, @playmind3d e o `link`.
- [ ] **Step 1: Testes:** `armarCatalogo` com 3 peças (uma `oculta`, uma em outra categoria) para `"Navidad"` → 1 item, sem chaves `custo/lucro/horas`, `link` `"https://playmind3d.com/?cat=navidad"`; `nombreArchivoCatalogo("Biología") === "Catalogo-Biologia.pdf"`. PDF: `generarCatalogoPdf` com `cargar` nulo e `comprimir:false` contém `"$5.000"`, `"Navidad"` e `"playmind3d.com/?cat=navidad"`; com 20 itens → `getNumberOfPages() >= 2`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar, extraindo do `generarPdf` o cabeçalho e o rodapé para funções internas reutilizadas (sem mudar o PDF do presupuesto — os testes atuais dele continuam verdes). **Step 4:** PASS + gerar `tests/salida-catalogo.pdf` (no `.gitignore`) e conferir visualmente.
- [ ] **Step 5: Commit** `feat(categorias): PDF de catálogo por categoria`

### Task 5: Telas do app

**Files:**
- Modify: `app/index.html`, `app/app.js`, `app/app.css`

**Interfaces:**
- Consumes: Tasks 1 e 4; `comoEntregar`/`despuesDeCompartir` e o padrão da caixa `#presuListo` do presupuesto.
- Produces: `renderCategoriasCfg()`, `renderChipsCat()`, `catActiva` (string, `""` = todas), `async enviarCatalogo()`, `copiarLinkCat()`.

- [ ] **Step 1: Ajustes** — card "Categorías" depois do card de marca: uma linha por categoria com nome editável (renomeia no `change`), "↑", "↓", "Borrar" (`confirm("¿Borrar «X»? La usan N piezas.")`), e embaixo input + botão "Agregar". Cada ação chama a função da Task 1, `save()`, `renderAll()`.
- [ ] **Step 2: Editor da peça** — trocar o input `#c_cat` + datalist por `<div id="c_cats">` com chips marcáveis (um por categoria, classe `on` quando marcada) e um chip "+ nueva" (`prompt("Nombre de la categoría")` → `agregarCategoria` e já marca). `piezaActual()` grava `cats` (array) e `cat` (`cats[0]||""`); `cargarPieza(p)` marca as de `p.cats`. Tirar `"c_cat"` da lista de `input` → `renderCalc`.
- [ ] **Step 3: Catálogo** — `<div id="catChips">` acima de `#catList`: "Todas" + uma por categoria **com uso > 0**, na ordem da lista. `renderCat()` filtra por `piezasDeCategoria(D.produtos, catActiva)` antes da busca, e a busca também casa com `cats`. Com `catActiva` ≠ `""`, mostrar barra com "Copiar link" (`navigator.clipboard.writeText(linkCategoria(catActiva))` + toast "Link copiado") e "Catálogo PDF" (`enviarCatalogo()`).
- [ ] **Step 4: `enviarCatalogo()`** — `armarCatalogo` com `precioDe: (p) => calc(Object.assign({}, p, { fil: p.fil })).preco`; 0 itens → toast `"No hay piezas visibles en esta categoría."`; senão `generarCatalogoPdf`, e entrega igual ao presupuesto (mesma caixa `#presuListo`, título "PDF listo — Catalogo-X.pdf"; generalizar `presuListo` para guardar `{blob, nombre, texto}` com `texto = "Te paso el catálogo de " + nombre + " de " + marca + ": " + link`).
- [ ] **Step 5: Vitrina** — `agrupado()` usa a ordem de `D.categorias` e `p.cats` (peça em vários grupos); sem categoria → "Otras creaciones", no fim.
- [ ] **Step 6:** `node --check app/app.js`; testes PASS; Playwright + Chrome em `python3 -m http.server`: criar "Biología" em Ajustes, marcar em uma peça junto com "Sensoriales", conferir que ela aparece nos dois chips do Catálogo e nos dois grupos da Vitrina; renomear "Biología"→"Biologia Celular" e conferir a peça; "Catálogo PDF" baixa `Catalogo-Biologia-Celular.pdf`; categoria sem peça não vira chip; apagar mostra o confirm com a contagem.
- [ ] **Step 7: Commit** `feat(categorias): Ajustes, editor, filtros e catálogo PDF no app`

### Task 6: Site público

**Files:**
- Modify: `index.html` (raiz)

**Interfaces:**
- Consumes: `catalogoPublico_` com `piezas[].cats` e `categorias` (Task 2). Fallback quando o servidor ainda não foi atualizado: `cats = p.cats || (p.cat ? [p.cat] : [])` e `categorias` = nomes distintos das peças.
- Produces: `CATEGORIAS` (array global do site), filtro por `slug` dentro de `p.cats`.

- [ ] **Step 1:** Guardar `CATEGORIAS` ao carregar o catálogo. `pintarChips()` usa a ordem de `CATEGORIAS` (sem `sort()`); `pasaFiltro` usa `cats.some(c => slug(c) === slug(FILTRO.cat))`; a busca de texto inclui todas as `cats`; a etiqueta do card (`.cat`) mostra `cats.join(" · ")` ou `"Pieza"`.
- [ ] **Step 2:** `?cat=<slug>`: se casa com alguma de `CATEGORIAS`, `ponerFiltro({cat: nome})` ao carregar e o título "Las piezas" vira `"Las piezas · " + nome`; se não casa, nada muda. Trocar de filtro atualiza o título (volta a "Las piezas" em "Todas").
- [ ] **Step 3:** Modo de edição: o campo Categoría vira caixinhas com `CATEGORIAS` (marcadas as de `p.cats`) + input "Otra" opcional; salvar manda `campos.cats` (array) em vez de `cat`.
- [ ] **Step 4:** Playwright + Chrome com o fetch do catálogo interceptado (`page.route`) devolvendo 4 peças (uma em `["Navidad","Sensoriales"]`, uma sem categoria) e `categorias:["Navidad","Sensoriales","Halloween"]`: chips na ordem `Todas, Navidad, Sensoriales` (Halloween sem peça visível não aparece porque o servidor não manda — conferir que o site não quebra se mandar); a peça dupla aparece nos dois filtros; `?cat=navidad` abre filtrado com "Las piezas · Navidad"; `?cat=xyz` abre sem filtro; resposta antiga só com `cat` também funciona.
- [ ] **Step 5: Commit** `feat(site): filtros pela lista de categorias e link ?cat=`
