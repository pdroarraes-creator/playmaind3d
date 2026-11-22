import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { origenPermitido } from "../src/cors.js";
import Calculo from "../src/calculo.js";

test("GET /salud responde ok", async () => {
  const r = await worker.fetch(new Request("https://api.test/salud"), {});
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, modo: "escritura", snapshot: null });
});

test("OPTIONS con origen permitido devuelve 204 y el encabezado CORS", async () => {
  const r = await worker.fetch(
    new Request("https://api.test/", { method: "OPTIONS", headers: { Origin: "https://playmind3d.com" } }),
    {}
  );
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), "https://playmind3d.com");
});

test("OPTIONS con origen no permitido no lleva el encabezado CORS", async () => {
  const r = await worker.fetch(
    new Request("https://api.test/", { method: "OPTIONS", headers: { Origin: "https://malo.example" } }),
    {}
  );
  assert.equal(r.headers.get("access-control-allow-origin"), null);
});

test("ruta desconocida responde 404 JSON", async () => {
  const r = await worker.fetch(
    new Request("https://api.test/nada", { method: "GET", headers: { Origin: "https://www.playmind3d.com" } }),
    {}
  );
  assert.equal(r.status, 404);
  assert.deepEqual(await r.json(), { ok: false, error: "no encontrado" });
  assert.equal(r.headers.get("access-control-allow-origin"), "https://www.playmind3d.com");
});

test("POST con cuerpo que no es JSON responde error JSON sin lanzar", async () => {
  const r = await worker.fetch(
    new Request("https://api.test/", { method: "POST", body: "no soy json", headers: { "Content-Type": "text/plain" } }),
    {},
    { waitUntil() {} }
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: false, error: "cuerpo invalido" });
});

test("POST sin token responde clave", async () => {
  const r = await worker.fetch(
    new Request("https://api.test/", { method: "POST", body: JSON.stringify({ action: "load" }) }),
    {},
    { waitUntil() {} }
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: false, error: "clave" });
});

test("Vary: Origin siempre; Access-Control-* sólo con origen permitido", async () => {
  for (const headers of [{ Origin: "https://malo.example" }, {}]) {
    const r = await worker.fetch(new Request("https://api.test/salud", { headers }), {});
    assert.equal(r.headers.get("vary"), "Origin");
    assert.equal(r.headers.get("access-control-allow-origin"), null);
    assert.equal(r.headers.get("access-control-allow-methods"), null);
  }
  const ok = await worker.fetch(new Request("https://api.test/salud", { headers: { Origin: "https://playmind3d.com" } }), {});
  assert.equal(ok.headers.get("vary"), "Origin");
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://playmind3d.com");
  assert.equal(ok.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
});

test("origenPermitido", () => {
  assert.equal(origenPermitido(null, {}), null);
  assert.equal(origenPermitido("https://malo.example", {}), null);
  assert.equal(
    origenPermitido("http://localhost:8000", { ORIGENES_EXTRA: "http://localhost:8000" }),
    "http://localhost:8000"
  );
});

test("calculo reexportado calcula un precio finito", () => {
  assert.ok(Number.isFinite(Calculo.calcular({ peso: 10, h: 1 }, {}).preco));
});
