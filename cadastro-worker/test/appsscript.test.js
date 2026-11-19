// Pruebas del cliente del Apps Script / Worker del cadastro, con fetch falso.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resumenYSesion, agregarPieza, agregarFilamento } from "../src/appsscript.js";

const APPS = "https://apps.example/exec";
const WORKER = "https://worker.example/";
const fetchOriginal = globalThis.fetch;
let llamadas;
let respuestas; // por URL: función (cuerpo) => objeto, o Error

beforeEach(() => {
  llamadas = [];
  respuestas = {};
  globalThis.fetch = async (url, init) => {
    const cuerpo = JSON.parse(init.body);
    llamadas.push({ url, cuerpo, raw: init.body });
    const r = respuestas[url];
    if (r instanceof Error) throw r;
    return { json: async () => (typeof r === "function" ? r(cuerpo) : r) };
  };
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const env = (extra = {}) => ({ APPS_SCRIPT_URL: APPS, API_WORKER_URL: WORKER, ...extra });

test("sin MODO_SERVIDOR la llamada va al Apps Script", async () => {
  respuestas[APPS] = { ok: true, id: 1 };
  const r = await agregarPieza(env(), "tok", { nome: "x" });
  assert.deepEqual(r, { ok: true, id: 1 });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, APPS);
});

test("migrado en el Apps Script: repite en el Worker con el mismo cuerpo", async () => {
  respuestas[APPS] = { ok: false, error: "migrado" };
  respuestas[WORKER] = { ok: true, desde: "worker" };
  const r = await agregarPieza(env(), "tok", { nome: "x" });
  assert.deepEqual(r, { ok: true, desde: "worker" });
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[1].url, WORKER);
  assert.equal(llamadas[0].raw, llamadas[1].raw);
});

test("MODO_SERVIDOR=worker: la primera llamada ya va al Worker", async () => {
  respuestas[WORKER] = { ok: true };
  await agregarFilamento(env({ MODO_SERVIDOR: "worker" }), "tok", { nome: "f" });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, WORKER);
});

test("agregarFilamento también pasa del Apps Script al Worker", async () => {
  respuestas[APPS] = { ok: false, error: "migrado" };
  respuestas[WORKER] = { ok: true };
  const r = await agregarFilamento(env(), "tok", { nome: "f" });
  assert.equal(r.ok, true);
  assert.deepEqual(llamadas.map((l) => l.url), [APPS, WORKER]);
});

test("resumenYSesion: clave es sesión inválida", async () => {
  respuestas[APPS] = { ok: false, error: "clave" };
  assert.deepEqual(await resumenYSesion(env(), "tok"), { sesionOk: false, resumen: null });
});

test("resumenYSesion: auth_no_disponible es sesión válida sin resumen", async () => {
  respuestas[APPS] = { ok: false, error: "auth_no_disponible" };
  assert.deepEqual(await resumenYSesion(env(), "tok"), { sesionOk: true, resumen: null });
});

test("resumenYSesion: migrado y luego ok del Worker devuelve su resumen", async () => {
  respuestas[APPS] = { ok: false, error: "migrado" };
  respuestas[WORKER] = { ok: true, resumen: { piezas: 3 } };
  assert.deepEqual(await resumenYSesion(env(), "tok"), { sesionOk: true, resumen: { piezas: 3 } });
});

test("resumenYSesion: otro error (sin datos) no expulsa", async () => {
  respuestas[APPS] = { ok: false, error: "sin datos" };
  assert.deepEqual(await resumenYSesion(env(), "tok"), { sesionOk: true, resumen: null });
});

test("un fetch que rechaza propaga la excepción", async () => {
  respuestas[APPS] = new Error("red caída");
  await assert.rejects(() => resumenYSesion(env(), "tok"), /red caída/);
});
