# Migração para o D1 — Etapa 1b (cutover) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar pronto, testado e reversível o cutover do estado da família do Apps Script/Sheets para o Worker/D1: app que troca de servidor pelo erro que recebe, ação de exportação e snapshots confiáveis no Apps Script, modo `solo-lectura` de rollback no Worker, carga que nunca sobrescreve, os outros dois chamadores (página da raiz e `cadastro-worker`) e o roteiro do dia.

**Architecture:** Um módulo puro e compartilhado, `app/protocolo.js` (script clássico dual-mode como `app/calculo.js`), decide para qual servidor vai cada ação e como reagir a cada erro (`migrado` → Worker, `revertido` → Apps Script, no máximo uma repetição). O app, a página da raiz e o `cadastro-worker` o usam; o Apps Script e o Worker passam a responder esses erros. O dia do corte só liga a chave `d1:migrado`; o código novo entra no ar dias antes, inerte.

**Tech Stack:** JS puro (app sem build), `node:test`, Cloudflare Workers + D1 (`wrangler` só em `api-worker/` e `cadastro-worker/`), Google Apps Script, Playwright (ferramenta do ambiente, **não** dependência do repositório).

**Spec:** `docs/superpowers/specs/2026-11-19-migracao-d1-design.md` (seção "Etapa 1b — desenho do cutover", aprovada pelo Pedro em 19/11/2026, e "Revisões da Etapa 1"). O dia do corte em si (ligar a chave, carregar, verificar, ida e volta) **não** é tarefa deste plano: é o roteiro da Task 7, executado com o Pedro online.

## Global Constraints

- Comentários, textos de interface e mensagens de erro novos em espanhol (es-AR); documentos e conversa com o Pedro em português.
- Sem build step em `app/`: nada de npm, bundler ou framework. Arquivo novo em `app/` entra em `ARCHIVOS` do `app/sw.js` e o `CACHE` sobe de versão (hoje `playmind3d-v25`).
- Todo o código de `app/` deste plano é feito **sobre o `app/app.js` monolítico da `main`** (não sobre os módulos da outra sessão). A outra sessão faz `git merge origin/main` e porta as linhas tocadas. O controlador a avisa **antes** da Task 4; os implementadores não falam com ela.
- A chave `d1:migrado` fica **desligada** do começo ao fim deste plano, e `SNAPSHOT` fica `"off"` em todas as configurações publicadas até o roteiro mandar ligar. Nenhuma tarefa liga a chave nem executa o cutover.
- `calc()`/`calcular_()` seguem concordando (`tests/calculo-paridad.test.js` não pode quebrar).
- `server/Codigo.gs` muda só na Task 1; o Pedro publica **Versão: NUEVA** uma vez, no fim, junto com tudo o que ainda não foi publicado. Toda função que grava a célula `estado` chama `invalidarCatalogo_()` logo após o `setValues`.
- O estado guardado nunca contém `data:image`, nem `cfg.token`/`cfg.key`, `_v`, `_sucio`.
- Nunca credencial no código; dados reais nunca no git (`datos-privados/`). Dados de teste inventados; nos documentos e relatórios só contagens, hashes, tamanhos e tempos.
- Nada vai para a `main` sem o aval explícito do Pedro (publicar a `main` publica o app). Trabalhar na branch `ccr-fa7f622c-tg1hfl`. Ações na conta Cloudflare só na Task 8 e só com o aval do Pedro.
- Testes: `node --test tests/*.test.js api-worker/test/*.test.js cadastro-worker/test/*.test.js` (nunca `node --test tests/`). Depois de mexer em `app/app.js`: `node --check app/app.js`. Um commit por mudança, em português, com as linhas de atribuição da sessão.

## Review Focus

1. Depois de um `load` que falhou (qualquer `ok:false`), `listoParaSubir` continua `false` e o estado local nunca é sobrescrito por um estado vazio ou parcial; só `ok:true` com `data:null` significa "sem dados". → Task 5.
2. `auth_no_disponible` nunca desloga (`claveVencida` não é chamada) nem troca de modo; `clave` continua deslogando. → Tasks 4 e 5.
3. `migrado` ↔ `revertido` não entra em laço: uma requisição é repetida no máximo uma vez depois de trocar de modo e a segunda resposta "lugar errado" vira erro. → Task 4 (puro) e Task 5 (navegador).
4. Snapshot fora de ordem nunca regride a célula (`v` menor ou igual ao último é ignorado) e `excede` e falhas ficam registrados e visíveis. → Tasks 1 e 2.
5. A carga no D1 nunca sobrescreve uma linha existente e a `v` inicial nunca coincide com uma versão já emitida nem com um carimbo do Sheets. → Task 3.

---

### Task 1: Apps Script — `exportarEstado` e snapshot confiável

**Files:**
- Modify: `server/Codigo.gs`, `tests/migracion-servidor.test.js`

