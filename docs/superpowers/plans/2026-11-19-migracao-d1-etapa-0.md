# Migração para o D1 — Etapa 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir, ao lado do sistema atual e sem mudar o que a família usa, o `calculo.js` compartilhado, o Worker `playmind3d-api` com o esquema do D1 (versão numérica e lock otimista) e o script de migração verificável, medindo os limites reais do D1.

**Architecture:** `app/calculo.js` é um script clássico (mesmo padrão de `app/presupuesto.js`: `module.exports` em Node, global no navegador) que o app e o Worker usam; `calcular_()` do `Codigo.gs` fica alinhado a ele por testes de paridade até o cutover. O Worker novo vive em `api-worker/` (ESM, `wrangler`, D1 binding `DB`) e guarda o estado como uma linha em `estado` com versão inteira. A lógica de estado é testada com SQL de verdade via `node:sqlite` (Node 22), sem dependência nova.

**Tech Stack:** JS puro; `node:test`; `node:sqlite` (só em testes); Cloudflare Workers + D1 + `wrangler` (só em `api-worker/`).

**Spec:** `docs/superpowers/specs/2026-11-19-migracao-d1-design.md` (seção "Etapa 0"). Esta etapa não inclui: fusão no Worker, autenticação, catálogo no Worker, chave de migração, rollback (tudo isso é Etapa 1, com plano próprio depois que a Task 6 medir os limites) nem `vendas` como tabela (Etapa 2).

## Global Constraints

- Comentários e textos novos em espanhol (es-AR); documentos e conversa com o Pedro em português.
- Sem build step em `app/`. `wrangler` só vale dentro de `api-worker/`.
- Arquivo novo em `app/` entra em `ARCHIVOS` do `app/sw.js` e o `CACHE` muda de versão (hoje `playmind3d-v24`).
- `calc()` (app) e `calcular_()` (`server/Codigo.gs`) precisam concordar; pontos obrigatórios: fallback para o primeiro filamento/impressora quando o id não existe, gramas arredondados a uma casa, `merma` assumindo 12 quando não houver valor, preço manual só valendo se for maior que zero.
- Se `server/Codigo.gs` mudar, lembrar o Pedro de publicar **Versão: NUEVA** no Apps Script.
- Nunca credencial no código (`wrangler secret`, Script Properties).
- **Nada desta etapa vai para a `main` nem para produção sem aval explícito do Pedro** (regra do Natal). Trabalhar na branch `ccr-fa7f622c-tg1hfl`.
- **Dados reais do negócio nunca entram no git.**
- Testes: `node --test tests/*.test.js api-worker/test/*.test.js` (não usar `node --test tests/`). Depois de mexer em `app/app.js`: `node --check app/app.js`.
- Um commit por mudança, mensagem em português, terminando com as linhas de atribuição da sessão.

## Review Focus

1. Banco recém-criado (sem linha `estado`): `leerEstado` devolve `{ data: null, v: 0 }` e o primeiro save com `baseV` 0 funciona. → Task 4.
2. Texto com aspas simples, acentos e emoji (`Pata d'oro`, `Llavero 🎨`) sobrevive à geração de SQL e volta idêntico. → Task 5.
3. Estado acima de 50.000 caracteres (o motivo da migração) grava e volta intacto. → Task 4.
4. `calcular` com `data` sem `filamentos`/`impresoras`/`insumos` ou sem `cfg` não lança erro. → Task 1.
5. Arquivo de estado real exportado pelo Pedro não pode ser commitado por descuido. → Task 5 (`.gitignore`) e Task 6 (`git status` antes de cada commit).

---

### Task 1: `app/calculo.js` + paridade com `calcular_`

**Files:**
- Create: `app/calculo.js`, `tests/calculo-paridad.test.js`, `tests/fixtures/calculo-dorados.json`, `docs/migracion-d1.md`
- Modify: `server/Codigo.gs` (`calcular_`, só se a paridade exigir)

