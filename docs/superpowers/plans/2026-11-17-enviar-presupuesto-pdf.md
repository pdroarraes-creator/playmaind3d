# Enviar presupuesto en PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão na aba Pedido que gera um PDF de orçamento com a marca (fotos, valores, número, validade) e o compartilha pelo menu do celular (WhatsApp).

**Architecture:** Lógica pura (montar dados, numerar, histórico, nome de arquivo) em `app/presupuesto.js`, testável em Node. Desenho do PDF em `app/presupuesto-pdf.js` com jsPDF guardado no repo. `app/app.js` só liga o botão. O Apps Script ganha `action:"foto"` como plano B para fotos que o navegador não consegue ler.

**Tech Stack:** JS puro sem build (scripts clássicos), jsPDF 2.5.x UMD em `app/vendor/`, fonte Fredoka SemiBold embutida, `node --test` só para testes (não vai pro app), Google Apps Script.

**Spec:** `docs/superpowers/specs/2026-11-17-enviar-presupuesto-pdf-design.md`

## Global Constraints

- Interface e código em espanhol (es-AR); conversa com o dono em português.
- Sem build step: o que está no repo é o que vai pro ar. `node` e `npm` só para testes/baixar vendor, nunca exigidos pelo app.
- Estado `D` serializado ≤ 50.000 caracteres: nunca guardar PDF nem imagem em `D`. Histórico = últimos 30, campos `{n, f, c, t}`.
- Mudou o shape de `D` → migração chamada nos 3 pontos onde hoje se chama `migrarStockVentas()` (linhas ~4370, ~4456, ~4557 de `app/app.js`).
- O PDF nunca mostra custo, lucro, comissão nem horas.
- Validade padrão `7` dias, editável em Ajustes. Número com 3 dígitos: `N° 042`.
- Paleta: teal `#2C7A7B`, azul-céu `#7FB8D3`, coral `#F4A97F`, dourado `#C9A227`, fundo `#FAF6EE`.
- Arquivo novo em `app/` → entra em `ARCHIVOS` de `app/sw.js` e `CACHE` passa de `playmind3d-v23` para `playmind3d-v24`.
- Alterou `server/Codigo.gs` → lembrar Pedro: Implementar › Administrar implementaciones › lápis › Versión: NUEVA.
- Botão atual "Mandar por WhatsApp" (`mandarWA()`) continua funcionando, agora como secundário.

## Review Focus

1. Peça sem foto, ou foto que falha (offline, Google bloqueia, Apps Script fora) → PDF sai mesmo assim, com quadro azul-céu no lugar. (teste em Task 3)
2. Cliente vazio, com acento ou com emoji → nome de arquivo seguro (`Presupuesto-042-Maria-Jose.pdf` / `Presupuesto-042.pdf`). (teste em Task 1)
3. Pedido com muitas peças ou nome de peça longo → quebra de linha e página nova, nada cortado. (teste em Task 3)
4. Aparelho/navegador sem `navigator.canShare({files})` ou usuário cancela o compartilhar → baixa o PDF e não mostra erro ao cancelar. (verificação manual em Task 4)
5. Pedido vazio → toast "El pedido está vacío." e não consome número. (teste em Task 1 + manual em Task 4)

---

### Task 1: Modelo do presupuesto (lógica pura)

**Files:**
- Create: `app/presupuesto.js`
- Create: `tests/presupuesto.test.js`
- Modify: `app/app.js` (chamar `migrarPresupuestos(D)` nos 3 pontos de migração)

