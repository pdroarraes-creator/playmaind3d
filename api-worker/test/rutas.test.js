import { test } from "node:test";
import assert from "node:assert/strict";
import { crearD1 } from "./d1-falso.js";
import { versionDelCliente, ACCIONES, manejarPost } from "../src/rutas.js";

const OK = async () => ({ ok: true });

function armar(extra = {}) {
  const db = crearD1();
  const esperas = [];
  const llamadas = [];
  const ctx = {
    env: { APPS_SCRIPT_URL: "https://apps.test/exec", SNAPSHOT: "off" },
    db,
    ahora: () => Date.UTC(2026, 0, 2, 3, 4, 5),
    fetchFn: async (url, init) => {
      llamadas.push({ url, init });
      return new Response("{}");
    },
    verificar: OK,
    esperar: (p) => esperas.push(p),
    ...extra,
  };
  return { ctx, db, esperas, llamadas };
}

const post = (ctx, body) => manejarPost({ token: "tok-1", ...body }, ctx);

test("versionDelCliente: sólo enteros seguros >= 0, el resto es 0", () => {
  assert.equal(versionDelCliente(3), 3);
  assert.equal(versionDelCliente("7"), 7);
  assert.equal(versionDelCliente("1795055024564"), 1795055024564);
  for (const malo of [undefined, null, "", "lixo", -1, 1.5, NaN, 2 ** 60, "9".repeat(30), {}, [], "-1", "1.5"]) {
    assert.equal(versionDelCliente(malo), 0, String(malo));
  }
});

test("load con banco vacío devuelve data null y v texto vacío", async () => {
  const { ctx } = armar();
  assert.deepEqual(await post(ctx, { action: "load" }), { ok: true, data: null, v: "" });
});

test("save primera vez con v vacío y luego load devuelve v como texto", async () => {
  const { ctx } = armar();
  const r = await post(ctx, { action: "save", v: "", data: { produtos: [{ id: "a" }] } });
  assert.equal(r.ok, true);
  assert.equal(r.v, "1");
  assert.equal(r.fusionado, false);
  assert.equal(r.actualizado, "2026-01-02T03:04:05.000Z");
  const l = await post(ctx, { action: "load" });
  assert.equal(l.v, "1");
  assert.deepEqual(l.data.produtos, [{ id: "a" }]);
});

test("save con v igual al leído no fusiona", async () => {
  const { ctx } = armar();
  await post(ctx, { action: "save", v: "", data: { produtos: [{ id: "a" }] } });
  const l = await post(ctx, { action: "load" });
  const r = await post(ctx, { action: "save", v: l.v, data: { produtos: [{ id: "a" }, { id: "b" }] } });
  assert.equal(r.ok, true);
  assert.equal(r.fusionado, false);
  assert.equal(r.v, "2");
});

for (const [nombre, v] of [["sello del Sheets", "1795055024564"], ["undefined", undefined], ["basura", "lixo"], ["negativo", -1]]) {
  test(`save con v ${nombre} nunca lanza y preserva lo que sólo tenía el servidor`, async () => {
    const { ctx } = armar();
    await post(ctx, { action: "save", v: "", data: { produtos: [{ id: "servidor" }] } });
    const r = await post(ctx, { action: "save", v, data: { produtos: [{ id: "cliente" }] } });
    assert.equal(r.ok, true);
    assert.equal(r.fusionado, true);
    const ids = r.data.produtos.map((p) => p.id).sort();
    assert.deepEqual(ids, ["cliente", "servidor"]);
  });
}

test("token ausente: clave y el banco no se consulta", async () => {
  const { ctx, db } = armar({
    verificar: async (t) => (t ? { ok: true } : { ok: false, error: "clave" }),
  });
  let consultas = 0;
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => { consultas++; return prepare(sql); };
  const r = await manejarPost({ action: "load" }, ctx);
  assert.deepEqual(r, { ok: false, error: "clave" });
  assert.equal(consultas, 0);
});

test("auth_no_disponible pasa directo sin volverse clave ni tocar el banco", async () => {
  const { ctx, db } = armar({ verificar: async () => ({ ok: false, error: "auth_no_disponible" }) });
  let consultas = 0;
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => { consultas++; return prepare(sql); };
  const r = await post(ctx, { action: "save", data: {} });
  assert.deepEqual(r, { ok: false, error: "auth_no_disponible" });
  assert.equal(consultas, 0);
});