**Interfaces:**
- Produces (ações de `doPost`, ambas exigem sessão): `exportarEstado` (`{ action, token }` → `{ ok:true, data: object|null, v: string }`, o mesmo formato que `load` devolve; **funciona com `d1:migrado` ligada ou desligada**, só lê, não está na lista de ações bloqueadas); `guardarSnapshot` com contrato novo: `{ action, token, data, v }` → `{ ok:true, guardado:true }` | `{ ok:true, guardado:false, motivo:"vieja"|"excede" }` | `{ ok:false, error }`.
- Propriedades novas (Script Properties): `d1:snapshotV` (a última `v` gravada, texto). `medida:estado` passa a ser atualizada também pelo snapshot, no mesmo formato que `guardarEstado_` usa (`{ chars, pct, cuando }`).

Regras de `guardarSnapshot` (mantém a ordem sessão → chave ligada → validação já existente): `v` precisa ser inteiro ≥ 0 ou texto `^\d+$`, senão `{ ok:false, error:"falta v" }`. Dentro do mesmo lock da gravação: se `Number(v) <= Number(d1:snapshotV)` → `{ ok:true, guardado:false, motivo:"vieja" }` sem gravar; se o texto serializado tem `>= CELDA_MAX` caracteres → atualiza `medida:estado` (para o medidor mostrar o estouro), **não grava** e **não** mexe em `d1:snapshotV`, e responde `motivo:"excede"`; senão grava a célula, chama `invalidarCatalogo_()` logo depois do `setValues`, grava `d1:snapshotV` e atualiza `medida:estado`.

- [ ] **Step 1: Escrever os testes que falham** (em `tests/migracion-servidor.test.js`, com as fakes já existentes; ajustar os testes de snapshot existentes para mandarem `v`):
  - `exportarEstado` com sessão válida devolve `{ ok:true, data, v }` com a chave desligada **e** ligada; sem sessão → `clave`; não grava nada; leitura da propriedade da chave lançando não impede a exportação (ela não lê a chave).
  - `guardarSnapshot`: `v` ausente, `"abc"`, `-1` → `falta v`; primeiro snapshot com `v` 5 grava, `d1:snapshotV` fica `"5"`; depois `v` 5 e `v` 4 → `motivo:"vieja"` sem `setValues`; `v` 6 grava; dois snapshots "fora de ordem" (7 depois de 8) deixam o 8 na célula.
  - estado com `>= CELDA_MAX` caracteres: não grava, `motivo:"excede"`, `d1:snapshotV` não muda, `medida:estado` ganha `chars` e `pct` do estado grande.
  - snapshot válido atualiza `medida:estado` (`chars`, `pct`, `cuando`) e a ordem das chamadas continua `setValues` → `invalidarCatalogo_` → liberar o lock.
  - com a chave desligada: `guardarSnapshot` segue respondendo `no migrado` sem gravar (regressão da Task 8 da Etapa 1a).
- [ ] **Step 2: Rodar e ver falhar:** `node --test tests/migracion-servidor.test.js`.
- [ ] **Step 3: Implementar** `exportarEstado` em `doPost` (depois da checagem de sessão, fora da lista bloqueada, reaproveitando `leerEstadoYV_()`) e as regras novas em `guardarSnapshot_`, com comentários em espanhol; não tocar em mais nada de `Codigo.gs`.
- [ ] **Step 4: Rodar:** `node --test tests/*.test.js api-worker/test/*.test.js` → tudo verde.
- [ ] **Step 5: Commit:** "Apps Script: exportarEstado e snapshot versionado com medidor". No relatório, lembrar o Pedro: `Codigo.gs` mudou, uma só publicação **Versão: NUEVA** (versão ativa hoje: 30).

---

### Task 2: Worker — modo `solo-lectura`, snapshots em todas as rotas e registro visível

**Files:**
- Create: `api-worker/src/snapshot.js`, `api-worker/migrations/0002_meta.sql`, `api-worker/test/snapshot.test.js`
- Modify: `api-worker/src/rutas.js`, `api-worker/src/acciones.js`, `api-worker/src/index.js`, `api-worker/test/rutas.test.js`, `api-worker/test/index.test.js`, `api-worker/wrangler.toml`

**Interfaces:**
- Produces: `snapshotTrasGrabar(ctx: Contexto, resultado: { data: object, v: number }) -> void` em `src/snapshot.js` (nunca lança, nunca devolve promessa que rejeite; entrega o trabalho a `ctx.esperar`); `leerUltimoSnapshot(db) -> Promise<{ v:number, ok:boolean, motivo:string|null, cuando:string } | null>`; tabela `meta(clave TEXT PRIMARY KEY, valor TEXT NOT NULL, actualizado TEXT NOT NULL)` (migração `0002_meta.sql`); variável `MODO` (`"escritura"` padrão | `"solo-lectura"`); `GET /salud` passa a devolver `{ ok:true, modo: <MODO ou "escritura">, snapshot: <leerUltimoSnapshot ou null> }`.
- Consumes: `Contexto = { env, db, token, ahora, fetchFn, verificar, esperar }` (Etapa 1a), contrato do Apps Script da Task 1.