**Interfaces:**
- Produces (globais no navegador, e `module.exports` quando `typeof module !== "undefined"`):
  - `migrarPresupuestos(D) -> void` — garante `D.presupuestos = []`, `D.cfg.presupNum = 0`, `D.cfg.presupDias = 7` se ausentes; não altera valores existentes.
  - `siguienteNumero(cfg) -> number` — incrementa e devolve `cfg.presupNum`.
  - `numeroTxt(n) -> string` — `42 → "042"`, `1234 → "1234"`.
  - `fechaTxt(date) -> string` — `dd/mm/aaaa`.
  - `armarPresupuesto(tot, opts) -> Presu`, onde `tot` é o retorno de `pedidoTotales()` e `opts = {n, cliente, fecha: Date, dias, marca, wa, ig, colorDe: (fil)=>string}`. `Presu = {n, numero, fecha, valido, cliente, marca, wa, ig, items:[{nome, color, q, unit, sub, foto}], bruto, descPct, descMonto, envio, total}`. `foto` = `p.fotos[0] || p.foto || ""`. Sem `custo/lucro/horas/com`.
  - `nombreArchivo(presu) -> string`.
  - `registrar(lista, presu) -> Array<{n, f, c, t}>` — adiciona no fim e mantém só os últimos 30; `f` = ISO `aaaa-mm-dd`.
  - `textoCompartir(presu) -> string`.

- [ ] **Step 1: Escrever os testes** em `tests/presupuesto.test.js` (`node:test` + `node:assert/strict`, `require("../app/presupuesto.js")`):
  - `migra sin pisar`: `{cfg:{}}` → `presupuestos` `[]`, `presupNum` `0`, `presupDias` `7`; `{cfg:{presupNum:5, presupDias:10}, presupuestos:[{n:5}]}` fica igual.
  - `numera`: `cfg={presupNum:41}` → `siguienteNumero(cfg) === 42` e `cfg.presupNum === 42`; `numeroTxt(42) === "042"`, `numeroTxt(7) === "007"`, `numeroTxt(1234) === "1234"`.
  - `arma sin datos internos`: com 2 itens (q 2 × preco 3000, q 1 × preco 5000), `desc 0.1`, `envio 1500`, `fecha 2026-11-17`, `dias 7` → `bruto 11000`, `descMonto 1100`, `total 11400`, `items[0].sub 6000`, `valido "24/11/2026"`, `fecha "17/11/2026"`; `JSON.stringify(presu)` não contém `custo`, `lucro`, `horas`, `com`.
  - `foto`: item com `fotos:["a","b"]` → `"a"`; só `foto:"x"` → `"x"`; nenhum → `""`.
  - `archivo`: cliente `"María José 🎉"`, n 42 → `"Presupuesto-042-Maria-Jose.pdf"`; cliente `""` → `"Presupuesto-042.pdf"`.
  - `historial`: 35 chamadas de `registrar` → `length 30`, primeiro `n` é `6`; entrada tem exatamente as chaves `n,f,c,t`.
  - `texto`: `textoCompartir` contém `"Presupuesto N° 042"` e `"$11.400"` (formato `"$" + Math.round(v).toLocaleString("es-AR")`, igual a `money()` do app).
- [ ] **Step 2:** `node --test tests/` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `app/presupuesto.js` com as assinaturas acima. Acentos via `normalize("NFD")` + remover diacríticos; manter só `[A-Za-z0-9]`, espaços viram `-`, sem `-` repetido ou nas pontas. `textoCompartir`: `"¡Hola <cliente>! Te paso el Presupuesto N° 042 de <marca>: total $11.400, válido hasta 24/11/2026. Se imprime a pedido 🎨"` (sem `" <cliente>"` se vazio).
- [ ] **Step 4:** `node --test tests/` → PASS.
- [ ] **Step 5:** Em `app/app.js`, chamar `migrarPresupuestos(D);` logo depois de cada `migrarStockVentas();` (3 lugares). Em `app/index.html`, `<script src="presupuesto.js"></script>` antes de `app.js`.
- [ ] **Step 6: Commit** `feat(pedido): modelo de presupuesto, numeración e historial`

### Task 2: Plano B das fotos no Apps Script

**Files:**
- Modify: `server/Codigo.gs` (`doPost`, depois de `validarSesion`)

**Interfaces:**
- Produces: `POST {action:"foto", token, id}` → `{ok:true, mime, b64}` ou `{ok:false, error:"no-imagen"|"no-existe"}`. Só depois da checagem de token já existente.

