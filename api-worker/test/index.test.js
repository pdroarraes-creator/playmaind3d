import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { origenPermitido } from "../src/cors.js";
import Calculo from "../src/calculo.js";

test("GET /salud responde ok", async () => {
  const r = await worker.fetch(new Request("https://api.test/salud"), {});
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
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
    new Request("https://api.test/nada", { method: "POST", body: "x", headers: { Origin: "https://www.playmind3d.com" } }),
    {}
  );
  assert.equal(r.status, 404);
  assert.deepEqual(await r.json(), { ok: false, error: "no encontrado" });
  assert.equal(r.headers.get("access-control-allow-origin"), "https://www.playmind3d.com");
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