Regras: depois de **qualquer** gravação bem-sucedida (`save`, `editarPieza`, `agregarPieza`, `agregarFilamento`), se `env.SNAPSHOT === "on"`, `snapshotTrasGrabar` envia `POST` sem `headers` a `env.APPS_SCRIPT_URL` com `{ action:"guardarSnapshot", token, data, v }` (`v` é o número devolvido por `guardarConFusion`), com `signal: AbortSignal.timeout(15000)`, e registra o resultado em `meta` na linha `snapshot:ultimo` como JSON `{ v, ok, motivo, cuando }`: `ok:true` quando a resposta é `{ ok:true, guardado:true }`; `ok:false` com `motivo` `"vieja"`/`"excede"` (o que vier), `"error: <texto>"` para `{ ok:false, error }` e `"red"` para falha de rede ou resposta que não é JSON. Qualquer erro dentro do snapshot ou do registro é engolido: a resposta ao cliente nunca muda. Em `manejarPost`, depois da autenticação e da busca da ação, se `env.MODO === "solo-lectura"` e a ação é `save`, `editarPieza`, `agregarPieza` ou `agregarFilamento` → `{ ok:false, error:"revertido" }` sem tocar no banco; `load`, `resumenNegocio` e o catálogo continuam funcionando.

- [ ] **Step 1: Escrever os testes que falham** (`snapshot.test.js` com `crearD1()` real e `fetchFn` falso; testes de `rutas.test.js` e `index.test.js`):
  - snapshot com `SNAPSHOT:"on"` depois de cada uma das quatro rotas: `fetchFn` recebe `guardarSnapshot` com `token`, `data` e `v` igual ao `v` gravado, sem `headers`, com `signal`; com `"off"` nunca é chamado.
  - resultados registrados: `{ok:true,guardado:true}` → `ok:true`; `{ok:true,guardado:false,motivo:"excede"}` → `ok:false, motivo:"excede"`; `{ok:false,error:"no migrado"}` → `motivo:"error: no migrado"`; `fetchFn` que rejeita e resposta que não é JSON → `motivo:"red"`; o registro substitui o anterior (um só `snapshot:ultimo`).
  - falha dentro do snapshot (incluindo a escrita em `meta` falhando) nunca muda a resposta nem lança.
  - `MODO:"solo-lectura"`: as quatro rotas respondem `revertido` e a linha do estado e `meta` não mudam; `load` e `resumenNegocio` funcionam; `MODO` ausente ou `"escritura"` não bloqueia.
  - `GET /salud` devolve `modo` e `snapshot` (`null` sem registro; o objeto depois de um snapshot); ajustar o teste antigo de `/salud` ao formato novo. **O `/salud` é o endpoint de saúde e nunca pode falhar por causa do registro:** se a tabela `meta` não existir (banco ainda sem a migração `0002`) ou a leitura lançar, responde 200 com `snapshot: null` (teste com um banco que só tem a tabela `estado`); `leerUltimoSnapshot` engole o erro e devolve `null`.
- [ ] **Step 2: Rodar e ver falhar:** `node --test api-worker/test/*.test.js`.
- [ ] **Step 3: Implementar** `snapshot.js`, a migração `0002_meta.sql`, a checagem de `MODO` em `manejarPost`, a chamada de `snapshotTrasGrabar` nas quatro rotas (a lógica `enviarSnapshot` antiga de `rutas.js` sai) e o `/salud` novo. Em `wrangler.toml`, `MODO = "escritura"` em `[vars]` e em `[env.prod.vars]`; `SNAPSHOT` continua `"off"` nos dois. `fotos.js` não muda.
- [ ] **Step 4: Rodar:** `node --test tests/*.test.js api-worker/test/*.test.js` → tudo verde.
- [ ] **Step 5: Commit:** "Worker: modo solo-lectura, snapshots em todas as rotas e registro visível". Nada é publicado aqui.

---

### Task 3: Carga no D1 que nunca sobrescreve

**Files:**
- Modify: `scripts/migracion-d1.js`, `api-worker/test/migracion.test.js`

**Interfaces:**
- Produces: `sqlCarga(data: object, ahora: string, vInicial?: number) -> string`: **um `INSERT INTO estado (clave, json, v, actualizado) VALUES ('estado', …)` sem `OR REPLACE`** (a chave primária recusa linha existente) com `v = vInicial`, padrão `Math.floor(Date.now() / 1000)` (10 dígitos); `vInicial` precisa ser inteiro seguro ≥ 1, senão lança `TypeError`. CLI: `node scripts/migracion-d1.js carga <estado.json> <saida.sql> [--v-inicial N]`; códigos de saída: 0 sucesso, 1 `comparar` com diferença, 2 uso errado, **3 arquivo ilegível ou JSON inválido** (hoje 1).

