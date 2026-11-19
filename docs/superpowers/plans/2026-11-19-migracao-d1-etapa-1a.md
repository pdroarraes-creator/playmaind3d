# Migração para o D1 — Etapa 1a (API do Worker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o Worker `playmind3d-api` falar o mesmo contrato do Apps Script (`load`, `save` com fusão, rotas que gravam o estado, catálogo público) e dar ao Apps Script as ações novas e a chave de migração, tudo testado e publicado só no staging, sem mudar o que a família usa.

**Architecture:** `api-worker/src/` ganha módulos pequenos e testáveis sem rede: `fusionar.js`, `sesion.js` (valida token no Apps Script com cache), `fotos.js`, `rutas.js` (registro `ACCIONES` + `manejarPost`), `acciones.js`, `catalogo.js`; `index.js` só converte `Request`↔`Response`. O Apps Script (`server/Codigo.gs`) recebe `subirFotos`, `guardarSnapshot` e a chave `d1:migrado`. Toda cópia de regra que já existe no servidor (`fusionar_`, `catalogoPublico_`, `resumenNegocio_`) tem teste de paridade rodando o `Codigo.gs` real num `vm`.

**Tech Stack:** JS puro ESM no Worker; `node:test`; `node:sqlite` só em testes (fake D1 já existente); Cloudflare Workers + D1 + Cache API; Google Apps Script.

**Spec:** `docs/superpowers/specs/2026-11-19-migracao-d1-design.md` (seções "Etapa 1" e "Revisões da Etapa 1"). Fica fora deste plano e vai para o **plano 1b**: mudanças em `app/` e na página da raiz, roteamento do `pedir()`, repontar o `cadastro-worker`, ensaio de rollback e o roteiro do dia do cutover.

## Global Constraints

- Comentários e mensagens de erro novos em espanhol (es-AR); documentos e conversa com o Pedro em português.
- O Worker espelha as respostas do `doPost` do Apps Script: sempre HTTP 200 com JSON `{ ok: true, ... }` ou `{ ok: false, error: <texto> }`; `OPTIONS` 204; rota desconhecida 404 JSON `{ ok: false, error: "no encontrado" }`.
- `v` sai do Worker como **texto** (`String(v)`; banco vazio: `""`) e entra como qualquer coisa: só `^\d+$` ou inteiro ≥ 0 vale como versão, o resto vira 0 (cai na fusão, nunca em erro).
- `clave` só para token inválido; Apps Script indisponível é `auth_no_disponible` (o app chama `claveVencida()` para `clave` e deslogaria a família).
- **Sem segredo compartilhado:** o Worker chama o Apps Script com o token do próprio usuário. **Sem atalho de autenticação**, nem em staging (o staging guarda o estado real).
- O estado guardado nunca contém `data:image`, nem `cfg.token`/`cfg.key`, `_v`, `_sucio`.
- Cache do catálogo chaveado pela versão `v` da linha (restrição 10 do `CLAUDE.md` satisfeita sem apagar nada).
- `app/` **não** é tocado neste plano. `server/Codigo.gs` só ganha código inerte enquanto `d1:migrado` estiver desligado; o Pedro publica o Apps Script (**Versão: NUEVA**) uma vez, no fim.
- Nunca credencial no código; dados reais nunca no git (`datos-privados/`).
- Nada vai para a `main` sem aval do Pedro; trabalhar na branch `ccr-fa7f622c-tg1hfl`; só o Worker de **staging** é publicado.
- Testes: `node --test tests/*.test.js api-worker/test/*.test.js`; depois de mexer em `app/app.js` (não deve ser preciso) `node --check app/app.js`. Um commit por mudança, em português, com as linhas de atribuição da sessão.

## Review Focus

1. Versão do cliente vazia, carimbo de hora do Sheets (`"1795055024564"`), lixo ou ausente: o save nunca dá erro 500 nem perde dado (cai na fusão). → Task 5.
2. Apps Script fora do ar: o Worker devolve `auth_no_disponible`, nunca `clave`. → Tasks 3 e 5.
3. Foto nova em base64 nunca chega ao D1; se o upload falhar, nada é salvo. → Tasks 4 e 5.
4. Catálogo público nunca expõe custo, lucro, cliente ou venda, e nunca serve preço mais velho que a última gravação. → Task 7.
5. `editarPieza` só altera os 5 campos permitidos; nome com acento/maiúscula acha a peça; peça inexistente dá erro claro. → Task 6.