**Interfaces:**
- Produces: `Calculo.calcular(p: object, data: {cfg, filamentos, impressoras, insumos}) -> {material, luz, desgaste, trabalho, insumos, reserva, custo, preco, lucro, margem, horas, porHora, gramos}`; `Calculo.gramosCon(p, cfg) -> number`; `Calculo.unitario(it) -> number`; `Calculo.num(v) -> number`; `Calculo.ceilTo(v, paso) -> number`. Global `Calculo` no navegador; `module.exports` em Node.

`calculo.js` reproduz **exatamente** o comportamento atual de `calc()`/`gramosCon()`/`unitario()` de `app/app.js` (o que a tela mostra é a referência); é `calcular_()` que se alinha a ele.

- [ ] **Step 1: Gerar o oráculo e os casos dourados.** Script descartável (não commitado, no scratchpad) que carrega num `vm` as linhas 18–22 e 30 de `app/app.js` (`num`, `ceilTo`) e a seção `cálculo` até `/* ---------- stock ---------- */` (`calc`, `gramosCon`, `unitario`), com `D` definido, e grava `tests/fixtures/calculo-dorados.json`: lista de `{nombre, data, pieza, esperado}` onde `esperado` é o retorno atual de `calc(pieza)` mais `gramos: gramosCon(pieza)`. Casos obrigatórios (campo `nombre`): `base`, `filamento borrado cae al primero`, `impresora borrada cae a la primera`, `merma ausente es 12`, `merma 0 explicita`, `gramos a un decimal`, `manual 0 se ignora`, `manual vacio se ignora`, `manual negativo se ignora`, `manual positivo manda`, `round 50`, `round 0.5`, `insumo formato viejo`, `insumo borrado se ignora`, `risco y mult de la pieza en null usan cfg`, `cplx`, `listas ausentes`. Mais 200 casos aleatórios `aleatorio-N` (PRNG determinístico com semente fixa; valores com vírgula decimal em texto incluídos).
- [ ] **Step 2: Escrever o teste que falha** em `tests/calculo-paridad.test.js` (`require("../app/calculo.js")`):
  - `test("calculo.js reproduce los casos dorados del app")`: para cada caso, `assert.deepEqual(Calculo.calcular(c.pieza, c.data), {...c.esperado})` (igualdade exata, sem tolerância, porque o teto do preço vira em fronteiras).
  - `test("calcular_ del servidor coincide con calculo.js")`: carrega `Codigo.gs` num `vm` como em `tests/catalogo-publico.test.js` e, para todos os casos, `assert.equal` de `custo`, `preco`, `horas` e `gramos` entre `ctx.calcular_(pieza, data)` e `Calculo.calcular(pieza, data)`.
  - `test("calcular no falla con data vacia")`: `Calculo.calcular({peso: 10, h: 1}, {})` não lança e devolve números finitos.
- [ ] **Step 3: Rodar e ver falhar:** `node --test tests/calculo-paridad.test.js` → FAIL (`Cannot find module '../app/calculo.js'`).
- [ ] **Step 4: Implementar `app/calculo.js`** como IIFE no padrão de `app/presupuesto.js` (final: `if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.Calculo = api;`). Copiar a lógica de `calc`, `gramosCon`, `unitario`, `num`, `ceilTo` de `app/app.js` trocando `D.cfg`/`D.filamentos`/... pelo parâmetro `data` (usar `data.filamentos || []` etc.). Sem `Object.assign(raiz, ...)`: só o espaço `Calculo`, para não colidir com os `const num`/`ceilTo` do `app.js`.
- [ ] **Step 5: Rodar:** `node --test tests/calculo-paridad.test.js`. Os dourados devem passar. **O teste contra `calcular_` provavelmente falha**: há divergências conhecidas (`calcular_` faz `impresion * (1 + riesgo)` e o app `impresion + reserva`, o que muda o último bit do ponto flutuante; `calcular_` usa `Math.ceil(x / paso) * paso` e o app `ceilTo`, que ignora passos ≤ 1).
- [ ] **Step 6: Alinhar `calcular_` ao app** em `server/Codigo.gs` (mesma fórmula de custo, mesmo arredondamento do preço), comentário em espanhol explicando que reproduz `Calculo` de `app/calculo.js`. Rodar `node --test tests/*.test.js`; deve passar tudo. Se não houve divergência, não mexer em `Codigo.gs` e dizer isso no commit.
- [ ] **Step 7: Documentar** em `docs/migracion-d1.md` (criar) duas linhas sobre `calculo.js` (o que é e por que existe, no tom do `docs/calculo-de-custo.md`).
- [ ] **Step 8: Commit** (`app/calculo.js`, testes, fixture, doc e, se mudou, `server/Codigo.gs`): "calculo.js compartilhado com testes de paridade contra calcular_". Se `Codigo.gs` mudou, avisar o Pedro: publicar Versão NUEVA só quando ele decidir (não é urgente: o catálogo só passaria a divergir em casos de borda).