- [ ] **Step 1: Escrever os testes que falham** (em `migracion.test.js`, `crearD1()` real): executar o SQL gerado duas vezes no mesmo banco → o segundo falha com erro de chave primária e a linha original (dados e `v`) fica intacta; `v` gravada é a `vInicial` passada e, sem ela, um inteiro de 10 dígitos; `vInicial` 0, `-1`, `1.5`, `"7"` lançam `TypeError`; o caso de aspas e emoji existente continua passando (`leerEstado` devolve o mesmo estado); o texto do SQL gerado não contém `OR REPLACE`; o CLI com arquivo inexistente sai com código 3 e com JSON inválido também (usar `child_process.spawnSync` sobre `scripts/migracion-d1.js` com arquivos temporários inventados fora do repositório).
- [ ] **Step 2: Rodar e ver falhar:** `node --test api-worker/test/migracion.test.js`.
- [ ] **Step 3: Implementar** a troca em `sqlCarga`, o parâmetro `--v-inicial` no CLI e os códigos de saída; documentar no comentário (em espanhol) por que o `INSERT` puro e a `v` baseada no relógio (a versão do D1 nunca pode repetir uma já emitida, nem coincidir com os carimbos de 13 dígitos do Sheets).
- [ ] **Step 4: Rodar:** suíte completa verde.
- [ ] **Step 5: Commit:** "carga no D1 com insert que recusa sobrescrever e versão inicial pelo relógio".

---

### Task 4: `app/protocolo.js` — o protocolo de dois servidores, puro e testado

**Files:**
- Create: `app/protocolo.js`, `tests/protocolo.test.js`
- Modify: `app/index.html` (um `<script src="protocolo.js">` logo depois de `calculo.js`), `app/sw.js` (`'./protocolo.js'` em `ARCHIVOS` e `CACHE` de `playmind3d-v25` para `playmind3d-v26`)

**Interfaces:**
- Produces (global `Protocolo` no navegador, `module.exports` em Node, mesmo padrão de `app/calculo.js`; nenhum outro nome global):
  - `Protocolo.ACCIONES_ESTADO: string[]` = `["load","save","editarPieza","agregarPieza","agregarFilamento","resumenNegocio"]`.
  - `Protocolo.CLAVE_MODO: string` = `"pm3d:servidor-estado"`.
  - `Protocolo.servidorPara(accion: string, modo: "apps"|"worker") -> "apps"|"worker"`: `"worker"` só quando `modo === "worker"` e a ação está em `ACCIONES_ESTADO`; qualquer outra combinação (`login`, `logout`, `foto`, `mundo`, ação desconhecida, modo inválido) é `"apps"`.
  - `Protocolo.reaccion(servidor, respuesta) -> { tipo: "ok"|"cambiarModo"|"clave"|"sinAcceso"|"conflicto"|"fotos"|"error", modo?: "apps"|"worker" }`: `respuesta.ok === true` → `ok`; `error === "migrado"` e `servidor === "apps"` → `cambiarModo` com `modo:"worker"`; `error === "revertido"` e `servidor === "worker"` → `cambiarModo` com `modo:"apps"`; `error === "clave"` → `clave`; `error === "auth_no_disponible"` → `sinAcceso`; `error === "conflicto"` → `conflicto`; `error` começando com `fotos:` → `fotos`; qualquer outra coisa (inclusive `migrado` vindo do Worker, `revertido` vindo do Apps Script, resposta nula ou não objeto) → `error`.
  - `Protocolo.leerModo(almacen: { getItem(k): string|null }) -> "apps"|"worker"` (valor inválido, ausente ou `getItem` que lança → `"apps"`); `Protocolo.guardarModo(almacen: { setItem(k, v): void }, modo) -> void` (engole exceções).
  - `Protocolo.pedirEstado({ cuerpo: object, modo: "apps"|"worker", enviar: (servidor, cuerpo) => Promise<object>, alCambiarModo: (modo) => void }) -> Promise<{ respuesta: object, servidor: "apps"|"worker", reaccion: object, modo: "apps"|"worker" }>`: chama `enviar(servidorPara(cuerpo.action, modo), cuerpo)`; se a reação é `cambiarModo`, chama `alCambiarModo(novoModo)` e **repete uma única vez** no servidor do modo novo; se a reação da repetição também for `cambiarModo`, a reação final é `{ tipo:"error" }` (sem laço) e `modo` é o último; exceções de `enviar` se propagam sem tratamento (o chamador já trata falha de rede).