- [ ] **Step 1:** Adicionar `fotoBase64_(id)`: `DriveApp.getFileById(id)` em `try`; se `getMimeType()` não começa com `image/` → `no-imagen`; senão `Utilities.base64Encode(blob.getBytes())`.
- [ ] **Step 2:** Verificar no editor do Apps Script com uma função de teste temporária `probarFoto_()` passando o id de uma foto real (tirado de uma URL `lh3.googleusercontent.com/d/<id>`) → log com `ok:true` e `mime` `image/...`; e com o id de uma planilha → `no-imagen`. Apagar a função de teste.
- [ ] **Step 3: Commit** `feat(server): action foto para el PDF de presupuesto` — e avisar Pedro da "Nueva versión".

### Task 3: Desenho do PDF

**Files:**
- Create: `app/vendor/jspdf.umd.min.js` (jsPDF 2.5.2, de `npm pack jspdf@2.5.2` → `package/dist/jspdf.umd.min.js`)
- Create: `app/vendor/fredoka.js` (Fredoka SemiBold em base64; origem `npm pack @expo-google-fonts/fredoka` → `Fredoka_600SemiBold.ttf`; arquivo define `var FREDOKA_B64 = "...";`)
- Create: `app/presupuesto-pdf.js`
- Create: `tests/presupuesto-pdf.test.js`

**Interfaces:**
- Consumes: `Presu` (Task 1); `POST action:"foto"` (Task 2) via função `pedirFoto` injetada.
- Produces:
  - `idDeDrive(url) -> string|null` — extrai `<id>` de `https://lh3.googleusercontent.com/d/<id>`.
  - `async cargarImagen(url, pedirFoto) -> {data, w, h} | null` — 1º `fetch(url)` → blob → dataURL; se falhar e `idDeDrive(url)`, `await pedirFoto(id)` → `data:<mime>;base64,<b64>`; senão `null`. Nunca lança erro.
  - `async generarPdf(presu, {logo, pedirFoto, cargar = cargarImagen}) -> Blob` (no Node, `jsPDF.output("arraybuffer")` via opção `{salida:"arraybuffer"}`).

Layout A4 retrato, margem 15 mm, fundo `#FAF6EE`: faixa teal no topo com logo (`/assets/logo-app.png`) e nome da marca em Fredoka branca; à direita "Presupuesto N° 042", data e "Válido hasta …". Linha "Para: <cliente>" se houver. Tabela: foto 22×22 mm (ou quadro `#7FB8D3` arredondado), nome (quebra com `splitTextToSize`) e "Color: …" abaixo, quantidade, unitário, subtotal à direita. Página nova quando a linha não couber (repete o cabeçalho da tabela). Bloco de totais: Subtotal, Descuento (-x%) se >0, Envío se >0, **Total** em caixa coral. Rodapé dourado fino + "Se imprime a pedido · elegís el color" + WhatsApp + @playmind3d. Fredoka só nos títulos; resto Helvetica.

- [ ] **Step 1: Escrever os testes** (`node:test`; carregar `jspdf.umd.min.js` e `fredoka.js` com `vm.runInThisContext` e expor `globalThis.jspdf`; `cargar` falso):
  - `idDeDrive`: `"https://lh3.googleusercontent.com/d/ABC_12-x"` → `"ABC_12-x"`; `"https://x.com/a.png"` → `null`.
  - `sin foto no rompe`: `cargar` sempre `null` → `generarPdf` resolve; texto do PDF (gerado com `compress:false`) contém `"Presupuesto N"`, `"042"`, `"Total"`, `"$11.400"`; não contém `"lucro"` nem `"costo"`.
  - `muchas piezas`: 25 itens, um com nome de 120 caracteres → número de páginas ≥ 2 (`doc.getNumberOfPages()`), sem exceção.
  - `cargarImagen`: `fetch` global falso que rejeita + `pedirFoto` que devolve `{ok:true,mime:"image/png",b64:"AAA"}` → `data` começa com `"data:image/png;base64,"`; `pedirFoto` que rejeita → `null`.