---

### Task 1: `fusionar` portado, com paridade contra `fusionar_`

**Files:**
- Create: `api-worker/src/fusionar.js`, `api-worker/test/fusionar.test.js`
- Modify: `docs/migracion-d1.md` (duas linhas)

**Interfaces:**
- Produces: `LISTAS_CON_ID: string[]` (`produtos, filamentos, impressoras, insumos, vendas, canais, packs, opiniones, radar`); `fusionar(servidor: object | null, cliente: object | null) -> object | null` (não muta as entradas; retorna cópia).

- [ ] **Step 1: Escrever os testes que falham** (`fusionar.test.js`, carrega `server/Codigo.gs` num `vm` como em `tests/catalogo-publico.test.js`):
  - `item que só o servidor tem é preservado` e `item do cliente vence o do servidor com o mesmo id`.
  - `baixa feita de cópia velha não se aplica` (item removido no cliente reaparece).
  - `cfg, pedido e pedidoFil: ganha o cliente` (chaves que não estão em `LISTAS_CON_ID` não se fundem).
  - `vendas ficam da mais nova para a mais velha` pela string `data`.
  - `entradas nulas`: `fusionar(null, c) === c` em conteúdo e `fusionar(s, null)` devolve `s`.
  - `itens sem id só sobrevivem se vêm do cliente`.
  - `paridade com fusionar_`: 100 pares gerados por PRNG determinístico (semente fixa; listas com ids repetidos entre as duas pontas, itens sem id, `vendas` com datas desordenadas) e `assert.deepEqual(fusionar(s, c), ctx.fusionar_(clone(s), clone(c)))`.
- [ ] **Step 2: Rodar e ver falhar:** `node --test api-worker/test/fusionar.test.js` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar `fusionar` em `api-worker/src/fusionar.js`** com a mesma regra de `fusionar_` (server/Codigo.gs, `grep -n fusionar_`), trabalhando sobre `structuredClone` das entradas. Comentário em espanhol dizendo que reproduz `fusionar_` e que o teste de paridade os mantém juntos.
- [ ] **Step 4: Rodar:** `node --test api-worker/test/fusionar.test.js` → PASS; suíte completa verde.
- [ ] **Step 5:** duas linhas em `docs/migracion-d1.md` sobre a fusão. **Commit:** "fusionar portado para o Worker com paridade contra fusionar_".

---

### Task 2: `guardarConFusion` (lock otimista + fusão com repetição)

**Files:**
- Modify: `api-worker/src/estado.js`, `api-worker/test/estado.test.js`

**Interfaces:**
- Consumes: `fusionar` (Task 1), `guardarEstado`/`leerEstado` existentes.
- Produces: `sanear(data: object) -> object` (a regra que `guardarEstado` já aplica: cópia sem `cfg.token`, `cfg.key`, `_v`, `_sucio`; `guardarEstado` passa a usá-la); `guardarConFusion(db, data: object, baseV: number, opciones?: { maxIntentos?: number }) -> Promise<{ ok: true, data: object, v: number, fusionado: boolean } | { ok: false, error: "conflicto" }>`. `data` devolvido é o que ficou guardado (saneado). `maxIntentos` padrão 5 = número total de tentativas de gravar.

- [ ] **Step 1: Escrever os testes que falham** (em `estado.test.js`, com o `crearD1` existente):
  - `sem conflito`: devolve `fusionado: false`, `v === baseV + 1`, `data` sem token/key/_v/_sucio.
  - `base velha com item de outro cliente`: o banco tem `v` 3 com um item `x` que o cliente não tem; `guardarConFusion(db, dadosDoCliente, 2)` → `ok`, `fusionado: true`, estado guardado contém os itens dos dois, `v` 4.
  - `baixa de cópia velha não se aplica` através de `guardarConFusion`.
  - `maxIntentos: 1` com base velha → `{ ok: false, error: "conflicto" }` e o banco não mudou.
  - `versão desconhecida enorme` (`baseV = 1795055024564`) com banco existente → cai na fusão e dá `ok`.