- [ ] **Step 1: Escrever os testes que falham** (`tests/protocolo.test.js`, CommonJS, `require("../app/protocolo.js")`): a tabela completa de `reaccion` (cada `error` acima, mais `{}` e `null`); `servidorPara` para as seis ações nos dois modos e para `login`/`logout`/`foto`/`mundo`/`"x"`; `leerModo`/`guardarModo` com armazenamento falso, com valor lixo e com `getItem`/`setItem` lançando; `pedirEstado`: sem troca (uma chamada, `alCambiarModo` não chamado); `migrado` no modo `apps` → duas chamadas (a segunda no Worker, com o mesmo corpo), `alCambiarModo("worker")` uma vez, reação final `ok`; `revertido` no modo `worker` → duas chamadas, volta a `apps`; **`migrado` e depois `revertido`** (e o inverso) → exatamente duas chamadas e reação final `error`, nunca três; `auth_no_disponible` → uma chamada, reação `sinAcceso`, `alCambiarModo` não chamado; `clave` → uma chamada; `enviar` que rejeita → `pedirEstado` rejeita; `login` no modo `worker` vai ao `apps`.
- [ ] **Step 2: Rodar e ver falhar:** `node --test tests/protocolo.test.js`.
- [ ] **Step 3: Implementar `app/protocolo.js`** no padrão de `app/calculo.js` (IIFE; `module.exports` em Node, `raiz.Protocolo` no navegador, sem `Object.assign(raiz, …)`), e as duas linhas de `index.html` e `sw.js`. Comentários em espanhol.
- [ ] **Step 4: Rodar:** `node --test tests/*.test.js api-worker/test/*.test.js cadastro-worker/test/*.test.js` → verde (se `cadastro-worker/test/` ainda não existir, omitir o glob) e `node --check app/app.js`.
- [ ] **Step 5: Commit:** "protocolo de dois servidores como módulo puro (sw v26)". **Antes desta tarefa o controlador avisa a outra sessão** (nenhum implementador faz isso).

---

### Task 5: `app/app.js` usa o protocolo + ensaio automatizado no navegador

**Files:**
- Modify: `app/app.js` (constantes junto de `SERVIDOR` na seção `almacenamiento`; as funções `subirALaNube`, `bajarDeLaNube` e `claveVencida` na seção `nube`)
- Create: `scripts/ensayo-protocolo.js`

**Interfaces:**
- Consumes: `Protocolo` (Task 4: `pedirEstado`, `leerModo`, `guardarModo`, `reaccion`, `CLAVE_MODO`).
- Produces: `const SERVIDOR_ESTADO = "https://playmind3d-api-prod.pdroarraes.workers.dev/"`; `let MODO_SERVIDOR = Protocolo.leerModo(window.localStorage)`; `function enviarEstado(servidor, cuerpo) -> Promise<object>` (`fetch` POST com corpo `JSON.stringify(cuerpo)`, sem `headers`, para `D.cfg.api` quando `servidor === "apps"` e para `SERVIDOR_ESTADO` quando `"worker"`; devolve o JSON); `function pedirEstado(cuerpo) -> Promise<{respuesta, servidor, reaccion}>` que chama `Protocolo.pedirEstado` com `modo: MODO_SERVIDOR` e `alCambiarModo` que atualiza `MODO_SERVIDOR` e persiste com `Protocolo.guardarModo(window.localStorage, …)`. `pedir()` (usado por `foto`, `mundo`, `logout`) e o `fetch` do login **não mudam** (ficam no Apps Script).

Comportamento (decisões do plano): `subirALaNube` e `bajarDeLaNube` passam a chamar `pedirEstado` em vez do `fetch`/`pedir` diretos e reagem pela tabela: `ok` → fluxo atual (inclusive guardar `D._v = j.v` e baixar de novo quando `fusionado`); `clave` → `claveVencida()`; `sinAcceso` → `setSync("err", …)` com o texto `El servidor de acceso no responde. Reintento solo.`, **sem deslogar**, e no `subirALaNube` `programarReintento()`; `conflicto` → toast `Hubo un choque de cambios. Se reintenta solo.` e `programarReintento()`; `fotos` → toast `No se pudieron subir las fotos. Se reintenta solo.` e `programarReintento()`; `error` e falha de rede → como hoje. Em `bajarDeLaNube`: **só `ok:true` com `data` nulo/sem `cfg`** mantém o aviso atual "El servidor todavía no tiene datos" e o `listoParaSubir = true`; **qualquer `ok:false` (exceto `clave`) NÃO põe `listoParaSubir` em `true`** e mostra o erro do protocolo. Depois de uma troca de modo o `D._v` guardado continua válido (o Worker trata versão desconhecida como atrasada e funde).