---

### Task 2: o app passa a usar `calculo.js`

**Files:**
- Modify: `app/app.js` (seção `cálculo`, linhas ~141–200), `app/index.html` (antes de `<script src="app.js">`, ~linha 915), `app/sw.js`

**Interfaces:**
- Consumes: `Calculo.calcular`, `Calculo.gramosCon`, `Calculo.unitario` (Task 1).
- Produces: `calc(p)`, `gramosCon(p)` e `unitario(it)` continuam existindo em `app.js` com a mesma assinatura (são chamados em dezenas de pontos); passam a ser delegações.

- [ ] **Step 1:** Em `app/app.js`, `calc(p)` vira `return Calculo.calcular(p, D);`, `gramosCon(p)` vira `return Calculo.gramosCon(p, D.cfg);`, `unitario(it)` vira `return Calculo.unitario(it);`. Manter os nomes e a posição; apagar os corpos antigos. `num` e `ceilTo` de `app.js` ficam como estão (outros usos).
- [ ] **Step 2:** Em `app/index.html` adicionar `<script src="calculo.js"></script>` antes de `app.js` (junto de `presupuesto.js`). Em `app/sw.js` incluir `'./calculo.js'` em `ARCHIVOS` e subir `CACHE` para `'playmind3d-v25'`.
- [ ] **Step 3: Verificar sintaxe e testes:** `node --check app/app.js` e `node --test tests/*.test.js` → ambos limpos.
- [ ] **Step 4: Verificar no navegador** (Playwright pré-instalado, servidor `python3 -m http.server` na raiz, página `/app/`): sem `pageerror`; `typeof Calculo === "object"`; para cada caso de `tests/fixtures/calculo-dorados.json`, aplicar `Object.assign(D, caso.data)` e comparar `calc(caso.pieza)` com `caso.esperado` (todos iguais). Script descartável, não commitado.
- [ ] **Step 5: Commit:** "app usa calculo.js para custo e preço (sw v25)". **Não fazer merge na `main`**: o app é o caminho do dinheiro e estamos antes do Natal; avisar o Pedro de que a mudança está só na branch e que a publicação é decisão dele.

---

### Task 3: esqueleto do Worker `api-worker/`

**Files:**
- Create: `api-worker/package.json`, `api-worker/wrangler.toml`, `api-worker/src/index.js`, `api-worker/src/cors.js`, `api-worker/src/calculo.js`, `api-worker/test/index.test.js`
- Modify: `CLAUDE.md` (mapa de arquivos e comando de testes), `docs/migracion-d1.md`

**Interfaces:**
- Produces: `export default { fetch(request: Request, env: {DB, ORIGENES_EXTRA?: string}): Promise<Response> }`; `origenPermitido(origin: string | null, env) -> string | null` em `src/cors.js` (permitidos: `https://playmind3d.com`, `https://www.playmind3d.com`, mais os de `env.ORIGENES_EXTRA` separados por vírgula); `src/calculo.js` reexporta `app/calculo.js` (`export { default } from "../../app/calculo.js"`).

O app envia `POST` com corpo `text/plain` e sem cabeçalhos próprios (sem preflight): o Worker lê `await request.text()` e responde com `Access-Control-Allow-Origin` da origem permitida.