- [ ] **Step 2: Rodar e ver falhar:** `node --test api-worker/test/estado.test.js`.
- [ ] **Step 3: Implementar** `sanear` (extraída de `guardarEstado`, sem mudar o comportamento já testado) e `guardarConFusion`: tenta `guardarEstado`; em conflito, `data = fusionar(actual.data, data)`, `baseV = actual.v`, `fusionado = true`, repete até `maxIntentos`.
- [ ] **Step 4: Rodar:** `node --test api-worker/test/estado.test.js` → PASS (os testes antigos continuam passando); suíte completa verde.
- [ ] **Step 5: Commit:** "guardarConFusion: grava com lock otimista e funde em caso de conflito".

---

### Task 3: validação de sessão com cache e tolerância ao Apps Script fora do ar

**Files:**
- Create: `api-worker/src/sesion.js`, `api-worker/test/sesion.test.js`

**Interfaces:**
- Produces: `crearVerificador(opciones?: { fetchFn?: typeof fetch, ahora?: () => number, ttlMs?: number }) -> (token: string, env: { APPS_SCRIPT_URL: string }) => Promise<{ ok: true } | { ok: false, error: "clave" | "auth_no_disponible" }>`; `verificarSesion` (instância padrão com `fetch` real, `ttlMs` 600000).

Regras: token vazio → `clave` sem rede. Token validado há menos que `ttlMs` → `ok` sem rede. Senão `POST` do corpo `JSON.stringify({ action: "validarSesion", token })` em `env.APPS_SCRIPT_URL` (sem cabeçalhos próprios, como o app), com `AbortSignal.timeout(8000)`. Resposta `{ ok: true }` → guarda e devolve `ok`; qualquer outra resposta JSON → `clave` e esquece o token; rede que falha, timeout ou corpo que não é JSON → `auth_no_disponible`.

- [ ] **Step 1: Escrever os testes que falham:** token válido pela segunda vez não chama `fetch`; depois de `ttlMs` chama de novo (relógio injetado); resposta `{ ok: false, error: "clave" }` → `clave` e não fica em cache; `fetchFn` que lança → `auth_no_disponible` (**não** `clave`); resposta que não é JSON → `auth_no_disponible`; token vazio não chama `fetch`; o corpo enviado é exatamente `{ action: "validarSesion", token }`.
- [ ] **Step 2: Rodar e ver falhar:** `node --test api-worker/test/sesion.test.js`.
- [ ] **Step 3: Implementar `crearVerificador`** com um `Map` de token → instante de expiração em memória do isolate.
- [ ] **Step 4: Rodar:** PASS; suíte completa verde.
- [ ] **Step 5: Commit:** "validação de sessão do Worker com cache e erro distinto quando o Apps Script cai".

---

### Task 4: fotos novas vão para o Drive pelo Apps Script

**Files:**
- Create: `api-worker/src/fotos.js`, `api-worker/test/fotos.test.js`

**Interfaces:**
- Produces: `contieneFotosNuevas(data: object) -> boolean` (verdadeiro se há string começando com `data:image` em `produtos[].foto`, `produtos[].fotos[]`, `cfg.logo` ou `cfg.leti.foto`, os mesmos lugares de `moverFotosADrive_`); `subirFotos(env: { APPS_SCRIPT_URL }, token: string, data: object, fetchFn?: typeof fetch) -> Promise<object>` (envia `{ action: "subirFotos", token, data }`; com `{ ok: true, data }` devolve `data`; caso contrário lança `Error` com mensagem `fotos: <erro>`).
- Contrato com a Task 8: o Apps Script responde `{ ok: true, data }` ou `{ ok: false, error }`.

- [ ] **Step 1: Escrever os testes que falham:** detecção em cada um dos quatro lugares; `false` para URLs `https://` e estado sem fotos; `subirFotos` sucesso devolve o `data` da resposta; falha por `{ ok: false, error: "x" }`, por resposta não JSON e por `fetchFn` que lança → todas rejeitam com mensagem começando em `fotos:`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar as duas funções.**
- [ ] **Step 4: Rodar:** PASS; suíte completa verde.
- [ ] **Step 5: Commit:** "fotos novas passam pelo Apps Script antes de ir ao D1".

---

### Task 5: roteador com `load`, `save`, snapshot de rollback e CORS corrigido

