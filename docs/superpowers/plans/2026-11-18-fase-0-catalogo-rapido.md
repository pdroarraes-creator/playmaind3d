# Fase 0 — catálogo público mais rápido: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir o catálogo público de hoje e aplicar os dois ganhos baratos (fotos reduzidas e cache), mais a medição do tamanho do estado, para decidir com números se a fase 1 (Cloudflare) é necessária.

**Architecture:** Tudo acontece em `server/Codigo.gs` (Apps Script). A saída de `catalogoPublico_()` passa a entregar fotos do Drive em tamanho reduzido; `doGet` passa a servir o catálogo de um cache de 15 minutos que é limpo sempre que o estado é gravado; `guardarEstado_` registra quanto da célula de 50.000 caracteres está em uso. Um script de Node mede antes e depois. O estado guardado e o front não mudam.

**Tech Stack:** Apps Script (ES5, sem módulos), testes `node --test` carregando `Codigo.gs` com `vm` e serviços simulados (padrão de `tests/servidor-foto.test.js`), Node 18+ para o script de medição.

**Spec:** `docs/superpowers/specs/2026-11-18-arquitetura-publico-interno-design.md` (seção "Fase 0")

## Global Constraints

- Sem build step, sem framework nem bundler; sem credencial no código.
- Célula do Sheets = 50.000 caracteres; não mudar o shape de `D`; a mudança só toca a **saída** do catálogo público, nunca o estado guardado nem os originais no Drive.
- Foto reduzida: sufixo `=w800` na URL `lh3.googleusercontent.com/d/<id>`; confirmar com medição antes de aceitar.
- Cache do catálogo: `CacheService` do script, limite por entrada ~100 KB (não gravar acima de 90.000 caracteres); `guardarEstado_` e `editarPieza_` limpam a chave ao gravar.
- Alvos de desempenho propostos: catálogo ~1 s, primeira foto ~1,5 s.
- Produção em época de pico: anotar a versão atual do Apps Script antes de publicar (rollback), publicar fora de horário de pico, testar em janela anônima e no celular.
- Deploy do Apps Script: salvar não basta; `Implementar > Administrar implementaciones > lápis > Versão: NUEVA`. Lembrar o dono.
- Comentários e textos novos em espanhol; commits em português, um por mudança, terminando com as linhas de atribuição da sessão. Rodar a suíte com `node --test tests/`.
- Não há mudança em `app/` nem no catálogo da raiz, logo `sw.js` não muda.

## Review Focus

1. Foto que não é do Drive (link externo, `data:` legado, vazia): sai idêntica, sem erro. → Task 2
2. URL que já tem sufixo de tamanho (`=w…`/`=s…`): não duplicar. → Task 2
3. Gravação direta por `editarPieza_` (não passa por `guardarEstado_`): o catálogo não pode ficar velho. → Task 3
4. `CacheService` indisponível ou catálogo grande demais: servir direto, sem erro para o visitante. → Task 3
5. Estado vazio ou sem peças: não cachear, para não esconder o primeiro cadastro. → Task 3
6. Falha ao registrar a medição do estado: nunca pode impedir um salvamento. → Task 4

---

### Task 1: Medição de base (antes de mudar qualquer coisa)

**Files:**
- Create: `scripts/medir-catalogo.js`
- Create: `docs/medicao-catalogo.md`
- Test: `tests/medir-catalogo.test.js`

**Interfaces:**
- Produces: `resumir(ms: number[]): {min: number, mediana: number, max: number}` exportado por `scripts/medir-catalogo.js`; CLI `node scripts/medir-catalogo.js [urlDoServidor]` (sem argumento, lê `SERVIDOR` de `index.html` por regex).

- [ ] **Step 1: Write the failing test** `resumir devuelve min, mediana y max` com `resumir([300, 100, 200])` igual a `{min: 100, mediana: 200, max: 300}`, e `resumir([100, 200])` com `mediana` 150.
- [ ] **Step 2: Run** `node --test tests/medir-catalogo.test.js` — Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement** `scripts/medir-catalogo.js`: `resumir` pura exportada; o resto roda só com `require.main === module`. O CLI faz 5 `GET ?action=catalogo`, imprime ms de cada um, `resumir`, bytes do corpo e número de peças; depois, para as 5 primeiras URLs de foto distintas, baixa cada uma **como está e com `=w800`** e imprime status, bytes e ms das duas versões. Só `fetch` nativo do Node.
- [ ] **Step 4: Run** `node --test tests/medir-catalogo.test.js` — Expected: PASS.
- [ ] **Step 5: Rodar o CLI contra o catálogo real** e colar a saída em `docs/medicao-catalogo.md`, seção "Antes". Se o container não alcançar `script.google.com`, pedir ao dono que rode `node scripts/medir-catalogo.js` e cole a saída. **Parar aqui se `=w800` não reduzir os bytes de forma clara** (esperado: de MB para centenas de KB): voltar ao dono antes da Task 2.
- [ ] **Step 6: Commit** `feat: script para medir o catálogo público e medição de base`.

