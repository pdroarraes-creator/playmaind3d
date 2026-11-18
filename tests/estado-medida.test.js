// Prueba medirEstado_ y el registro de la medida en guardarEstado_ (server/Codigo.gs).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");

// Arma un contexto con LockService, SpreadsheetApp y props_ simulados.
// Devuelve {ctx, escrito, props}: `escrito` junta lo que guardarEstado_ puso
// en la hoja y `props` lo que se pidió guardar en Script Properties.
function cargarGuardado() {
  const escrito = [];
  const props = {};
  const ctx = {
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => ({
          getLastRow: () => 2,
          getRange: () => ({
            getValues: () => [[ctx.CLAVE, "{}", ""]],
            setValues: (v) => escrito.push(v),
          }),
        }),
      }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../server/Codigo.gs", "utf8"), ctx);
  ctx.moverFotosADrive_ = (d) => d;
  ctx.volcarVentas_ = () => {};
  ctx.volcarPiezas_ = () => {};
  ctx.volcarStock_ = () => {};
  ctx.props_ = () => ({ setProperty: (k, v) => { props[k] = v; } });
  return { ctx, escrito, props };
}

test("medirEstado_ calcula caracteres y porcentaje", () => {
  const { ctx } = cargarGuardado();
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.medirEstado_("x".repeat(35000)))), { chars: 35000, pct: 70 });
  assert.equal(ctx.medirEstado_("x").pct, 0);
});

test("guardarEstado_ no falla si no puede guardar la medida", () => {
  const { ctx } = cargarGuardado();
  ctx.props_ = () => { throw new Error("sin props"); };
  const r = ctx.guardarEstado_({ produtos: [] }, "");
  assert.ok(r && r.data);
});

test("guardarEstado_ registra la medida", () => {
  const { ctx, escrito, props } = cargarGuardado();
  ctx.guardarEstado_({ produtos: [{ nome: "a" }] }, "");
  const txt = escrito[0][0][1];
  const m = JSON.parse(props["medida:estado"]);
  assert.equal(m.chars, txt.length);
  assert.equal(m.pct, Math.round(txt.length / 50000 * 1000) / 10);
  assert.ok(m.cuando);
});