**Files:**
- Create: `api-worker/src/rutas.js`, `api-worker/test/rutas.test.js`
- Modify: `api-worker/src/index.js`, `api-worker/src/cors.js`, `api-worker/test/index.test.js`, `api-worker/wrangler.toml`

**Interfaces:**
- Consumes: `verificarSesion` (Task 3), `guardarConFusion`/`leerEstado` (Task 2), `contieneFotosNuevas`/`subirFotos` (Task 4).
- Produces: `versionDelCliente(v: unknown) -> number`; `ACCIONES: Record<string, (body: object, ctx: Contexto) => Promise<object>>` com `load` e `save` (as Tasks 6 e 7 acrescentam outras); `manejarPost(body: object, ctx: Contexto) -> Promise<object>`; `Contexto = { env, db, token: string, ahora: () => number, fetchFn: typeof fetch, verificar: ReturnType<typeof crearVerificador>, esperar: (p: Promise<unknown>) => void }`.

Contrato das ações (espelha `doPost`): sem `action` válida → `{ ok: false, error: "accion desconocida" }`; antes de qualquer ação, `verificar(body.token, env)` e, se falhar, devolve esse objeto **sem tocar no banco**. `load` → `{ ok: true, data, v: String(v) }` (banco vazio: `data: null, v: ""`). `save` → exige `body.data` objeto não nulo e não array (senão `{ ok: false, error: "datos invalidos" }`); `baseV = versionDelCliente(body.v)`; se `contieneFotosNuevas(data)` → `data = await subirFotos(...)` (falha → `{ ok: false, error: <mensagem> }` e **nada é gravado**); `guardarConFusion` → `{ ok: true, actualizado: <ISO de ahora()>, data, v: String(v), fusionado }`; esgotou tentativas → `{ ok: false, error: "conflicto" }`. Depois de um save bem-sucedido, se `env.SNAPSHOT === "on"`, `ctx.esperar(...)` com um `POST` de melhor esforço `{ action: "guardarSnapshot", token, data }` para `env.APPS_SCRIPT_URL` (erro engolido, nunca muda a resposta). Corpo que não é JSON → `{ ok: false, error: "cuerpo invalido" }`.

- [ ] **Step 1: Escrever os testes que falham** (`rutas.test.js`, `crearD1()` real e `verificar`/`fetchFn` falsos):
  - `load` com banco vazio e com estado; `v` volta como texto.
  - `save` primeira vez com `v: ""` → `ok`; `save` com `v` igual ao lido → `fusionado: false`.
  - **`save` com `v: "1795055024564"`** (carimbo do Sheets) e com `v: undefined`, `v: "lixo"`, `v: -1`: nunca lança; cai na fusão e preserva o item que só o servidor tinha.
  - token ausente → `{ ok: false, error: "clave" }` e o banco não é consultado (espião em `db.prepare`); `verificar` devolvendo `auth_no_disponible` passa direto, sem virar `clave`.
  - `save` com `data:image` → `subirFotos` é chamado e o que fica guardado não contém `data:image`; upload falha → resposta de erro e o banco continua como estava.
  - `save` sem `data` e com `data: []` → `datos invalidos`.
  - snapshot: com `SNAPSHOT: "on"` o `fetchFn` recebe `guardarSnapshot` com o token; com `"off"` não recebe; `fetchFn` que lança não altera a resposta.
  - `index.test.js`: `POST /` com corpo `text/plain` que não é JSON → JSON de erro sem exceção; `Vary: Origin` presente **também** para origem não permitida e para ausência de `Origin`; cabeçalhos `Access-Control-*` só para origem permitida.
- [ ] **Step 2: Rodar e ver falhar:** `node --test api-worker/test/rutas.test.js api-worker/test/index.test.js`.
- [ ] **Step 3: Implementar** `rutas.js` (funções acima, mensagens de erro em espanhol) e ligar em `index.js`: `POST` em qualquer caminho exceto `/salud` lê `await request.text()`, chama `manejarPost` com `ctx` real (`esperar = (p) => ctxWorker.waitUntil(p)`) e responde com `json(...)` (status 200). Em `cors.js`, `encabezadosCors` devolve `{ Vary: "Origin" }` para origem não permitida. Em `wrangler.toml` acrescentar em `[vars]` `APPS_SCRIPT_URL` (o mesmo valor de `cadastro-worker/wrangler.toml`) e `SNAPSHOT = "off"`, também em `[env.prod.vars]`.
- [ ] **Step 4: Rodar:** PASS; suíte completa verde.
- [ ] **Step 5: Commit:** "roteador do Worker com load e save no contrato do Apps Script, snapshot e Vary: Origin sempre".

