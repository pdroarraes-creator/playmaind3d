import { test } from "node:test";
import assert from "node:assert/strict";
import { contieneFotosNuevas, subirFotos } from "../src/fotos.js";

const B64 = "data:image/png;base64,AAAA";
const ENV = { APPS_SCRIPT_URL: "https://apps.example/exec" };

function respuesta(cuerpo, { status = 200 } = {}) {
  const texto = typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
  return { ok: status >= 200 && status < 300, status, text: async () => texto };
}

test("detecta base64 en produtos[].foto", () => {
  assert.equal(contieneFotosNuevas({ produtos: [{ foto: B64 }] }), true);
});

test("detecta base64 en produtos[].fotos[]", () => {
  const data = { produtos: [{ fotos: ["https://x/a.jpg", B64] }] };
  assert.equal(contieneFotosNuevas(data), true);
});

test("detecta base64 en cfg.logo", () => {
  assert.equal(contieneFotosNuevas({ produtos: [], cfg: { logo: B64 } }), true);
});

test("detecta base64 en cfg.leti.foto", () => {
  assert.equal(contieneFotosNuevas({ produtos: [], cfg: { leti: { foto: B64 } } }), true);
});

test("no detecta URLs https ni estado sin fotos", () => {
  const data = {
    produtos: [{ foto: "https://lh3.googleusercontent.com/d/abc", fotos: ["https://x/b.jpg"] }],
    cfg: { logo: "/assets/logo-app.png", leti: { foto: "https://x/c.jpg" } },
  };
  assert.equal(contieneFotosNuevas(data), false);
  assert.equal(contieneFotosNuevas({ produtos: [{ nome: "a" }], cfg: {} }), false);
});

test("no mira otros lugares (p. ej. canais)", () => {
  assert.equal(contieneFotosNuevas({ produtos: [], canais: [{ foto: B64 }] }), false);
});

test("tolera partes ausentes o malformadas sin lanzar", () => {
  for (const data of [
    null,
    undefined,
    "x",
    {},
    { produtos: null },
    { produtos: "no" },
    { produtos: [null, 3, { foto: 5, fotos: "no" }, { fotos: [null, 7, {}] }] },
    { produtos: [], cfg: null },
    { produtos: [], cfg: { logo: 5, leti: "no" } },
    { produtos: [], cfg: { leti: null } },
  ]) {
    assert.equal(contieneFotosNuevas(data), false);
  }
});

test("subirFotos envía la acción sin encabezados y devuelve data", async () => {
  const llamadas = [];
  const devuelto = { produtos: [{ foto: "https://lh3.googleusercontent.com/d/abc" }] };
  const fetchFn = async (url, opts) => {
    llamadas.push([url, opts]);
    return respuesta({ ok: true, data: devuelto });
  };
  const r = await subirFotos(ENV, "tok-falso", { produtos: [{ foto: B64 }] }, fetchFn);
  assert.deepEqual(r, devuelto);
  assert.equal(llamadas.length, 1);
  const [url, opts] = llamadas[0];
  assert.equal(url, ENV.APPS_SCRIPT_URL);
  assert.equal(opts.method, "POST");
  assert.equal("headers" in opts, false);
  assert.ok(opts.signal);
  assert.deepEqual(JSON.parse(opts.body), {
    action: "subirFotos",
    token: "tok-falso",
    data: { produtos: [{ foto: B64 }] },
  });
});

async function falla(fetchFn, patron) {
  await assert.rejects(
    () => subirFotos(ENV, "tok-falso", { produtos: [{ foto: B64 }] }, fetchFn),
    (e) => e instanceof Error && e.message.startsWith("fotos:") && (!patron || patron.test(e.message)),
  );
}

test("subirFotos falla con { ok: false, error }", async () => {
  await falla(async () => respuesta({ ok: false, error: "x" }), /x/);
});

test("subirFotos falla con respuesta no JSON", async () => {
  await falla(async () => respuesta("<html>error</html>"));
});

test("subirFotos falla si fetch lanza", async () => {
  await falla(async () => { throw new Error("red caída"); });
});

test("subirFotos falla con estado HTTP no 2xx", async () => {
  await falla(async () => respuesta({ ok: true, data: {} }, { status: 502 }));
});

test("subirFotos falla con { ok: true } sin data", async () => {
  await falla(async () => respuesta({ ok: true }));
  await falla(async () => respuesta({ ok: true, data: "texto" }));
  await falla(async () => respuesta({ ok: true, data: null }));
});

test("subirFotos falla si lo devuelto todavía trae base64", async () => {
  await falla(async () => respuesta({ ok: true, data: { produtos: [{ foto: B64 }] } }));
});
