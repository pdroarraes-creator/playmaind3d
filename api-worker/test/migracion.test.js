import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
  db.exec(sqlCarga(original, "2026-01-01T00:00:00.000Z", 1900000000));
  assert.equal(JSON.stringify(original), antes, "no muta la entrada");
  const { data, v } = await leerEstado(db);
  assert.equal(v, 1900000000);
  assert.equal(canonico(data), canonico(original));
  assert.equal(data.produtos[0].nome, "Pata d'oro");
  assert.equal(data.produtos[1].nome, "Llavero 🎨");
});

test("sqlCarga no usa OR REPLACE ni ON CONFLICT", () => {
  const sql = sqlCarga(ejemplo(), "2026-01-01T00:00:00.000Z", 5);
  assert.ok(!/OR REPLACE|ON CONFLICT/i.test(sql));
  assert.ok(sql.startsWith("INSERT INTO estado (clave, json, v, actualizado) VALUES ('estado', '"));
});

test("cargar dos veces: la segunda falla y la fila original queda intacta", async () => {
  const db = crearD1();
  db.exec(sqlCarga(ejemplo(), "2026-01-01T00:00:00.000Z", 1900000000));
  const otro = ejemplo();
  otro.vendas.push({ id: "v2", total: 1 });
  assert.throws(() => db.exec(sqlCarga(otro, "2026-02-02T00:00:00.000Z", 1900000001)), /constraint|UNIQUE|PRIMARY/i);
  const { data, v } = await leerEstado(db);
  assert.equal(v, 1900000000);
  assert.equal(data.vendas.length, 1);
});

test("sin vInicial la v es un entero de 10 dígitos", async () => {
  const db = crearD1();
  db.exec(sqlCarga(ejemplo(), "2026-01-01T00:00:00.000Z"));
  const { v } = await leerEstado(db);
  assert.ok(Number.isInteger(v));
  assert.equal(String(v).length, 10);
});

test("vInicial inválida lanza TypeError", () => {
  for (const malo of [0, -1, 1.5, "7", NaN, Infinity, null]) {
    assert.throws(() => sqlCarga(ejemplo(), "2026-01-01T00:00:00.000Z", malo), TypeError, String(malo));
  }
});

// CLI: archivos temporales inventados, fuera del repositorio
const SCRIPT = fileURLToPath(new URL("../../scripts/migracion-d1.js", import.meta.url));
const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

test("CLI: códigos de salida y --v-inicial", () => {
  const dir = mkdtempSync(join(tmpdir(), "migracion-d1-"));
  try {
    const a = join(dir, "a.json");
    const b = join(dir, "b.json");
    const roto = join(dir, "roto.json");
    const sql = join(dir, "carga.sql");
    writeFileSync(a, JSON.stringify(ejemplo()));
    const distinto = ejemplo();
    distinto.vendas[0].total = 9;
    writeFileSync(b, JSON.stringify(distinto));
    writeFileSync(roto, "{ secreto-inventado no es json");

    const falta = cli("resumen", join(dir, "no-existe.json"));
    assert.equal(falta.status, 3);
    assert.ok(falta.stderr.length > 0 && falta.stderr.length < 300);

    const malo = cli("resumen", roto);
    assert.equal(malo.status, 3);
    assert.ok(!malo.stderr.includes("secreto-inventado"));

    assert.equal(cli("inexistente").status, 2);
    assert.equal(cli("carga", a, sql, "--v-inicial", "abc").status, 2);
    assert.equal(cli("carga", a, sql, "--v-inicial", "0").status, 2);

    assert.equal(cli("carga", a, sql, "--v-inicial", "1900000000").status, 0);
    const texto = readFileSync(sql, "utf8");
    assert.ok(texto.includes("1900000000"));
    assert.ok(!texto.includes("OR REPLACE"));

    assert.equal(cli("comparar", a, b).status, 1);
    assert.equal(cli("comparar", a, a).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