---

### Task 6: rotas que gravam o estado (`editarPieza`, `agregarPieza`, `agregarFilamento`, `resumenNegocio`)

**Files:**
- Create: `api-worker/src/acciones.js`, `api-worker/test/acciones.test.js`
- Modify: `api-worker/src/rutas.js`

**Interfaces:**
- Consumes: `ACCIONES`/`Contexto` (Task 5), `guardarConFusion`/`leerEstado` (Task 2), `subirFotos`/`contieneFotosNuevas` (Task 4), `Calculo` (`api-worker/src/calculo.js`).
- Produces (todas `(body, ctx) => Promise<object>`, registradas em `ACCIONES` com o mesmo nome): `editarPieza` (corpo `{ pieza: string, campos: object }` → `{ ok: true }`), `agregarPieza` (`{ pieza }` → `{ ok: true, id }`), `agregarFilamento` (`{ filamento }` → `{ ok: true, id, num }`), `resumenNegocio` (→ `{ ok: true, ... }`).

Comportamento: portar exatamente `editarPieza_`, `agregarPieza_`, `agregarFilamento_` e `resumenNegocio_` de `server/Codigo.gs` (`grep -n` cada nome). `editarPieza` só toca `desc`, `detalle`, `medida`, `tags`, `cat` (cada valor com `String(...)`); acha a peça por nome normalizado (`toLowerCase`, `[^a-z0-9]+` → espaço, `trim`); sem estado → `sin datos`; sem peça → `pieza no encontrada`. Ids novos com `crypto.randomUUID()`. Gravam lendo `{ data, v }`, alterando e chamando `guardarConFusion(db, data, v)`. `agregarPieza` com foto base64 passa por `subirFotos` como no save. Erros em espanhol idênticos aos do servidor.

- [ ] **Step 1: Escrever os testes que falham** (`acciones.test.js`):
  - `editarPieza`: altera os cinco campos; **ignora** `preco`, `manual`, `nome` mesmo se vierem em `campos`; valores numéricos viram texto; nome com acento e maiúscula acha a peça; peça inexistente → `pieza no encontrada`; banco vazio → `sin datos`; a gravação passa por `guardarConFusion` (versão avança).
  - `agregarPieza`: sem nome → `falta el nombre`; defaults do servidor (`fil` e `imp` caem no primeiro da lista, `cplx` 1, `manual` nulo quando vazio); id novo diferente a cada chamada.
  - `agregarFilamento`: `num` é o maior existente + 1; `rollo` padrão 1000 e `stock` igual ao `rollo`; sem nome → `falta el nombre/tipo`.
  - `resumenNegocio`: paridade com `resumenNegocio_` rodando `Codigo.gs` num `vm` sobre o mesmo estado inventado (listas `piezas`, `filamentos`, `insumos` iguais com `deepEqual`; para o resto, as mesmas chaves).
  - Todas exigem sessão (o roteador já cobre) e usam `ctx.token` para fotos.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar `acciones.js`** e registrar as quatro em `ACCIONES`.
- [ ] **Step 4: Rodar:** PASS; suíte completa verde.
- [ ] **Step 5: Commit:** "rotas que gravam o estado portadas para o Worker com paridade onde há cópia no servidor".

---

### Task 7: catálogo público no Worker com cache chaveado por versão

**Files:**
- Create: `api-worker/src/catalogo.js`, `api-worker/test/catalogo.test.js`
- Modify: `api-worker/src/index.js`

**Interfaces:**
- Consumes: `leerEstado` (Task 2), `Calculo.calcular` (Task 1 da Etapa 0).
- Produces: `fotoChica(url: unknown) -> unknown` (mesma regra de `fotoChica_`, `FOTO_PARAM = "w800"`); `catalogoPublico(data: object | null) -> object` (mesma forma que `catalogoPublico_`); `catalogoCacheado(db, cache: { match, put }, opciones?: { ttl?: number }) -> Promise<object>` (lê `SELECT v`; chave `https://cache.playmind3d.invalid/catalogo?v=<v>`; só guarda catálogo com `piezas.length > 0`). Rota pública: `GET /catalogo` e `GET /?action=catalogo` → `{ ok: true, catalogo }`, com o mesmo CORS.