- [ ] **Step 1: Escrever os testes que falham** (`api-worker/test/index.test.js`, ESM, `node:test`):
  - `GET /salud` → 200 e JSON `{ ok: true }`.
  - `OPTIONS /` com `Origin: https://playmind3d.com` → 204 e `access-control-allow-origin` igual à origem; com `Origin: https://malo.example` → sem esse cabeçalho.
  - `origenPermitido(null, {})` → `null`; `origenPermitido("http://localhost:8000", { ORIGENES_EXTRA: "http://localhost:8000" })` → a própria origem.
  - `import Calculo from "../src/calculo.js"`: `Calculo.calcular({peso: 10, h: 1}, {}).preco` é um número finito.
- [ ] **Step 2: Rodar e ver falhar:** `node --test api-worker/test/index.test.js` → FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar.** `package.json`: `{"name":"playmind3d-api","private":true,"type":"module","scripts":{"dev":"wrangler dev","deploy":"wrangler deploy"},"devDependencies":{"wrangler":"^4.0.0"}}`. `wrangler.toml`: `name = "playmind3d-api"`, `account_id` igual ao de `cadastro-worker/wrangler.toml`, `main = "src/index.js"`, `compatibility_date = "2026-08-20"`, bloco `[[d1_databases]]` com `binding = "DB"`, `database_name = "playmind-staging"` e `database_id = "PENDIENTE"` (a Task 6 preenche), mais `[env.prod]` com o banco `playmind-prod`. `src/index.js` roteia `/salud` e `OPTIONS`; qualquer outra rota responde 404 JSON `{ ok: false, error: "no encontrado" }`. Sem lógica de estado ainda.
- [ ] **Step 4: Rodar:** `node --test api-worker/test/index.test.js` → PASS. Rodar também `node --test tests/*.test.js` para ver que nada quebrou.
- [ ] **Step 5: Atualizar `CLAUDE.md`:** linha na tabela de arquivos para `api-worker/` e `app/calculo.js`; o comando de testes passa a ser `node --test tests/*.test.js api-worker/test/*.test.js`. Adicionar duas linhas em `docs/migracion-d1.md` sobre o Worker. Não rodar `npm install` na raiz.
- [ ] **Step 6: Commit:** "esqueleto do Worker playmind3d-api com CORS e /salud".

---

### Task 4: esquema do D1 e `leerEstado`/`guardarEstado` com lock otimista

**Files:**
- Create: `api-worker/migrations/0001_estado.sql`, `api-worker/src/estado.js`, `api-worker/test/d1-falso.js`, `api-worker/test/estado.test.js`
- Modify: `docs/migracion-d1.md`

**Interfaces:**
- Consumes: nada de tasks anteriores além da estrutura de `api-worker/`.
- Produces: `leerEstado(db) -> Promise<{ data: object | null, v: number }>`; `guardarEstado(db, data: object, baseV: number) -> Promise<{ ok: true, v: number } | { ok: false, conflicto: true, actual: { data: object, v: number } }>`; `crearD1() -> D1Falso` em `test/d1-falso.js` (aplica `migrations/0001_estado.sql` num `node:sqlite` em memória e implementa `prepare(sql).bind(...valores)` com `.first()`, `.run()` e `.all()` no formato do D1, onde `.run()` devolve `{ success: true, meta: { changes } }`).

Tabela: `estado(clave TEXT PRIMARY KEY, json TEXT NOT NULL, v INTEGER NOT NULL, actualizado TEXT NOT NULL)`; única `clave` usada: `"estado"`.

- [ ] **Step 1: Escrever os testes que falham** (`api-worker/test/estado.test.js`):
  - `banco vacío`: `leerEstado(db)` → `{ data: null, v: 0 }`; `guardarEstado(db, {a: 1}, 0)` → `{ ok: true, v: 1 }` e `leerEstado` devolve `{ data: {a: 1}, v: 1 }`.
  - `versión correcta avanza`: salvar com `baseV` 1 → `v` 2 e dados novos.
  - `versión vieja es conflicto`: com `v` atual 2, `guardarEstado(db, {a: 3}, 1)` → `{ ok: false, conflicto: true, actual: { data: <o que está salvo>, v: 2 } }` e **nada é gravado**.
  - `dos guardados con la misma base`: `Promise.all([guardarEstado(db, X, 2), guardarEstado(db, Y, 2)])` → exatamente um `ok: true` e um `conflicto`.
  - `estado grande`: objeto com `JSON.stringify(...).length > 120000` salva e volta com `assert.deepEqual`.
  - `crearD1` devolve um banco novo e isolado a cada chamada.