`scripts/ensayo-protocolo.js`: usa Playwright do ambiente (`require("playwright")`, sem instalar nada no repositório), sobe `python3 -m http.server` na raiz numa porta livre, abre `/app/` com `page.route` interceptando `https://script.google.com/**` e `https://playmind3d-api-prod.pdroarraes.workers.dev/**` (nada sai para a rede real), semeia `localStorage["playmind3d:v2"]` com um estado inventado (`cfg.token:"tok-ensayo"`, `cfg.api` apontando para o endereço interceptado do Apps Script, 2 peças, 1 venda) e imprime `OK`/`FALLA` por cenário; sai com código 0 só se todos passarem.

- [ ] **Step 1: Escrever o ensaio que falha** (`scripts/ensayo-protocolo.js`; rodar contra o `app.js` atual deve dar `FALLA` nos cenários de troca de modo): cenários, cada um com a observação indicada:
  1. *Apps normal:* Apps Script responde `ok` a `load` e `save` → nenhuma chamada ao Worker, `localStorage["pm3d:servidor-estado"]` ausente ou `apps`, `D._sucio === false` depois do save, `#syncTxt` indica "En la nube".
  2. *Corte com a sessão aberta:* `save` responde `{ok:false,error:"migrado"}` no Apps Script e `ok` (`v:"1900000000"`) no Worker → o Worker recebe **o mesmo corpo** (mesmo `token`, mesma `data`), `localStorage["pm3d:servidor-estado"] === "worker"`, `D._sucio === false`, `D._v === "1900000000"`; um segundo `save` vai direto ao Worker sem passar pelo Apps Script.
  3. *Início já no Worker:* com o modo `worker` persistido, `load` vai ao Worker; `ok` e dados → a tela mostra o estado; `listoParaSubir` fica `true`.
  4. *Rollback:* modo `worker` persistido; o Worker responde `revertido` ao `save` e o Apps Script responde `ok` → modo volta a `apps`, o save termina `ok`.
  5. *Laço impossível:* Apps Script `migrado` e Worker `revertido` para a mesma requisição → no máximo duas requisições por tentativa, estado de erro visível, nenhuma terceira chamada.
  6. *Apps Script do acesso fora do ar:* Worker responde `auth_no_disponible` → **não** aparece a tela de login (`#entrada` continua oculta), `D.cfg.token` não muda, `#syncTxt` mostra o texto de `sinAcceso`, e uma nova tentativa depois de a stub voltar ao normal salva.
  7. *Sessão inválida:* resposta `clave` → aparece a tela de login (comportamento atual).
  8. *Falha de rede:* a stub aborta a requisição → `D._sucio` continua `true` e há reintento agendado.
  9. *Load com erro não libera o save:* `load` responde `{ok:false,error:"qualquer"}` → `listoParaSubir` continua `false` e o estado local (peças e venda semeadas) fica intacto depois de uma edição seguida de `save()`: nenhuma requisição `save` sai.
  10. *Sem dados de verdade:* `load` responde `{ok:true,data:null}` → aviso "todavía no tiene datos" e `listoParaSubir === true` (comportamento atual preservado).
- [ ] **Step 2: Rodar e ver falhar:** `node scripts/ensayo-protocolo.js` → `FALLA` nos cenários 2, 4, 5, 6 (e 9 se a regra nova de `listoParaSubir` ainda não existe).
- [ ] **Step 3: Implementar** as constantes, `enviarEstado`, `pedirEstado` e as reações em `subirALaNube`/`bajarDeLaNube`/`claveVencida` em `app/app.js`, localizando cada função por `grep -n` (não ler o arquivo inteiro). Manter intactos o login, `pedir()`, `foto`, `mundo` e `logout`.
- [ ] **Step 4: Rodar:** `node --check app/app.js`; `node scripts/ensayo-protocolo.js` → todos `OK`, código 0; suíte completa verde.
- [ ] **Step 5: Commit:** "app troca de servidor pelo erro recebido e não libera o save depois de um load com erro". **Não publicar** (nada vai para a `main` sem o aval do Pedro; o app novo precisa estar no ar dias antes do corte).

---

### Task 6: Os outros dois chamadores — página da raiz e `cadastro-worker`

**Files:**
- Modify: `index.html` (raiz), `cadastro-worker/src/appsscript.js`, `cadastro-worker/src/index.js` (só o necessário), `cadastro-worker/wrangler.toml`, `scripts/ensayo-protocolo.js`
- Create: `cadastro-worker/test/appsscript.test.js`

