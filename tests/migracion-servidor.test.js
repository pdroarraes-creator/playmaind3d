// Prueba la chave de migración a D1, subirFotos, guardarSnapshot y el desvío
// del catálogo en server/Codigo.gs. Datos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");

const CODIGO = fs.readFileSync(__dirname + "/../server/Codigo.gs", "utf8");

// Contexto con servicios de Google simulados. `o.migrado`, `o.url`, `o.sesion`
// y `o.fetch` controlan el escenario; el resto se lee de lo devuelto.
function cargar(o = {}) {
  const props = {};
  if (o.migrado) props["d1:migrado"] = "1";
  if (o.url) props["d1:catalogoUrl"] = o.url;
  const esp = { hojaLeida: 0, setValues: [], orden: [], volcado: 0, fotos: 0, cacheLeido: 0, fetchs: [] };
  const ctx = {
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (t) => ({ t, setMimeType() { return this; } }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { esp.orden.push("unlock"); } }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => {
        esp.hojaLeida++;
        return {
          getSheetByName: () => ({
            getLastRow: () => 2,
            getRange: () => ({
              getValues: () => [[ctx.CLAVE, "{}", ""]],
              setValues: (v) => { esp.setValues.push(v); esp.orden.push("setValues"); },
            }),
          }),
        };
      },
    },
    UrlFetchApp: {
      fetch: (url, opts) => {
        esp.fetchs.push([url, opts]);
        if (o.fetch) return o.fetch();
        return { getResponseCode: () => 200, getContentText: () => '{"ok":true,"catalogo":{"piezas":[]}}' };
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(CODIGO, ctx);
  ctx.props_ = () => ({
    getProperty: (k) => {
      if (o.migradoFalla && k === "d1:migrado") throw new Error("Service invoked too many times");
      return k in props ? props[k] : null;
    },
    setProperty: (k, v) => { props[k] = v; },
    deleteProperty: (k) => { delete props[k]; },
  });
  ctx.porSesion_ = (t) => (t === "bueno" ? { email: "a@b.c" } : null);
  ctx.moverFotosADrive_ = (d) => { esp.fotos++; d.movido = true; return d; };
  ctx.volcarVentas_ = ctx.volcarPiezas_ = ctx.volcarStock_ = () => { esp.volcado++; };
  ctx.invalidarCatalogo_ = () => { esp.orden.push("invalidar"); };
  ctx.catalogoCacheado_ = () => { esp.cacheLeido++; return { piezas: ["viejo"] }; };
  ctx.fotoBase64_ = () => ({ ok: true, foto: "x" });
  return { ctx, props, esp };
}

const post = (ctx, body) =>
  JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).t);
const get = (ctx, p) => JSON.parse(ctx.doGet({ parameter: p }).t);

