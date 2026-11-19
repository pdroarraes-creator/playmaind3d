/* Pruebas del protocolo de dos servidores (app/protocolo.js). */
const test = require("node:test");
const assert = require("node:assert");
const P = require("../app/protocolo.js");

test("constantes", () => {
  assert.deepStrictEqual(P.ACCIONES_ESTADO, ["load", "save", "editarPieza", "agregarPieza", "agregarFilamento", "resumenNegocio"]);
  assert.strictEqual(P.CLAVE_MODO, "pm3d:servidor-estado");
});

test("servidorPara", () => {
  for (const a of P.ACCIONES_ESTADO) {
    assert.strictEqual(P.servidorPara(a, "worker"), "worker");
    assert.strictEqual(P.servidorPara(a, "apps"), "apps");
  }
  for (const a of ["login", "logout", "foto", "mundo", "x"]) {
    assert.strictEqual(P.servidorPara(a, "worker"), "apps");
    assert.strictEqual(P.servidorPara(a, "apps"), "apps");
  }
  assert.strictEqual(P.servidorPara("load", "basura"), "apps");
});

test("reaccion", () => {
  const r = (s, resp) => P.reaccion(s, resp);
  assert.deepStrictEqual(r("apps", { ok: true }), { tipo: "ok" });
  assert.deepStrictEqual(r("apps", { error: "migrado" }), { tipo: "cambiarModo", modo: "worker" });
  assert.deepStrictEqual(r("worker", { error: "revertido" }), { tipo: "cambiarModo", modo: "apps" });
  assert.strictEqual(r("worker", { error: "migrado" }).tipo, "error");
  assert.strictEqual(r("apps", { error: "revertido" }).tipo, "error");
  assert.strictEqual(r("apps", { error: "clave" }).tipo, "clave");
  assert.strictEqual(r("worker", { error: "auth_no_disponible" }).tipo, "sinAcceso");
  assert.strictEqual(r("apps", { error: "conflicto" }).tipo, "conflicto");
  assert.strictEqual(r("apps", { error: "fotos: algo" }).tipo, "fotos");
  assert.strictEqual(r("apps", { error: "otra" }).tipo, "error");
  assert.strictEqual(r("apps", {}).tipo, "error");
  assert.strictEqual(r("apps", null).tipo, "error");
  assert.strictEqual(r("apps", "texto").tipo, "error");
});

test("leerModo / guardarModo", () => {
  const mem = {};
  const alm = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  assert.strictEqual(P.leerModo(alm), "apps");
  P.guardarModo(alm, "worker");
  assert.strictEqual(mem[P.CLAVE_MODO], "worker");
  assert.strictEqual(P.leerModo(alm), "worker");
  mem[P.CLAVE_MODO] = "basura";
  assert.strictEqual(P.leerModo(alm), "apps");
  assert.strictEqual(P.leerModo({ getItem() { throw new Error("x"); } }), "apps");
  assert.doesNotThrow(() => P.guardarModo({ setItem() { throw new Error("x"); } }, "worker"));
});

function armar(respuestas, modo, accion) {
  const llamadas = [];
  const cambios = [];
  const enviar = async (servidor, cuerpo) => { llamadas.push([servidor, cuerpo]); return respuestas.shift(); };
  const cuerpo = { action: accion || "save", n: 1 };
  const p = P.pedirEstado({ cuerpo, modo, enviar, alCambiarModo: (m) => cambios.push(m) });
  return { p, llamadas, cambios, cuerpo };
}

test("pedirEstado sin cambio", async () => {
  const { p, llamadas, cambios } = armar([{ ok: true }], "apps");
  const r = await p;
  assert.strictEqual(llamadas.length, 1);
  assert.deepStrictEqual(cambios, []);
  assert.strictEqual(r.reaccion.tipo, "ok");
  assert.strictEqual(r.servidor, "apps");
  assert.strictEqual(r.modo, "apps");
});

test("pedirEstado migrado en apps", async () => {
  const { p, llamadas, cambios, cuerpo } = armar([{ error: "migrado" }, { ok: true }], "apps");
  const r = await p;
  assert.strictEqual(llamadas.length, 2);
  assert.strictEqual(llamadas[1][0], "worker");
  assert.strictEqual(llamadas[1][1], cuerpo);
  assert.deepStrictEqual(cambios, ["worker"]);
  assert.strictEqual(r.reaccion.tipo, "ok");
  assert.strictEqual(r.servidor, "worker");
  assert.strictEqual(r.modo, "worker");
});

test("pedirEstado revertido en worker", async () => {
  const { p, llamadas, cambios } = armar([{ error: "revertido" }, { ok: true }], "worker");
  const r = await p;
  assert.strictEqual(llamadas.length, 2);
  assert.strictEqual(llamadas[1][0], "apps");
  assert.deepStrictEqual(cambios, ["apps"]);
  assert.strictEqual(r.reaccion.tipo, "ok");
  assert.strictEqual(r.modo, "apps");
});

test("pedirEstado sin laço: migrado y revertido", async () => {
  const { p, llamadas } = armar([{ error: "migrado" }, { error: "revertido" }, { ok: true }], "apps");
  const r = await p;
  assert.strictEqual(llamadas.length, 2);
  assert.deepStrictEqual(r.reaccion, { tipo: "error" });
  assert.strictEqual(r.modo, "worker");
});

test("pedirEstado sin laço: revertido y migrado", async () => {
  const { p, llamadas } = armar([{ error: "revertido" }, { error: "migrado" }, { ok: true }], "worker");
  const r = await p;
  assert.strictEqual(llamadas.length, 2);
  assert.deepStrictEqual(r.reaccion, { tipo: "error" });
  assert.strictEqual(r.modo, "apps");
});

test("pedirEstado auth_no_disponible y clave", async () => {
  let t = armar([{ error: "auth_no_disponible" }], "worker");
  let r = await t.p;
  assert.strictEqual(t.llamadas.length, 1);
  assert.deepStrictEqual(t.cambios, []);
  assert.strictEqual(r.reaccion.tipo, "sinAcceso");
  t = armar([{ error: "clave" }], "apps");
  r = await t.p;
  assert.strictEqual(t.llamadas.length, 1);
  assert.strictEqual(r.reaccion.tipo, "clave");
});

test("pedirEstado propaga excepciones", async () => {
  await assert.rejects(P.pedirEstado({
    cuerpo: { action: "load" }, modo: "apps",
    enviar: async () => { throw new Error("red"); }, alCambiarModo() {},
  }), /red/);
});

test("login en modo worker va a apps", async () => {
  const { p, llamadas } = armar([{ ok: true }], "worker", "login");
  await p;
  assert.strictEqual(llamadas[0][0], "apps");
});