**Interfaces:**
- Consumes: `Protocolo` (Task 4). A página da raiz carrega `app/protocolo.js` com `<script src="app/protocolo.js">` (já é público e coberto pelo cache do app); o `cadastro-worker` importa `../../app/protocolo.js` (bundle do `wrangler`, mesmo mecanismo do `api-worker/src/calculo.js`).
- Produces: na página da raiz, uma função de topo `enviarEdicionPieza(nombre: string, campos: object, clave: string) -> Promise<object>` (extraída do manipulador do botão de guardar da edição de peça) que usa `Protocolo.pedirEstado` para a ação `editarPieza` e persiste o modo em `localStorage["pm3d:servidor-estado"]`; o fluxo de erro `clave` do manipulador não muda; o catálogo (`?action=catalogo`) **continua lendo o Apps Script** (ele encaminha ao Worker com a chave ligada). No `cadastro-worker`: `pedir(env, cuerpo)` passa a usar `Protocolo.pedirEstado` com `modo: env.MODO_SERVIDOR === "worker" ? "worker" : "apps"`; `enviar` usa `env.APPS_SCRIPT_URL` ou `env.API_WORKER_URL`; as três funções exportadas (`resumenYSesion`, `agregarPieza`, `agregarFilamento`) mantêm assinatura e retorno; `resumenYSesion` continua tratando só `clave` como sessão inválida e agora também trata `auth_no_disponible` como sessão válida sem resumo (o chat segue sem contexto do negócio, sem expulsar o usuário).
- `cadastro-worker/wrangler.toml`: `API_WORKER_URL = "https://playmind3d-api-prod.pdroarraes.workers.dev/"` e `MODO_SERVIDOR = "apps"` em `[vars]` (valores públicos, sem segredo).

- [ ] **Step 1: Escrever os testes que falham:** `cadastro-worker/test/appsscript.test.js` (ESM, `node:test`, `fetch` global substituído por um falso): com `MODO_SERVIDOR` ausente a chamada vai a `APPS_SCRIPT_URL`; resposta `migrado` → segunda chamada a `API_WORKER_URL` com o mesmo corpo e o retorno é o do Worker; com `MODO_SERVIDOR:"worker"` a primeira chamada já vai ao Worker; `resumenYSesion` com `{ok:false,error:"clave"}` → `sesionOk:false`, com `auth_no_disponible` → `sesionOk:true, resumen:null`, com `migrado` seguido de `ok` do Worker → `sesionOk:true` e o resumo do Worker; `agregarPieza`/`agregarFilamento` repassam `migrado`→Worker; `fetch` que rejeita propaga a exceção (como hoje). Ampliar `scripts/ensayo-protocolo.js` com o cenário 11 da página da raiz: abrir `/` com as rotas interceptadas (catálogo e Apps Script), chamar `enviarEdicionPieza("peça x", {desc:"a"}, "tok-ensayo")` por `page.evaluate`: Apps Script `migrado` → o Worker recebe o mesmo corpo `editarPieza` e o retorno é o dele; com o modo `worker` persistido a primeira chamada já vai ao Worker.
- [ ] **Step 2: Rodar e ver falhar:** `node --test cadastro-worker/test/*.test.js` e `node scripts/ensayo-protocolo.js`.
- [ ] **Step 3: Implementar** a extração de `enviarEdicionPieza` e o `<script>` na raiz, e o uso do protocolo no `cadastro-worker`; `cadastro-worker/package.json` já é ESM. Não rodar `npm install`.
- [ ] **Step 4: Rodar:** `node --test tests/*.test.js api-worker/test/*.test.js cadastro-worker/test/*.test.js`; `node scripts/ensayo-protocolo.js` → todos `OK`.
- [ ] **Step 5: Commit:** "página da raiz e cadastro-worker tentam o Worker quando o Apps Script responde migrado". Nada é publicado.

---

### Task 7: Roteiro do dia do corte e `CLAUDE.md`

**Files:**
- Create: `docs/migracion-d1-corte.md`
- Modify: `CLAUDE.md` (só fatos: comandos de teste, contagem real de arquivos de teste, `app/protocolo.js`, `cadastro-worker/test/`, `scripts/ensayo-protocolo.js` na tabela; nenhuma regra nova)

**Interfaces:** nenhuma de código; produz o roteiro que o controlador executa com o Pedro.

