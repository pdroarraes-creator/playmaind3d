import { test } from "node:test";
import assert from "node:assert/strict";
import { crearD1 } from "./d1-falso.js";
import { leerEstado, guardarEstado } from "../src/estado.js";

test("banco vacío: lee null y el primer guardado queda en v 1", async () => {
  const db = crearD1();
  assert.deepEqual(await leerEstado(db), { data: null, v: 0 });
  assert.deepEqual(await guardarEstado(db, { a: 1 }, 0), { ok: true, v: 1 });
  assert.deepEqual(await leerEstado(db), { data: { a: 1 }, v: 1 });
});

test("versión correcta avanza", async () => {
  const db = crearD1();
  await guardarEstado(db, { a: 1 }, 0);
  assert.deepEqual(await guardarEstado(db, { a: 2 }, 1), { ok: true, v: 2 });
  assert.deepEqual(await leerEstado(db), { data: { a: 2 }, v: 2 });
});

test("versión vieja es conflicto y no graba nada", async () => {
  const db = crearD1();
  await guardarEstado(db, { a: 1 }, 0);
  await guardarEstado(db, { a: 2 }, 1);
  const r = await guardarEstado(db, { a: 3 }, 1);
  assert.deepEqual(r, { ok: false, conflicto: true, actual: { data: { a: 2 }, v: 2 } });
  assert.deepEqual(await leerEstado(db), { data: { a: 2 }, v: 2 });
});

test("base 0 con el estado ya creado es conflicto", async () => {
  const db = crearD1();
  await guardarEstado(db, { a: 1 }, 0);
  const r = await guardarEstado(db, { a: 9 }, 0);
  assert.equal(r.conflicto, true);
  assert.deepEqual(await leerEstado(db), { data: { a: 1 }, v: 1 });
});

test("dos guardados con la misma base: uno gana y otro es conflicto", async () => {
  const db = crearD1();
  await guardarEstado(db, { a: 1 }, 0);
  await guardarEstado(db, { a: 2 }, 1);
  const rs = await Promise.all([guardarEstado(db, { x: 1 }, 2), guardarEstado(db, { y: 1 }, 2)]);
  assert.equal(rs.filter((r) => r.ok === true).length, 1);
  assert.equal(rs.filter((r) => r.conflicto === true).length, 1);
  assert.equal((await leerEstado(db)).v, 3);
});

test("estado grande (>120000 caracteres) se guarda y vuelve igual", async () => {
  const db = crearD1();
  const grande = { ventas: Array.from({ length: 2000 }, (_, i) => ({ id: i, nota: "x".repeat(60) })) };
  assert.ok(JSON.stringify(grande).length > 120000);
  await guardarEstado(db, grande, 0);
  assert.deepEqual((await leerEstado(db)).data, grande);
});

test("no archiva token/key, _v ni _sucio y no muta el original", async () => {
  const db = crearD1();
  const data = { cfg: { token: "t", key: "k", moneda: "ARS" }, _v: 5, _sucio: true, a: 1 };
  await guardarEstado(db, data, 0);
  assert.deepEqual((await leerEstado(db)).data, { cfg: { token: "", key: "", moneda: "ARS" }, a: 1 });
  assert.equal(data.cfg.token, "t");
  assert.equal(data._v, 5);
});

test("crearD1 devuelve un banco nuevo y aislado", async () => {
  const a = crearD1();
  const b = crearD1();
  await guardarEstado(a, { a: 1 }, 0);
  assert.deepEqual(await leerEstado(b), { data: null, v: 0 });
});