- [ ] **Step 2: Rodar e ver falhar:** `node --test api-worker/test/estado.test.js` → FAIL.
- [ ] **Step 3: Implementar.** `0001_estado.sql` com a tabela acima. `leerEstado`: `SELECT json, v FROM estado WHERE clave = 'estado'`. `guardarEstado`: se `baseV === 0`, `INSERT ... ON CONFLICT(clave) DO NOTHING`; senão `UPDATE estado SET json = ?, v = v + 1, actualizado = ? WHERE clave = 'estado' AND v = ?`; sucesso quando `meta.changes === 1`, com o `v` novo relido; caso contrário devolve o conflito com o `actual` relido. Zerar `data.cfg.token` e `data.cfg.key` e apagar `data._v`/`data._sucio` antes de serializar (igual a `guardarEstado_`).
- [ ] **Step 4: Rodar:** `node --test api-worker/test/estado.test.js` → PASS; `node --test tests/*.test.js api-worker/test/*.test.js` → tudo verde.
- [ ] **Step 5: Duas linhas** em `docs/migracion-d1.md` sobre a versão numérica e por que o lock é "só grava se a versão ainda for a que você leu". **Commit:** "esquema do D1 e estado com lock otimista (testes com SQLite real)".

---

### Task 5: script de migração e verificação

**Files:**
- Create: `scripts/migracion-d1.js`, `api-worker/test/migracion.test.js`
- Modify: `.gitignore`, `docs/migracion-d1.md`

**Interfaces:**
- Consumes: `guardarEstado`/`leerEstado` e `crearD1` (Task 4).
- Produces (`scripts/migracion-d1.js`, CommonJS, `module.exports`): `canonico(data) -> string` (JSON com chaves ordenadas, sem `_v`, `_sucio`, `cfg.token`, `cfg.key`); `resumen(data) -> { listas: Record<string, number>, chars: number, hash: string }` (`listas` conta os arrays de `produtos`, `filamentos`, `impressoras`, `insumos`, `vendas`, `canais`, `packs`, `opiniones`, `radar`; `hash` é SHA-256 hex de `canonico`); `comparar(a: Resumen, b: Resumen) -> { iguales: boolean, diferencias: string[] }`; `sqlCarga(data, ahora: string) -> string` (`INSERT OR REPLACE INTO estado` com `v = 1`, aspas simples duplicadas). CLI: `node scripts/migracion-d1.js carga <estado.json> <saida.sql>`, `... resumen <estado.json>`, `... comparar <a.json> <b.json>`.

- [ ] **Step 1: Escrever os testes que falham** (`api-worker/test/migracion.test.js`, importando o script CommonJS como default):
  - `resumen cuenta listas`: estado de exemplo com 2 `produtos` e 1 `vendas` → `listas.produtos === 2`, `listas.vendas === 1`, `chars > 0`.
  - `hash no depende del orden de claves ni de campos de sesión`: mesmo dado com chaves em outra ordem e com `_v`/`cfg.token` diferentes → mesmo `hash`.
  - `hash cambia si cambia un dato`.
  - `comparar` devolve `iguales: false` e menciona a lista quando falta um item.
  - `sqlCarga round-trip`: estado com `nome: "Pata d'oro"` e `nome: "Llavero 🎨"`; executar o SQL no `crearD1()` e `leerEstado` devolve dados cujo `canonico` é igual ao original (executar o SQL via `db.exec`/equivalente exposto pelo `d1-falso`; se o helper não expõe `exec`, adicioná-lo ao helper).