Conteúdo obrigatório do roteiro (português, passos numerados, cada um com o comando ou trecho exato, o resultado esperado e quem faz): **Antes (dias antes):** checklist com o app novo publicado há ≥ 3 dias, `exportarEstado` e `guardarSnapshot` novos publicados no Apps Script (**Versão: NUEVA**), Worker de produção no ar com `MODO=escritura` e `SNAPSHOT=off`, `d1:catalogoUrl` definido pelo menu, fuso do projeto do Apps Script conferido (America/Argentina/Buenos_Aires), medidor de espaço abaixo de 45.000, o Pedro online e fora do horário de venda. **O corte:** (1) ligar a chave pelo menu ("D1: activar modo migrado": congela as gravações); (2) o Pedro cola um trecho de console em `https://playmind3d.com/app/` que chama `exportarEstado` e **baixa** o arquivo (sem imprimir dados), igual ao trecho usado na Etapa 0; (3) carregar no D1 de produção com `node scripts/migracion-d1.js carga … --v-inicial <segundos atuais>` e `wrangler d1 execute playmind-prod --remote --file …`, e conferir com `comparar` contagens e hash contra o arquivo exportado; (4) deploy do Worker de produção com `SNAPSHOT=on`; (5) fumaça: o trecho do console da Etapa 1a apontando para o Worker de produção (`load`, `save`) e `GET /salud` mostrando `modo` e `snapshot`; (6) conferir que o catálogo público é igual ao de antes (contagens) e que o medidor de espaço da planilha mostra o valor do snapshot; (7) ida e volta: `MODO=solo-lectura` (deploy), conferir que um app aberto cai no Apps Script ou mostra o erro e **que o último snapshot tem a `v` igual à do D1** (`/salud`), desligar a chave pelo menu, conferir que o app funciona no Apps Script, ligar a chave de novo, `MODO=escritura` (deploy), conferir. **Rollback a qualquer momento:** `MODO=solo-lectura` → conferir snapshot → desligar a chave, em até 2 minutos (nesse intervalo os apps podem mostrar erro e reintentar, sem perder dados locais); o limite honesto (estado < ~45.000 caracteres) e o que pode se perder (gravações no D1 depois do último snapshot e antes do `solo-lectura`). **Depois:** observar ≥ 2 semanas com o Pedro disponível, o que olhar (`/salud`, medidor, vendas), quando desligar o `SNAPSHOT`, e que a Etapa 2 (vendas como tabela) começa em até 4 semanas depois do corte. Incluir os critérios de sucesso do spec e uma tabela "o que fazer se…" (erro `migrado` num app antigo, Apps Script fora do ar, medidor perto de 45.000, snapshot `excede`).

- [ ] **Step 1: Escrever `docs/migracion-d1-corte.md`** com o conteúdo acima; validar com `node --check` os trechos de console (embrulhados em arquivo temporário no scratchpad) e rodar o trecho de download com `localStorage` e `fetch` falsos (token inventado, sem rede) provando que **não imprime o token nem os dados**.
- [ ] **Step 2: Atualizar o `CLAUDE.md`** só com fatos: o novo comando de testes (com `cadastro-worker/test/*.test.js`), contagens reais (`ls`), as linhas de `app/protocolo.js`, `scripts/ensayo-protocolo.js` (Playwright do ambiente) e `cadastro-worker/test/`.
- [ ] **Step 3: Rodar** a suíte completa. **Commit:** "roteiro do corte e CLAUDE.md com o protocolo".

---

### Task 8: Publicar o que falta na Cloudflare (precisa do aval explícito do Pedro)

**Files:**
- Modify: `docs/migracion-d1.md` (registrar o estado publicado)

**Interfaces:** consome o Worker (Task 2) e o `cadastro-worker` (Task 6).

**Antes de começar, o controlador pergunta ao Pedro** e só segue com o "sim": isto publica um Worker novo e público (produção, banco vazio) e redeploya o `cadastro-worker` (o chat de cadastro). Credencial: token da Cloudflare já salvo no ambiente (`CLOUDFLARE_API_TOKEN=proxy-injected`); comandos a partir da pasta de cada Worker; staging com `--env=""`, produção com `--env prod`. Nada de segredos novos, nada de dados nos bancos.

- [ ] **Step 1:** aplicar `0002_meta.sql` ao D1 de staging (`--remote`, `--env=""`) e ao de produção (`--env prod`) e confirmar com `SELECT name FROM sqlite_master` que `estado` e `meta` existem nos dois (staging mantém o estado real: a migração só **cria** a tabela `meta`).
- [ ] **Step 2:** `npx wrangler deploy --dry-run` e depois deploy do Worker de **staging** (`--env=""`) e do de **produção** (`--env prod`, nome `playmind3d-api-prod`, `MODO=escritura`, `SNAPSHOT=off`). Verificar nos dois com `curl -i`: `GET /salud` → 200 com `modo:"escritura"` e `snapshot:null`; `POST` sem token → `{"ok":false,"error":"clave"}`; `GET /catalogo` no de produção → `{"ok":true,"catalogo":{"piezas":[]…}}` com banco vazio e `access-control-allow-origin: *`.
- [ ] **Step 3:** deploy do `cadastro-worker` (a partir de `cadastro-worker/`, com as variáveis novas do `wrangler.toml`); conferir apenas que o deploy termina sem erro e que `API_WORKER_URL` e `MODO_SERVIDOR` aparecem nas variáveis (nenhuma chamada ao Gemini).
- [ ] **Step 4:** atualizar `docs/migracion-d1.md` (português) com: URLs e ids de versão, o que está publicado em cada Worker, que a chave `d1:migrado` e `SNAPSHOT` continuam desligadas, e o que o roteiro (`docs/migracion-d1-corte.md`) ainda depende de o Pedro fazer (publicar o Apps Script, publicar o app). **Commit:** "Workers publicados: staging, produção vazia e cadastro-worker com o endereço do Worker". Parar aqui: publicar o app (merge na `main`) e o dia do corte são decisões do Pedro.