- [ ] **Step 2:** `node --test tests/` → os novos FAIL.
- [ ] **Step 3:** Baixar vendor (jsPDF e Fredoka) e implementar `app/presupuesto-pdf.js` segundo o layout acima.
- [ ] **Step 4:** `node --test tests/` → tudo PASS. Gerar um PDF de exemplo pelo teste (`tests/salida-ejemplo.pdf`, no `.gitignore`) e abrir para conferência visual.
- [ ] **Step 5: Commit** `feat(pedido): PDF de presupuesto con la marca`

### Task 4: Botão, Ajustes e publicação

**Files:**
- Modify: `app/index.html` (aba Pedido, linha ~383; Ajustes, bloco de `s_wa` ~linha 552; scripts antes de `app.js`)
- Modify: `app/app.js` (seção `pedido`, perto de `mandarWA()`; seção `ajustes`, perto de `s_wa`)
- Modify: `app/app.css` (só se precisar destacar o botão)
- Modify: `app/sw.js`

**Interfaces:**
- Consumes: Task 1 inteira; `generarPdf`, `cargarImagen` (Task 3); `pedir({action:"foto", email, token, id})` já existente em `app.js`.
- Produces: `async enviarPresupuesto() -> void`.

- [ ] **Step 1:** `index.html`: antes de "Mandar por WhatsApp", botão `<button class="btn" onclick="enviarPresupuesto()">Enviar presupuesto (PDF)</button>`; o de WhatsApp passa a `btn ghost`. Scripts na ordem `vendor/jspdf.umd.min.js`, `vendor/fredoka.js`, `presupuesto.js`, `presupuesto-pdf.js`, `app.js`. Em Ajustes, campo `s_presupDias` (number, min 1) "Validez del presupuesto (días)".
- [ ] **Step 2:** `enviarPresupuesto()`: pedido vazio → `toast("El pedido está vacío.")` e sai (não numera). Senão toast "Armando el presupuesto…", `siguienteNumero(D.cfg)`, `armarPresupuesto(pedidoTotales(), {…, cliente: $("#p_cli").value.trim(), fecha: new Date(), dias: D.cfg.presupDias, marca: D.cfg.marca || "PlayMind 3d", wa: D.cfg.wa, ig: "@playmind3d", colorDe})`, `generarPdf`, `D.presupuestos = registrar(D.presupuestos, presu)`, `save()`. Depois: se `navigator.canShare && navigator.canShare({files:[file]})` → `navigator.share({files:[file], text: textoCompartir(presu)})`, ignorando `AbortError`; senão baixar via `<a download>` e abrir `https://wa.me/?text=` + `textoCompartir`. Qualquer outro erro → `toast("No pude armar el PDF. Probá de nuevo.")`. `colorDe(fil)`: filamento de `D.filamentos` → `cor || nome`; sem filamento → `"el que elijas"`.
- [ ] **Step 3:** Ajustes: mostrar `D.cfg.presupDias` e, no `input`, `D.cfg.presupDias = Math.max(1, num(valor)); save();` (mesmo padrão de `s_wa`, oyente atado uma vez).
- [ ] **Step 4:** `sw.js`: `CACHE = 'playmind3d-v24'`; adicionar `'./presupuesto.js', './presupuesto-pdf.js', './vendor/jspdf.umd.min.js', './vendor/fredoka.js'` em `ARCHIVOS`.
- [ ] **Step 5:** `node --test tests/` → PASS. Servir local (`npx serve .` no Codespaces) e no Chrome com 2 peças (uma sem foto) + cliente "María": clicar → PDF baixado no desktop com N° 001, validade +7 dias, foto/quadro, totais certos; pedido vazio → toast e `D.cfg.presupNum` não muda.
- [ ] **Step 6:** Push; no Android (Chrome, app instalado) abrir o app, conferir versão nova (recarregar 2×), gerar orçamento → menu compartilhar → WhatsApp com PDF anexado; cancelar o compartilhar não mostra erro.
- [ ] **Step 7: Commit** `feat(pedido): botón Enviar presupuesto (PDF)`
