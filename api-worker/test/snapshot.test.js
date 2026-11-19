import { test } from "node:test";
import assert from "node:assert/strict";
import { crearD1 } from "./d1-falso.js";
import { manejarPost } from "../src/rutas.js";
import { leerUltimoSnapshot } from "../src/snapshot.js";
import worker from "../src/index.js";

const AHORA = Date.UTC(2026, 0, 2, 3, 4, 5);
const resp = (obj) => async () => new Response(JSON.stringify(obj));

function armar({ fetchFn, env = {}, db = crearD1() } = {}) {
  const esperas = [];
  const llamadas = [];
  const ctx = {
    env: { APPS_SCRIPT_URL: "https://apps.test/exec", SNAPSHOT: "on", ...env },
    db,
    ahora: () => AHORA,
    fetchFn: async (url, init) => {
      llamadas.push({ url, init });
      return (fetchFn || resp({ ok: true, guardado: true }))(url, init);
    },
    verificar: async () => ({ ok: true }),
    esperar: (p) => esperas.push(p),
  };
  return { ctx, db, esperas, llamadas };
}

const post = (ctx, body) => manejarPost({ token: "tok-1", ...body }, ctx);
const filaEstado = (db) => db.prepare("SELECT json, v FROM estado WHERE clave = 'estado'").first();
const filasMeta = async (db) => (await db.prepare("SELECT * FROM meta").all()).results;

const SEMILLA = { produtos: [{ id: "p1", nome: "Maceta", tags: "" }], filamentos: [{ id: "f1", num: 1 }] };

const RUTAS = [
  ["save", () => ({ action: "save", v: "1", data: { ...SEMILLA, produtos: [{ id: "p1", nome: "Maceta", tags: "x" }] } })],
  ["editarPieza", () => ({ action: "editarPieza", pieza: "Maceta", campos: { tags: "nuevo" } })],
  ["agregarPieza", () => ({ action: "agregarPieza", pieza: { nome: "Taza" } })],
  ["agregarFilamento", () => ({ action: "agregarFilamento", filamento: { nome: "PLA" } })],
];

for (const [accion, cuerpo] of RUTAS) {
  test(`snapshot on tras ${accion}: guardarSnapshot con token, data y v grabado, sin headers, con signal`, async () => {
    const { ctx, db, esperas, llamadas } = armar();
    await post(ctx, { action: "save", v: "", data: SEMILLA });
    await Promise.all(esperas.splice(0));
    llamadas.length = 0;
    const r = await post(ctx, cuerpo());
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(esperas.length, 1);
    await Promise.all(esperas);
    assert.equal(llamadas.length, 1);
    const { url, init } = llamadas[0];
    assert.equal(url, "https://apps.test/exec");
    assert.equal(init.method, "POST");
    assert.equal("headers" in init, false);
    assert.ok(init.signal instanceof AbortSignal);
    const c = JSON.parse(init.body);
    assert.equal(c.action, "guardarSnapshot");
    assert.equal(c.token, "tok-1");
    assert.equal(c.v, (await filaEstado(db)).v);
    assert.deepEqual(c.data, JSON.parse((await filaEstado(db)).json));
  });

  test(`snapshot off tras ${accion}: nunca se llama`, async () => {
    const { ctx, esperas, llamadas } = armar({ env: { SNAPSHOT: "off" } });
    await post(ctx, { action: "save", v: "", data: SEMILLA });
    const r = await post(ctx, cuerpo());
    assert.equal(r.ok, true);
    assert.equal(esperas.length, 0);
    assert.equal(llamadas.length, 0);
    assert.deepEqual(await filasMeta(ctx.db), []);
  });

  test(`MODO solo-lectura: ${accion} responde revertido y no toca estado ni meta`, async () => {
    const { ctx, db, esperas, llamadas } = armar();
    await post(ctx, { action: "save", v: "", data: SEMILLA });
    await Promise.all(esperas.splice(0));
    llamadas.length = 0;
    const antes = [await filaEstado(db), await filasMeta(db)];
    ctx.env.MODO = "solo-lectura";
    const r = await post(ctx, cuerpo());
    assert.deepEqual(r, { ok: false, error: "revertido" });
    assert.deepEqual([await filaEstado(db), await filasMeta(db)], antes);
    assert.equal(esperas.length, 0);
    assert.equal(llamadas.length, 0);
  });
}

test("MODO solo-lectura: load y resumenNegocio funcionan; ausente o escritura no bloquea", async () => {
  const { ctx } = armar({ env: { SNAPSHOT: "off" } });
  await post(ctx, { action: "save", v: "", data: SEMILLA });
  ctx.env.MODO = "solo-lectura";
  assert.equal((await post(ctx, { action: "load" })).ok, true);
  assert.equal((await post(ctx, { action: "resumenNegocio" })).ok, true);
  for (const modo of [undefined, "escritura"]) {
    ctx.env.MODO = modo;
    const r = await post(ctx, { action: "agregarFilamento", filamento: { nome: "PETG" } });
    assert.equal(r.ok, true, String(modo));
  }
});