### Task 2: Fotos reduzidas na saída do catálogo

**Files:**
- Modify: `server/Codigo.gs` (constante `FOTO_PARAM`, função `fotoChica_`, `catalogoPublico_` ~linha 701)
- Test: `tests/catalogo-publico.test.js`

**Interfaces:**
- Produces: `fotoChica_(url: string): string`. Só reescreve URLs que casam `^https://lh3\.googleusercontent\.com/d/[A-Za-z0-9_-]+$`, acrescentando `'=' + FOTO_PARAM` (`FOTO_PARAM = 'w800'`); qualquer outro valor volta exatamente igual (inclusive não-string).

- [ ] **Step 1: Write the failing tests** (carregar `Codigo.gs` com `vm` como em `servidor-foto.test.js`; para `catalogoPublico_`, sobrescrever `ctx.leerEstado_` com um estado mínimo que `calcular_` aceite: um filamento, uma impressora, um produto com `peso`, `h`, `m`):
  - `fotoChica_ achica fotos de Drive`: `https://lh3.googleusercontent.com/d/abc123` → `…/d/abc123=w800`.
  - `fotoChica_ no toca lo que ya tiene medida`: `…/d/abc123=s400` igual.
  - `fotoChica_ no toca otras URLs ni vacíos`: `https://ejemplo.com/a.jpg`, `data:image/png;base64,AAA`, `''`, `undefined` salem iguales.
  - `catalogoPublico_ entrega fotos chicas sin tocar el estado`: todas as `piezas[0].fotos` e `leti.foto` terminam em `=w800`, e `data.produtos[0].fotos[0]` do estado original continua sem sufixo.
- [ ] **Step 2: Run** `node --test tests/catalogo-publico.test.js` — Expected: FAIL (`fotoChica_` não definida).
- [ ] **Step 3: Implement** `fotoChica_` e aplicá-la com `map` em `fotos` (peça) e em `leti.foto` dentro de `catalogoPublico_`, trabalhando sobre cópias para não alterar `data`.
- [ ] **Step 4: Run** `node --test tests/` — Expected: tudo PASS.
- [ ] **Step 5: Commit** `feat(server): fotos do catálogo público em tamanho reduzido`.

### Task 3: Cache do catálogo com invalidação ao gravar

**Files:**
- Modify: `server/Codigo.gs` (constantes, `catalogoCacheado_`, `invalidarCatalogo_`, `doGet` ~linha 95, `guardarEstado_` ~linha 385, `editarPieza_` ~linha 432)
- Test: `tests/catalogo-cache.test.js`

**Interfaces:**
- Consumes: `catalogoPublico_(): object` (Task 2).
- Produces: `catalogoCacheado_(): object` e `invalidarCatalogo_(): void`; constantes `CATALOGO_CLAVE_CACHE = 'catalogo'`, `CATALOGO_TTL_S = 900`, `CATALOGO_MAX_CHARS = 90000`. Regras: acerto devolve o JSON guardado; falha calcula com `catalogoPublico_()` e só grava se `piezas.length > 0` e o texto tiver menos de `CATALOGO_MAX_CHARS`; toda chamada ao `CacheService` fica em `try/catch` e erro cai para o cálculo direto; `invalidarCatalogo_` ignora erros.

- [ ] **Step 1: Write the failing tests** (cache falso com `Map` que conta `get`/`put`/`remove`; `ctx.leerEstado_` falso que conta chamadas; para `guardarEstado_`, simular `LockService` (`waitLock`/`releaseLock` vazios), `SpreadsheetApp` com planilha falsa que devolve uma linha `[CLAVE, '{}', new Date()]` e aceita `setValues`, e sobrescrever `moverFotosADrive_` (devolve o próprio dado), `volcarVentas_`, `volcarPiezas_`, `volcarStock_` (no-op)):
  - `la segunda llamada sale del cache`: duas chamadas, `leerEstado_` chamado 1 vez, resultados iguais.
  - `guardarEstado_ invalida el catálogo`: depois de aquecer, `guardarEstado_(estado, '')` e nova chamada → `leerEstado_` chamado 2 vezes.
  - `editarPieza_ invalida el catálogo`: idem com `editarPieza_`.
  - `no cachea un catálogo vacío`: `leerEstado_` devolve `null`; duas chamadas → computado 2 vezes.
  - `si el cache falla, sirve igual`: `getScriptCache` lança erro em um caso, e `put` lança erro em outro; ambos devolvem o catálogo sem exceção.
  - `no cachea lo demasiado grande`: catálogo com >90.000 caracteres → `put` não chamado.
