import { test } from "node:test";
import assert from "node:assert/strict";
import migracion from "../../scripts/migracion-d1.js";
import { crearD1 } from "./d1-falso.js";
import { leerEstado } from "../src/estado.js";

const { canonico, resumen, comparar, sqlCarga } = migracion;

// datos inventados
const ejemplo = () => ({
  cfg: { token: "abc", key: "k1", moneda: "ARS" },
  produtos: [{ id: "p1", nome: "Pata d'oro" }, { id: "p2", nome: "Llavero 🎨" }],
  vendas: [{ id: "v1", total: 1500 }],
  filamentos: [],
  _v: 3,
});

test("resumen cuenta listas", () => {
  const r = resumen(ejemplo());
  assert.equal(r.listas.produtos, 2);
  assert.equal(r.listas.vendas, 1);
  assert.ok(r.chars > 0);
});

test("hash no depende del orden de claves ni de campos de sesión", () => {
  const a = ejemplo();
  const b = {
    _v: 99,
    vendas: [{ total: 1500, id: "v1" }],
    filamentos: [],
    produtos: [{ nome: "Pata d'oro", id: "p1" }, { nome: "Llavero 🎨", id: "p2" }],
    cfg: { moneda: "ARS", key: "otra", token: "xyz" },
  };
  assert.equal(resumen(a).hash, resumen(b).hash);
});

test("hash cambia si cambia un dato", () => {
  const b = ejemplo();
  b.vendas[0].total = 1501;
  assert.notEqual(resumen(ejemplo()).hash, resumen(b).hash);
});

test("comparar devuelve iguales:false y menciona la lista cuando falta un item", () => {
  const b = ejemplo();
  b.produtos.pop();
  const c = comparar(resumen(ejemplo()), resumen(b));
  assert.equal(c.iguales, false);
  assert.ok(c.diferencias.some((d) => d.includes("produtos")));
  assert.equal(comparar(resumen(ejemplo()), resumen(ejemplo())).iguales, true);
});

test("sqlCarga round-trip con comillas, acentos y emoji", async () => {
  const original = ejemplo();
  const antes = JSON.stringify(original);
  const db = crearD1();
  db.exec(sqlCarga(original, "2026-01-01T00:00:00.000Z"));
  assert.equal(JSON.stringify(original), antes, "no muta la entrada");
  const { data, v } = await leerEstado(db);
  assert.equal(v, 1);
  assert.equal(canonico(data), canonico(original));
  assert.equal(data.produtos[0].nome, "Pata d'oro");
  assert.equal(data.produtos[1].nome, "Llavero 🎨");
});