test("MODO solo-lectura: con sesión inválida sigue respondiendo el error de sesión", async () => {
  const { ctx } = armar({ env: { MODO: "solo-lectura" } });
  ctx.verificar = async () => ({ ok: false, error: "clave" });
  assert.deepEqual(await post(ctx, { action: "save", data: {} }), { ok: false, error: "clave" });
});

const CASOS = [
  ["guardado", resp({ ok: true, guardado: true }), { ok: true, motivo: null }],
  ["excede", resp({ ok: true, guardado: false, motivo: "excede" }), { ok: false, motivo: "excede" }],
  ["vieja", resp({ ok: true, guardado: false, motivo: "vieja" }), { ok: false, motivo: "vieja" }],
  ["error del servidor", resp({ ok: false, error: "no migrado" }), { ok: false, motivo: "error: no migrado" }],
  ["red (rechaza)", async () => { throw new Error("caído"); }, { ok: false, motivo: "red" }],
  ["red (lanza)", () => { throw new Error("caído"); }, { ok: false, motivo: "red" }],
  ["no es JSON", async () => new Response("<html>"), { ok: false, motivo: "red" }],
];

for (const [nombre, fetchFn, esperado] of CASOS) {
  test(`registro en meta: ${nombre}`, async () => {
    const { ctx, db, esperas } = armar({ fetchFn });
    const r = await post(ctx, { action: "save", v: "", data: SEMILLA });
    assert.equal(r.ok, true);
    await Promise.all(esperas);
    const filas = await filasMeta(db);
    assert.equal(filas.length, 1);
    assert.equal(filas[0].clave, "snapshot:ultimo");
    assert.deepEqual(await leerUltimoSnapshot(db), {
      v: 1,
      ...esperado,
      cuando: "2026-01-02T03:04:05.000Z",
    });
  });
}

test("el registro reemplaza al anterior: una sola fila snapshot:ultimo", async () => {
  const { ctx, db, esperas } = armar();
  await post(ctx, { action: "save", v: "", data: SEMILLA });
  await post(ctx, { action: "agregarFilamento", filamento: { nome: "PLA" } });
  await Promise.all(esperas);
  assert.equal((await filasMeta(db)).length, 1);
  assert.equal((await leerUltimoSnapshot(db)).v, 2);
});

test("falla al escribir meta: no lanza y la respuesta no cambia", async () => {
  const { ctx, db, esperas } = armar({ db: crearD1({ soloEstado: true }) });
  const r = await post(ctx, { action: "save", v: "", data: SEMILLA });
  assert.equal(r.ok, true);
  assert.equal(r.v, "1");
  await Promise.all(esperas); // no debe rechazar
  assert.equal(await leerUltimoSnapshot(db), null);
});

test("leerUltimoSnapshot: null sin registro, con JSON roto o sin tabla", async () => {
  const db = crearD1();
  assert.equal(await leerUltimoSnapshot(db), null);
  await db.prepare("INSERT INTO meta (clave, valor, actualizado) VALUES ('snapshot:ultimo', '{roto', 'x')").run();
  assert.equal(await leerUltimoSnapshot(db), null);
  assert.equal(await leerUltimoSnapshot(crearD1({ soloEstado: true })), null);
});

test("GET /salud: modo y snapshot; null sin registro, objeto tras un snapshot", async () => {
  const { ctx, db, esperas } = armar();
  const salud = async (env) => {
    const r = await worker.fetch(new Request("https://api.test/salud"), { ...ctx.env, ...env, DB: db });
    assert.equal(r.status, 200);
    return r.json();
  };
  assert.deepEqual(await salud({}), { ok: true, modo: "escritura", snapshot: null });
  await post(ctx, { action: "save", v: "", data: SEMILLA });
  await Promise.all(esperas);
  assert.deepEqual(await salud({ MODO: "solo-lectura" }), {
    ok: true,
    modo: "solo-lectura",
    snapshot: { v: 1, ok: true, motivo: null, cuando: "2026-01-02T03:04:05.000Z" },
  });
  assert.equal((await salud({ MODO: "otra-cosa" })).modo, "escritura");
});

test("GET /salud con banco sin tabla meta o sin DB: 200 y snapshot null", async () => {
  for (const DB of [crearD1({ soloEstado: true }), undefined, { prepare: () => { throw new Error("boom"); } }]) {
    const r = await worker.fetch(new Request("https://api.test/salud"), { DB });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, modo: "escritura", snapshot: null });
  }
});