test("chave desligada: load responde como antes", () => {
  const { ctx, esp } = cargar();
  const r = post(ctx, { action: "load", token: "bueno" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, {});
  assert.equal(r.v, "");
  assert.ok(esp.hojaLeida > 0);
});

test("chave ligada: mundo no se bloquea", () => {
  const { ctx } = cargar({ migrado: true });
  ctx.leerMundo_ = () => ({ x: 1 });
  assert.deepEqual(post(ctx, { action: "mundo", token: "bueno" }), { ok: true, mundo: { x: 1 } });
});

test("si no se puede leer la chave, save falla cerrado: no graba y responde ok:false", () => {
  const { ctx, esp } = cargar({ migradoFalla: true });
  const r = post(ctx, { action: "save", token: "bueno", data: { produtos: [] } });
  assert.equal(r.ok, false);
  assert.equal(esp.setValues.length, 0);
  assert.equal(esp.hojaLeida, 0);
});

test("si no se puede leer la chave, validarSesion y foto no dependen de ella", () => {
  const { ctx } = cargar({ migradoFalla: true });
  assert.deepEqual(post(ctx, { action: "validarSesion", token: "bueno" }), { ok: true });
  assert.equal(post(ctx, { action: "foto", token: "bueno", id: "z" }).foto, "x");
});

test("si no se puede leer la chave, doGet catálogo sirve el camino viejo", () => {
  const { ctx } = cargar({ migradoFalla: true });
  assert.deepEqual(get(ctx, { action: "catalogo" }), { ok: true, catalogo: { piezas: ["viejo"] } });
});

test("guardarSnapshot con la chave desligada: no migrado, sin grabar ni invalidar", () => {
  const { ctx, esp } = cargar();
  const r = post(ctx, { action: "guardarSnapshot", token: "bueno", data: { produtos: [] } });
  assert.deepEqual(r, { ok: false, error: "no migrado" });
  assert.equal(esp.setValues.length, 0);
  assert.equal(esp.orden.includes("invalidar"), false);
  assert.equal(esp.hojaLeida, 0);
});

test("guardarSnapshot_ no muta el data del llamador", () => {
  const { ctx } = cargar({ migrado: true });
  const data = { cfg: { token: "secreto", key: "k" }, produtos: [], _v: "9" };
  ctx.guardarSnapshot_(data);
  assert.equal(data.cfg.token, "secreto");
  assert.equal(data.cfg.key, "k");
  assert.equal(data._v, "9");
});

test("chave ligada: las seis acciones responden migrado sin tocar la planilla", () => {
  const { ctx, esp } = cargar({ migrado: true });
  for (const action of ["load", "save", "editarPieza", "agregarPieza", "agregarFilamento", "resumenNegocio"]) {
    const r = post(ctx, { action, token: "bueno", data: {}, pieza: {}, filamento: {} });
    assert.deepEqual(r, { ok: false, error: "migrado" }, action);
  }
  assert.equal(esp.hojaLeida, 0);
});

test("chave ligada: sin sesión sigue respondiendo clave", () => {
  const { ctx } = cargar({ migrado: true });
  assert.equal(post(ctx, { action: "load", token: "malo" }).error, "clave");
});

test("chave ligada: foto y validarSesion siguen normales", () => {
  const { ctx } = cargar({ migrado: true });
  assert.deepEqual(post(ctx, { action: "validarSesion", token: "bueno" }), { ok: true });
  assert.equal(post(ctx, { action: "foto", token: "bueno", id: "z" }).foto, "x");
});

test("subirFotos: sesión válida devuelve el data con fotos movidas", () => {
  const { ctx, esp } = cargar();
  const r = post(ctx, { action: "subirFotos", token: "bueno", data: { produtos: [] } });
  assert.equal(r.ok, true);
  assert.equal(r.data.movido, true);
  assert.equal(esp.fotos, 1);
});

test("subirFotos: sin sesión -> clave; data no objeto -> datos invalidos", () => {
  const { ctx, esp } = cargar();
  assert.equal(post(ctx, { action: "subirFotos", token: "malo", data: {} }).error, "clave");
  for (const data of [null, "x", 5, [1], undefined]) {
    assert.deepEqual(post(ctx, { action: "subirFotos", token: "bueno", data }),
      { ok: false, error: "datos invalidos" });
  }
  assert.equal(esp.fotos, 0);
});

test("subirFotos funciona también con la chave ligada", () => {
  const { ctx } = cargar({ migrado: true });
  assert.equal(post(ctx, { action: "subirFotos", token: "bueno", data: {} }).ok, true);
});

test("guardarSnapshot: graba la celda, invalida el catálogo después y limpia token/key/_v", () => {
  const { ctx, esp } = cargar({ migrado: true });
  const data = { cfg: { token: "secreto", key: "clave", marca: "M" }, produtos: [{ nome: "a" }], _v: "123" };
  const r = post(ctx, { action: "guardarSnapshot", token: "bueno", data, v: 1 });
  assert.deepEqual(r, { ok: true, guardado: true });
  assert.equal(esp.setValues.length, 1);
  const fila = esp.setValues[0][0];
  assert.equal(fila[0], "estado");
  const guardado = JSON.parse(fila[1]);
  assert.equal(guardado.cfg.token, "");
  assert.equal(guardado.cfg.key, "");
  assert.equal(guardado.cfg.marca, "M");
  assert.equal("_v" in guardado, false);
  assert.ok(!fila[1].includes("secreto"));
  assert.deepEqual(esp.orden, ["setValues", "invalidar", "unlock"]);
  assert.equal(esp.volcado, 0);
  assert.equal(esp.fotos, 0);
});

test("guardarSnapshot: estado de 50.000 caracteres o más no se graba", () => {
  const { ctx, esp } = cargar({ migrado: true });
  const data = { produtos: [{ nome: "x".repeat(50000) }] };
  const r = post(ctx, { action: "guardarSnapshot", token: "bueno", data, v: 1 });
  assert.deepEqual(r, { ok: true, guardado: false, motivo: "excede" });
  assert.equal(esp.setValues.length, 0);
  assert.equal(esp.orden.includes("invalidar"), false);
});

test("guardarSnapshot: sin sesión -> clave; data inválido -> datos invalidos", () => {
  const { ctx, esp } = cargar({ migrado: true });
  assert.equal(post(ctx, { action: "guardarSnapshot", token: "malo", data: {}, v: 1 }).error, "clave");
  assert.equal(post(ctx, { action: "guardarSnapshot", token: "bueno", data: [], v: 1 }).error, "datos invalidos");
  assert.equal(esp.setValues.length, 0);
});

test("doGet catálogo: chave ligada + URL + 200 ok reenvía lo recibido", () => {
  const { ctx, esp } = cargar({ migrado: true, url: "https://w.example/catalogo" });
  const r = get(ctx, { action: "catalogo" });
  assert.deepEqual(r, { ok: true, catalogo: { piezas: [] } });
  assert.equal(esp.fetchs[0][0], "https://w.example/catalogo");
  assert.equal(esp.fetchs[0][1].muteHttpExceptions, true);
  assert.equal(esp.cacheLeido, 0);
});

test("doGet catálogo: fallos del Worker -> catalogo no disponible, sin cache viejo", () => {
  const casos = {
    "500": () => ({ getResponseCode: () => 500, getContentText: () => '{"ok":true}' }),
    "json roto": () => ({ getResponseCode: () => 200, getContentText: () => "<html>" }),
    "ok false": () => ({ getResponseCode: () => 200, getContentText: () => '{"ok":false}' }),
    "excepción": () => { throw new Error("red"); },
  };
  for (const [nombre, fetch] of Object.entries(casos)) {
    const { ctx, esp } = cargar({ migrado: true, url: "https://w.example/c", fetch });
    assert.deepEqual(get(ctx, { action: "catalogo" }), { ok: false, error: "catalogo no disponible" }, nombre);
    assert.equal(esp.cacheLeido, 0, nombre);
  }
});

test("doGet catálogo: chave ligada sin URL o chave desligada usan el camino viejo", () => {
  for (const o of [{ migrado: true }, {}, { url: "https://w.example/c" }]) {
    const { ctx, esp } = cargar(o);
    assert.deepEqual(get(ctx, { action: "catalogo" }), { ok: true, catalogo: { piezas: ["viejo"] } });
    assert.equal(esp.fetchs.length, 0);
  }
});

test("activarModoD1_ y migrado_", () => {
  const { ctx, props } = cargar();
  assert.equal(ctx.migrado_(), false);
  ctx.activarModoD1_(true);
  assert.equal(props["d1:migrado"], "1");
  assert.equal(ctx.migrado_(), true);
  ctx.activarModoD1_(false);
  assert.equal("d1:migrado" in props, false);
  assert.equal(ctx.migrado_(), false);
});

test("guardarUrlWorker_ exige https, rechaza no-strings y recorta espacios", () => {
  const { ctx, props } = cargar();
  assert.throws(() => ctx.guardarUrlWorker_("http://w.example"), /https:\/\//);
  assert.throws(() => ctx.guardarUrlWorker_(null), /https:\/\//);
  assert.throws(() => ctx.guardarUrlWorker_(42), /https:\/\//);
  assert.equal("d1:catalogoUrl" in props, false);
  ctx.guardarUrlWorker_("  https://w.example/catalogo \n");
  assert.equal(props["d1:catalogoUrl"], "https://w.example/catalogo");
});

const snap = (ctx, data, v) => post(ctx, { action: "guardarSnapshot", token: "bueno", data, v });

test("guardarSnapshot: v ausente, no numérica o negativa -> falta v, sin grabar", () => {
  const { ctx, esp } = cargar({ migrado: true });
  for (const v of [undefined, "abc", -1, "-1", 1.5, null, "", "5x"]) {
    assert.deepEqual(snap(ctx, { produtos: [] }, v), { ok: false, error: "falta v" }, String(v));
  }
  assert.equal(esp.setValues.length, 0);
});

test("guardarSnapshot: v texto de dígitos se acepta y queda en d1:snapshotV", () => {
  const { ctx, props } = cargar({ migrado: true });
  assert.deepEqual(snap(ctx, { produtos: [] }, "0"), { ok: true, guardado: true });
  assert.equal(props["d1:snapshotV"], "0");
});

test("guardarSnapshot: v 5 graba y guarda d1:snapshotV; 5 y 4 son vieja; 6 graba", () => {
  const { ctx, esp, props } = cargar({ migrado: true });
  assert.deepEqual(snap(ctx, { produtos: [] }, 5), { ok: true, guardado: true });
  assert.equal(props["d1:snapshotV"], "5");
  assert.equal(esp.setValues.length, 1);
  for (const v of [5, 4]) {
    assert.deepEqual(snap(ctx, { produtos: [] }, v), { ok: true, guardado: false, motivo: "vieja" });
  }
  assert.equal(esp.setValues.length, 1);
  assert.equal(props["d1:snapshotV"], "5");
  assert.deepEqual(snap(ctx, { produtos: [] }, 6), { ok: true, guardado: true });
  assert.equal(esp.setValues.length, 2);
  assert.equal(props["d1:snapshotV"], "6");
});

test("guardarSnapshot: vieja no toca medida:estado", () => {
  const { ctx, props } = cargar({ migrado: true });
  snap(ctx, { produtos: [] }, 5);
  const antes = props["medida:estado"];
  snap(ctx, { produtos: [{ nome: "a".repeat(500) }] }, 4);
  assert.equal(props["medida:estado"], antes);
});

test("guardarSnapshot: llegada fuera de orden (7 después de 8) deja el 8 en la celda", () => {
  const { ctx, esp } = cargar({ migrado: true });
  snap(ctx, { produtos: [{ nome: "ocho" }] }, 8);
  assert.equal(snap(ctx, { produtos: [{ nome: "siete" }] }, 7).motivo, "vieja");
  assert.equal(esp.setValues.length, 1);
  assert.equal(JSON.parse(esp.setValues[0][0][1]).produtos[0].nome, "ocho");
});

test("guardarSnapshot: excede no graba, no mueve d1:snapshotV y actualiza medida:estado", () => {
  const { ctx, esp, props } = cargar({ migrado: true });
  snap(ctx, { produtos: [] }, 3);
  const data = { produtos: [{ nome: "x".repeat(50000) }] };
  const r = snap(ctx, data, 4);
  assert.deepEqual(r, { ok: true, guardado: false, motivo: "excede" });
  assert.equal(esp.setValues.length, 1);
  assert.equal(props["d1:snapshotV"], "3");
  const med = JSON.parse(props["medida:estado"]);
  const chars = JSON.stringify(data).length;
  assert.equal(med.chars, chars);
  assert.equal(med.pct, Math.round(chars / 50000 * 1000) / 10);
  assert.ok(med.pct > 100);
  assert.equal(esp.orden.filter((x) => x === "invalidar").length, 1);
});

test("guardarSnapshot válido: actualiza medida:estado con chars, pct y cuando; orden setValues, invalidar, unlock", () => {
  const { ctx, esp, props } = cargar({ migrado: true });
  snap(ctx, { produtos: [{ nome: "a" }] }, 1);
  const txt = esp.setValues[0][0][1];
  const med = JSON.parse(props["medida:estado"]);
  assert.equal(med.chars, txt.length);
  assert.equal(med.pct, Math.round(txt.length / 50000 * 1000) / 10);
  assert.ok(!isNaN(Date.parse(med.cuando)));
  assert.deepEqual(esp.orden, ["setValues", "invalidar", "unlock"]);
});

test("guardarSnapshot: vieja y excede liberan el lock", () => {
  const { ctx, esp } = cargar({ migrado: true });
  snap(ctx, { produtos: [] }, 2);
  esp.orden.length = 0;
  snap(ctx, { produtos: [] }, 1);
  snap(ctx, { produtos: [{ nome: "x".repeat(50000) }] }, 9);
  assert.deepEqual(esp.orden, ["unlock", "unlock"]);
});

test("guardarSnapshot con la chave desligada sigue respondiendo no migrado aunque falte v", () => {
  const { ctx, esp } = cargar();
  assert.deepEqual(snap(ctx, { produtos: [] }, undefined), { ok: false, error: "no migrado" });
  assert.deepEqual(snap(ctx, { produtos: [] }, 3), { ok: false, error: "no migrado" });
  assert.equal(esp.setValues.length, 0);
});

test("exportarEstado: devuelve { ok, data, v } con la chave desligada y ligada, sin grabar", () => {
  for (const migrado of [false, true]) {
    const { ctx, esp } = cargar({ migrado });
    const r = post(ctx, { action: "exportarEstado", token: "bueno" });
    assert.deepEqual(r, { ok: true, data: {}, v: "" }, String(migrado));
    assert.equal(esp.setValues.length, 0);
    assert.equal(esp.orden.includes("invalidar"), false);
  }
});

test("exportarEstado: sin sesión -> clave", () => {
  const { ctx, esp } = cargar({ migrado: true });
  assert.equal(post(ctx, { action: "exportarEstado", token: "malo" }).error, "clave");
  assert.equal(esp.hojaLeida, 0);
});

test("exportarEstado: no lee la chave, así que un fallo de lectura no la impide", () => {
  const { ctx } = cargar({ migradoFalla: true });
  const r = post(ctx, { action: "exportarEstado", token: "bueno" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, {});
});
