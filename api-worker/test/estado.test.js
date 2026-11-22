import { test } from "node:test";
import assert from "node:assert/strict";
import { crearD1 } from "./d1-falso.js";
import { leerEstado, leerVersion, guardarEstado, guardarConFusion, sanear } from "../src/estado.js";

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

test("baseV inválido lanza TypeError y no toca la fila guardada", async () => {
  for (const malo of ["1", undefined, null, -1, 1.5, NaN]) {
    const db = crearD1();
    await guardarEstado(db, { a: 1 }, 0);
    await assert.rejects(() => guardarEstado(db, { a: 2 }, malo), TypeError);
    assert.deepEqual(await leerEstado(db), { data: { a: 1 }, v: 1 }, `baseV=${String(malo)}`);
  }
});

test("guardarConFusion sin conflicto: no fusiona y avanza la versión", async () => {
  const db = crearD1();
  await guardarEstado(db, { a: 1 }, 0);
  const r = await guardarConFusion(db, { cfg: { token: "t", key: "k" }, _v: 1, _sucio: true, a: 2 }, 1);
  assert.equal(r.ok, true);
  assert.equal(r.fusionado, false);
  assert.equal(r.v, 2);
  assert.deepEqual(r.data, { cfg: { token: "", key: "" }, a: 2 });
  assert.deepEqual((await leerEstado(db)).data, r.data);
});

test("guardarConFusion con base vieja funde los ítems de otro cliente", async () => {
  const db = crearD1();
  await guardarEstado(db, { produtos: [{ id: "a", n: 1 }] }, 0);
  await guardarEstado(db, { produtos: [{ id: "a", n: 1 }] }, 1);
  await guardarEstado(db, { produtos: [{ id: "a", n: 1 }, { id: "x", n: 9 }] }, 2);
  const r = await guardarConFusion(db, { produtos: [{ id: "a", n: 1 }, { id: "b", n: 2 }] }, 2);
  assert.equal(r.ok, true);
  assert.equal(r.fusionado, true);
  assert.equal(r.v, 4);
  const guardado = await leerEstado(db);
  assert.equal(guardado.v, 4);
  assert.deepEqual(guardado.data.produtos.map((p) => p.id).sort(), ["a", "b", "x"]);
  assert.deepEqual(r.data, guardado.data);
});

test("guardarConFusion: una baja desde copia vieja no se aplica", async () => {
  const db = crearD1();
  await guardarEstado(db, { produtos: [{ id: "a" }, { id: "x" }] }, 0);
  await guardarEstado(db, { produtos: [{ id: "a" }, { id: "x" }] }, 1);
  const r = await guardarConFusion(db, { produtos: [{ id: "a" }] }, 1);
  assert.equal(r.ok, true);
  assert.deepEqual((await leerEstado(db)).data.produtos.map((p) => p.id).sort(), ["a", "x"]);
});

test("guardarConFusion con maxIntentos 1 y base vieja: conflicto y banco intacto", async () => {
  const db = crearD1();
  await guardarEstado(db, { a: 1 }, 0);
  await guardarEstado(db, { a: 2 }, 1);
  const r = await guardarConFusion(db, { a: 3 }, 1, { maxIntentos: 1 });
  assert.deepEqual(r, { ok: false, error: "conflicto" });
  assert.deepEqual(await leerEstado(db), { data: { a: 2 }, v: 2 });
});

test("guardarConFusion con versión desconocida enorme cae en la fusión", async () => {
  const db = crearD1();
  await guardarEstado(db, { produtos: [{ id: "a" }] }, 0);
  const r = await guardarConFusion(db, { produtos: [{ id: "b" }] }, 1795055024564);
  assert.equal(r.ok, true);
  assert.equal(r.fusionado, true);
  assert.equal(r.v, 2);
  assert.deepEqual((await leerEstado(db)).data.produtos.map((p) => p.id).sort(), ["a", "b"]);
});

test("guardarConFusion con banco vacío y base desconocida inserta", async () => {
  const db = crearD1();
  const r = await guardarConFusion(db, { a: 1 }, 5);
  assert.equal(r.ok, true);
  assert.equal(r.v, 1);
  assert.deepEqual((await leerEstado(db)).data, { a: 1 });
});

test("sanear devuelve copia limpia sin mutar el original", () => {
  const d = { cfg: { token: "t", key: "k" }, _v: 1, _sucio: true };
  assert.deepEqual(sanear(d), { cfg: { token: "", key: "" } });
  assert.equal(d.cfg.token, "t");
});

test("leerVersion: 0 sin fila y la versión actual después de grabar", async () => {
  const db = crearD1();
  assert.equal(await leerVersion(db), 0);
  await guardarEstado(db, { a: 1 }, 0);
  assert.equal(await leerVersion(db), 1);
  await guardarEstado(db, { a: 2 }, 1);
  assert.equal(await leerVersion(db), 2);
});