- [ ] **Step 2: Run** `node --test tests/catalogo-cache.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** as duas funções e as constantes; `doGet` passa a chamar `catalogoCacheado_()`; chamar `invalidarCatalogo_()` logo depois do `setValues` bem-sucedido em `guardarEstado_` e em `editarPieza_`.
- [ ] **Step 4: Run** `node --test tests/` — Expected: tudo PASS.
- [ ] **Step 5: Commit** `feat(server): cache do catálogo público, limpo ao gravar`.

### Task 4: Medir quanto da célula está em uso

**Files:**
- Modify: `server/Codigo.gs` (constante `CELDA_MAX`, `medirEstado_`, linha em `guardarEstado_` depois de `var txt = JSON.stringify(data)`, `menuVerEspacio`, entrada nova em `onOpen` ~linha 247)
- Test: `tests/estado-medida.test.js`

**Interfaces:**
- Produces: `CELDA_MAX = 50000`; `medirEstado_(txt: string): {chars: number, pct: number}` com `pct = Math.round(chars / CELDA_MAX * 1000) / 10`. `guardarEstado_` grava em Script Properties (via `props_()`), chave `medida:estado`, o JSON `{chars, pct, cuando}` dentro de `try/catch`. `menuVerEspacio()` mostra um alerta com caracteres e %; a partir de 70% avisa que é o gatilho da fase 3.

- [ ] **Step 1: Write the failing tests:**
  - `medirEstado_ calcula caracteres y porcentaje`: texto de 35.000 caracteres → `{chars: 35000, pct: 70}`; texto de 1 caractere → `pct` 0.
  - `guardarEstado_ no falla si no puede guardar la medida`: `ctx.props_` lança erro, `guardarEstado_` (com os mesmos falsos da Task 3) retorna normalmente.
  - `guardarEstado_ registra la medida`: `props_` falso captura `setProperty('medida:estado', …)` com `chars` igual ao tamanho do JSON gravado.
- [ ] **Step 2: Run** `node --test tests/estado-medida.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement** conforme a interface; `menuVerEspacio` fica fino (lê a propriedade e chama `SpreadsheetApp.getUi().alert`); adicionar `.addItem('Ver cuánto espacio queda', 'menuVerEspacio')` ao menu.
- [ ] **Step 4: Run** `node --test tests/` — Expected: tudo PASS.
- [ ] **Step 5: Commit** `feat(server): mede quanto da célula de 50.000 caracteres está em uso`.

### Task 5: Publicar, medir de novo e decidir

**Files:**
- Modify: `docs/medicao-catalogo.md` (seção "Depois" e "Decisão")
- Modify: `CLAUDE.md` (fatos desatualizados e a regra do cache)

Esta task é do dono em parte (o executor não consegue publicar o Apps Script).

- [ ] **Step 1:** `node --test tests/` — Expected: todos PASS.
- [ ] **Step 2:** Pedir ao dono para anotar em `docs/medicao-catalogo.md` o número da **versão atual** do Apps Script ("Versão anterior: N") antes de publicar.
- [ ] **Step 3:** Dono copia `server/Codigo.gs` para o editor, salva e publica com **Versão: NUEVA**, fora de horário de pico. Rollback = reativar a versão anotada.
- [ ] **Step 4:** Dono recarrega a planilha, usa "Ver cuánto espacio queda" e informa o percentual (registrar em `docs/medicao-catalogo.md`).
- [ ] **Step 5:** Rodar `node scripts/medir-catalogo.js` de novo (a 1ª chamada pode ser um miss de cache e as seguintes devem ser acertos; anotar as duas coisas) e registrar em "Depois". Dono confere o catálogo no celular, em janela anônima, e edita uma peça para ver o catálogo atualizar.
- [ ] **Step 6:** Escrever a "Decisão": se a mediana do catálogo ≤ 1.000 ms e a primeira foto ≤ ~200 KB, a fase 1 **não** é necessária agora; caso contrário, justificar a fase 1 com os números. Incluir o percentual do estado e se há risco de chegar a 35.000 caracteres (gatilho da fase 3).
- [ ] **Step 7:** Atualizar `CLAUDE.md`: `app.js` com 4.670 linhas e 50 `onclick`; existem `tests/` e `cadastro-worker/`; nova regra "toda função que grava a célula `estado` deve chamar `invalidarCatalogo_()`"; menu novo de espaço. Lembrar o dono do deploy NUEVA.
- [ ] **Step 8: Commit** `docs: medição da fase 0, decisão sobre a fase 1 e CLAUDE.md atualizado`.