- [ ] **Step 2: Rodar e ver falhar:** `node --test api-worker/test/migracion.test.js` → FAIL.
- [ ] **Step 3: Implementar `scripts/migracion-d1.js`** com as quatro funções e o CLI (`process.argv`); o CLI só roda se o arquivo for executado diretamente (`require.main === module`).
- [ ] **Step 4: Proteger dados reais:** adicionar ao `.gitignore`: `*.estado.json`, `*.carga.sql`, `salida-d1.json`, `datos-privados/`. Verificar com `git check-ignore -v ejemplo.estado.json`.
- [ ] **Step 5: Rodar tudo:** `node --test tests/*.test.js api-worker/test/*.test.js` → verde. Duas linhas em `docs/migracion-d1.md` sobre como se verifica a migração (contagens + hash). **Commit:** "script de migração ao D1 com verificação por contagens e hash".

---

### Task 6: provisionar o staging, ensaiar a migração e medir os limites

**Files:**
- Modify: `api-worker/wrangler.toml` (ids dos bancos), `docs/migracion-d1.md`
- Create: `docs/migracion-d1-limites.md`

**Interfaces:**
- Consumes: Worker (Task 3), esquema (Task 4), script de migração (Task 5).
- Produces: `docs/migracion-d1-limites.md` com os números reais e a decisão "catálogo pré-calculado no save" confirmada ou revista; bancos `playmind-staging` e `playmind-prod` criados com a migração `0001` aplicada; Worker de staging publicado.

Esta task fala com a conta Cloudflare do Pedro: **pedir o go-ahead dele antes de começar** e obter a credencial pelo mecanismo seguro da sessão (nunca em chat, nunca em arquivo). Dados reais só no `datos-privados/`, que está no `.gitignore`.

- [ ] **Step 1: Limites na documentação.** Consultar a documentação oficial da Cloudflare (tamanho máximo de linha/valor do D1, escritas por dia, CPU por requisição e tamanho do bundle no plano gratuito) e registrar em `docs/migracion-d1-limites.md`, cada número com a data e o endereço da página consultada. Marcar o que não foi possível confirmar.
- [ ] **Step 2: Criar os bancos:** `npx wrangler d1 create playmind-staging` e `... playmind-prod` (dentro de `api-worker/`); colocar os ids no `wrangler.toml`; `npx wrangler d1 migrations apply playmind-staging --remote` e idem `playmind-prod`. Verificar com `npx wrangler d1 execute playmind-staging --remote --command "SELECT name FROM sqlite_master"` (aparece `estado`).
- [ ] **Step 3: Verificar o bundle:** `npx wrangler deploy --dry-run --outdir /tmp/dist-api` termina sem erro, o que prova que `src/calculo.js` (que importa `app/calculo.js`) empacota. Depois `npx wrangler deploy` do staging e `curl -i -H "Origin: https://playmind3d.com" <url>/salud` → 200 com `access-control-allow-origin`.
- [ ] **Step 4: Ensaiar a migração com o estado real.** O Pedro exporta o estado do navegador (console do app: `copy(JSON.stringify(D))`) e salva em `datos-privados/real.estado.json`. Rodar `node scripts/migracion-d1.js carga datos-privados/real.estado.json datos-privados/real.carga.sql`, `npx wrangler d1 execute playmind-staging --remote --file datos-privados/real.carga.sql`, ler de volta com `--command "SELECT json FROM estado WHERE clave='estado'" --json` para `datos-privados/salida-d1.json` (extrair o campo `json`), e `node scripts/migracion-d1.js comparar datos-privados/real.estado.json datos-privados/salida-d1.json` → `iguales: true`. Rodar `git status` e confirmar que nenhum arquivo de `datos-privados/` aparece.
- [ ] **Step 5: Medir.** Com o estado real, medir localmente em Node o tempo de `Calculo.calcular` sobre todas as peças e sobre 10× esse número de peças; registrar no documento de limites junto com `chars` do estado e a comparação com o limite de CPU confirmado no Step 1. Concluir por escrito se o catálogo pré-calculado no save (decisão do design) continua necessário ou se calcular na leitura cabe com folga.
- [ ] **Step 6: Fechar a etapa.** Atualizar `docs/migracion-d1.md` com o estado real da etapa 0 e uma lista curta "o que a Etapa 1 precisa saber" (ids, URL do staging, números medidos). **Commit:** "staging do D1 provisionado, migração ensaiada e limites medidos". Parar aqui: a Etapa 1 pede plano e aval do Pedro, e só depois do Natal.