- [ ] **Step 1: Escrever os testes que falham** (`catalogo.test.js`):
  - **paridade** com `catalogoPublico_`: estado inventado com peça `oculta`, fotos do Drive/outra URL/vazia, packs de desconto e fixos, opiniões invisíveis, `leti.foto`, vendas que alimentam `vendidas`; `deepEqual` contra o `Codigo.gs` num `vm` (sobrescrevendo `leerEstado_` para devolver o mesmo estado).
  - **privacidade:** `JSON.stringify(catalogoPublico(estado))` não contém as chaves `"custo"`, `"lucro"`, `"consumo"`, `"cliente"`, `"stockUsado"`.
  - **cache:** duas chamadas com a mesma `v` leem o estado uma vez (espião); depois de um `guardarEstado` (a `v` sobe) a próxima chamada recalcula e reflete o preço novo; catálogo vazio não é guardado; `cache` que lança não derruba a resposta.
  - `index.test.js`: `GET /catalogo` e `GET /?action=catalogo` respondem `{ ok: true, catalogo }` sem token; origem não permitida não recebe `Access-Control-Allow-Origin`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar `catalogo.js`** (porte de `catalogoPublico_` e `fotoChica_`) e as rotas em `index.js` usando `caches.default` como `cache`.
- [ ] **Step 4: Rodar:** PASS; suíte completa verde.
- [ ] **Step 5: Commit:** "catálogo público no Worker com cache chaveado pela versão do estado".

---

### Task 8: Apps Script — chave de migração, `subirFotos` e `guardarSnapshot`

**Files:**
- Modify: `server/Codigo.gs`
- Create: `tests/migracion-servidor.test.js`

**Interfaces:**
- Produces (no Apps Script): `migrado_() -> boolean` (`props_().getProperty("d1:migrado") === "1"`); `activarModoD1_(activo: boolean) -> void`; `guardarUrlWorker_(url: string) -> void` (propriedade `d1:catalogoUrl`); ações de `doPost` `subirFotos` (`{ token, data }` → `{ ok: true, data }`; `data` inválido → `{ ok: false, error: "datos invalidos" }`) e `guardarSnapshot` (`{ token, data }` → `{ ok: true, guardado: true }` ou `{ ok: true, guardado: false, motivo: "excede" }`); itens de menu finos que chamam `activarModoD1_` e `guardarUrlWorker_`.

Regras: com `migrado_()` ligado, `load`, `save`, `editarPieza`, `agregarPieza`, `agregarFilamento` e `resumenNegocio` respondem `{ ok: false, error: "migrado" }` sem ler nem gravar a planilha; `login`, `logout`, `validarSesion`, `foto`, `mundo`, `subirFotos` e `guardarSnapshot` continuam como estão (as duas novas exigem sessão válida como o resto). `guardarSnapshot` zera `cfg.token`/`cfg.key`, apaga `_v`, **só grava a célula se o JSON tiver menos de `CELDA_MAX` caracteres**, com o lock e o mesmo `setValues` de `guardarEstado_`, chamando `invalidarCatalogo_()` logo depois do `setValues` (restrição 10), e **não** regrava as abas espelho. `doGet` com `action=catalogo` e `migrado_()` ligado e `d1:catalogoUrl` definida busca essa URL com `UrlFetchApp.fetch(url, { muteHttpExceptions: true })` e devolve o JSON recebido; se falhar devolve `{ ok: false, error: "catalogo no disponible" }` (sem cair no cache antigo). Comentários em espanhol.