test("acción desconocida, incluso nombres del prototipo", async () => {
  const { ctx } = armar();
  for (const action of [undefined, "nada", "constructor", "__proto__", "toString", 5]) {
    assert.deepEqual(await post(ctx, { action }), { ok: false, error: "accion desconocida" }, String(action));
  }
});

test("save sin data o con data array: datos invalidos", async () => {
  const { ctx } = armar();
  assert.deepEqual(await post(ctx, { action: "save" }), { ok: false, error: "datos invalidos" });
  assert.deepEqual(await post(ctx, { action: "save", data: [] }), { ok: false, error: "datos invalidos" });
  assert.deepEqual(await post(ctx, { action: "save", data: null }), { ok: false, error: "datos invalidos" });
});

test("save con data:image sube las fotos y no guarda base64", async () => {
  const { ctx, db } = armar();
  const subidas = [];
  ctx.fetchFn = async (url, init) => {
    subidas.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true, data: { produtos: [{ id: "a", foto: "https://drive.test/x" }] } }));
  };
  const r = await post(ctx, { action: "save", v: "", data: { produtos: [{ id: "a", foto: "data:image/png;base64,AAAA" }] } });
  assert.equal(r.ok, true);
  assert.equal(subidas.length, 1);
  assert.equal(subidas[0].action, "subirFotos");
  assert.equal(subidas[0].token, "tok-1");
  const fila = await db.prepare("SELECT json FROM estado WHERE clave = 'estado'").first();
  assert.ok(!fila.json.includes("data:image"));
  assert.ok(fila.json.includes("https://drive.test/x"));
});

test("save con falla de subida: error y el banco queda como estaba", async () => {
  const { ctx, db } = armar();
  await post(ctx, { action: "save", v: "", data: { produtos: [{ id: "a" }] } });
  const antes = await db.prepare("SELECT json, v FROM estado").first();
  ctx.fetchFn = async () => { throw new Error("red caída"); };
  const r = await post(ctx, { action: "save", v: "1", data: { produtos: [{ id: "b", foto: "data:image/png;base64,AAAA" }] } });
  assert.equal(r.ok, false);
  assert.match(r.error, /^fotos:/);
  assert.deepEqual(await db.prepare("SELECT json, v FROM estado").first(), antes);
});

test("excepción inesperada del banco: error JSON sin stack", async () => {
  const { ctx, db } = armar();
  db.prepare = () => { throw new TypeError("boom"); };
  const r = await post(ctx, { action: "load" });
  assert.deepEqual(r, { ok: false, error: "boom" });
});

test("snapshot on: fetchFn recibe guardarSnapshot con el token, sin headers", async () => {
  const { ctx, esperas, llamadas } = armar();
  ctx.env.SNAPSHOT = "on";
  await post(ctx, { action: "save", v: "", data: { produtos: [{ id: "a" }] } });
  assert.equal(esperas.length, 1);
  await Promise.all(esperas);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, "https://apps.test/exec");
  assert.equal("headers" in llamadas[0].init, false);
  const cuerpo = JSON.parse(llamadas[0].init.body);
  assert.equal(cuerpo.action, "guardarSnapshot");
  assert.equal(cuerpo.token, "tok-1");
  assert.deepEqual(cuerpo.data.produtos, [{ id: "a" }]);
});

test("snapshot off: fetchFn no se llama", async () => {
  const { ctx, esperas, llamadas } = armar();
  await post(ctx, { action: "save", v: "", data: { produtos: [] } });
  assert.equal(esperas.length, 0);
  assert.equal(llamadas.length, 0);
});

test("snapshot que falla (rechaza o lanza) no cambia la respuesta", async () => {
  for (const fetchFn of [async () => { throw new Error("x"); }, () => { throw new Error("y"); }]) {
    const { ctx, esperas } = armar({ fetchFn });
    ctx.env.SNAPSHOT = "on";
    const r = await post(ctx, { action: "save", v: "", data: { produtos: [] } });
    assert.equal(r.ok, true);
    await Promise.all(esperas);
  }
});

test("ACCIONES expone load y save", () => {
  assert.deepEqual(Object.keys(ACCIONES).sort(), ["load", "save"]);
});