- [ ] **Step 1: Escrever os testes que falham** (`tests/migracion-servidor.test.js`, `vm` com `ContentService`, `PropertiesService`, `LockService`, `SpreadsheetApp`, `UrlFetchApp` e `CacheService` falsos, no padrão de `tests/estado-medida.test.js`):
  - chave desligada: `load` continua respondendo como hoje (não regressão).
  - chave ligada: as seis ações respondem `migrado` e a planilha não é lida (espião em `SpreadsheetApp`).
  - `subirFotos` com sessão válida chama `moverFotosADrive_` (substituída por um stub) e devolve o `data`; sem sessão → `clave`; `data` não objeto → `datos invalidos`.
  - `guardarSnapshot` pequeno: grava a célula (espião em `setValues`), chama `invalidarCatalogo_`, não grava token/key/`_v`, não chama `volcar*_`; estado com 50.000 caracteres ou mais: **não grava** e devolve `guardado: false, motivo: "excede"`.
  - `doGet` catálogo com chave ligada usa `UrlFetchApp` e devolve o que a URL entregou; com a URL falhando devolve `catalogo no disponible`; com a chave desligada continua usando `catalogoCacheado_`.
- [ ] **Step 2: Rodar e ver falhar:** `node --test tests/migracion-servidor.test.js`.
- [ ] **Step 3: Implementar em `server/Codigo.gs`** as funções e os desvios acima, mantendo `login`/`logout` antes da verificação de sessão como já estão.
- [ ] **Step 4: Rodar:** PASS; suíte completa verde; `node --check app/app.js` não é necessário (`app/` não mudou).
- [ ] **Step 5: Commit:** "Apps Script: chave de migração, subirFotos e guardarSnapshot". No relatório, lembrar o Pedro: o `Codigo.gs` mudou de novo, **Versão: NUEVA** num único deploy (junto com os alinhamentos de `calcular_` que ainda esperam publicação), e que com a chave desligada tudo é inerte.

---

### Task 9: staging com o código novo e teste de fumaça com o Pedro

**Files:**
- Modify: `docs/migracion-d1.md`

**Interfaces:**
- Consumes: o Worker completo (Tasks 1 a 7). Produz: Worker de staging atualizado e um relato escrito do que foi verificado.

Pré-requisito: o Pedro já autorizou publicar o Worker de **staging**. Não mexer em mais nada da conta Cloudflare (nada de prod, nada de segredos novos: este plano não usa nenhum). `CLOUDFLARE_API_TOKEN=proxy-injected`, comandos a partir de `api-worker/` com `--env=""`.

- [ ] **Step 1: Empacotamento:** `npx wrangler deploy --dry-run --outdir /tmp/dist-api` termina sem erro e o pacote agora inclui `Calculo` (tamanho bem acima de 1,55 KiB e abaixo de 1 MiB; registrar).
- [ ] **Step 2: Publicar o staging:** `npx wrangler deploy` (top-level). Verificar `curl -i <staging>/salud` → 200; `curl -X POST <staging> -d '{"action":"load"}'` → `{"ok":false,"error":"clave"}`; `curl -X POST <staging> -d 'isto não é json'` → `{"ok":false,"error":"cuerpo invalido"}` com status 200.
- [ ] **Step 3: Catálogo comparado:** `curl <staging>/catalogo` devolve `{ ok: true, catalogo }` com as peças públicas; comparar com `?action=catalogo` do Apps Script de produção (mesmo `GET`) peça a peça e registrar **só contagens**: total de peças em cada lado e quantas têm preço diferente (as diferenças esperadas vêm das divergências do `calcular_` antigo que ainda não foi republicado; explicar isso no texto). Segunda chamada ao staging deve vir do cache (conferir pelo tempo e por `cf-cache-status` se o cabeçalho existir; se não, dizer que não deu para confirmar).
- [ ] **Step 4: Fumaça com o Pedro (precisa do token dele):** preparar um trecho para ele colar no console do navegador **em `https://playmind3d.com/app/`** (origem permitida) que faça `POST` ao staging com `{ action: "load", token: D.cfg.token }` e imprima só `{ ok, v, produtos, vendas, fusionado }`, depois um `save` do próprio `D` com o `v` recebido, imprimindo `{ ok, fusionado, v }`. O token nunca sai do navegador dele e ele cola de volta apenas a saída. Esperado: `load` ok com contagens iguais às do estado de staging; `save` ok com `fusionado: false`.
- [ ] **Step 5: Documentar** em `docs/migracion-d1.md` o que a 1a entrega, a URL, o trecho de fumaça e o que o 1b precisa saber. **Commit:** "Worker de staging com a API completa e teste de fumaça documentado". Parar aqui: o 1b muda o app e pede plano e aval do Pedro.
