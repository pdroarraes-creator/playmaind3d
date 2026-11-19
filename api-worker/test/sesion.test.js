import { test } from "node:test";
import assert from "node:assert/strict";
import { crearVerificador } from "../src/sesion.js";

const env = { APPS_SCRIPT_URL: "https://apps.example/exec" };

function respuesta(cuerpo, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => cuerpo };
}

function fetchContando(cuerpo, status) {
  const f = async (url, opciones) => {
    f.llamadas.push({ url, opciones });
    return respuesta(cuerpo, status);
  };
  f.llamadas = [];
  return f;
}

test("token válido por segunda vez no llama a la red", async () => {
  const fetchFn = fetchContando('{"ok":true}');
  const verificar = crearVerificador({ fetchFn, ahora: () => 1000 });
  assert.deepEqual(await verificar("tok-1", env), { ok: true });
  assert.deepEqual(await verificar("tok-1", env), { ok: true });
  assert.equal(fetchFn.llamadas.length, 1);
});

test("pasado ttlMs vuelve a preguntar", async () => {
  const fetchFn = fetchContando('{"ok":true}');
  let t = 0;
  const verificar = crearVerificador({ fetchFn, ahora: () => t, ttlMs: 500 });
  await verificar("tok-1", env);
  t = 499;
  await verificar("tok-1", env);
  assert.equal(fetchFn.llamadas.length, 1);
  t = 500;
  await verificar("tok-1", env);
  assert.equal(fetchFn.llamadas.length, 2);
});

test("clave inválida: error clave y no queda en caché", async () => {
  const fetchFn = fetchContando('{"ok":false,"error":"clave"}');
  const verificar = crearVerificador({ fetchFn, ahora: () => 0 });
  assert.deepEqual(await verificar("tok-1", env), { ok: false, error: "clave" });
  assert.deepEqual(await verificar("tok-1", env), { ok: false, error: "clave" });
  assert.equal(fetchFn.llamadas.length, 2);
});

test("token que deja de valer se olvida", async () => {
  const respuestas = ['{"ok":true}', '{"ok":false,"error":"clave"}'];
  const fetchFn = async () => respuesta(respuestas.shift());
  let t = 0;
  const verificar = crearVerificador({ fetchFn, ahora: () => t, ttlMs: 10 });
  assert.equal((await verificar("tok-1", env)).ok, true);
  t = 10;
  assert.deepEqual(await verificar("tok-1", env), { ok: false, error: "clave" });
});

test("fetch que lanza es auth_no_disponible, nunca clave", async () => {
  const fetchFn = async () => { throw new Error("red caída"); };
  const verificar = crearVerificador({ fetchFn });
  assert.deepEqual(await verificar("tok-1", env), { ok: false, error: "auth_no_disponible" });
});

test("respuesta que no es JSON es auth_no_disponible", async () => {
  const verificar = crearVerificador({ fetchFn: fetchContando("<html>error</html>") });
  assert.deepEqual(await verificar("tok-1", env), { ok: false, error: "auth_no_disponible" });
});

test("estado HTTP no 2xx es auth_no_disponible", async () => {
  const verificar = crearVerificador({ fetchFn: fetchContando('{"ok":false,"error":"clave"}', 500) });
  assert.deepEqual(await verificar("tok-1", env), { ok: false, error: "auth_no_disponible" });
});

test("JSON que no es objeto es auth_no_disponible", async () => {
  const verificar = crearVerificador({ fetchFn: fetchContando("null") });
  assert.deepEqual(await verificar("tok-1", env), { ok: false, error: "auth_no_disponible" });
});

test("token vacío no llama a la red", async () => {
  const fetchFn = fetchContando('{"ok":true}');
  const verificar = crearVerificador({ fetchFn });
  assert.deepEqual(await verificar("", env), { ok: false, error: "clave" });
  assert.deepEqual(await verificar(undefined, env), { ok: false, error: "clave" });
  assert.equal(fetchFn.llamadas.length, 0);
});

test("el pedido es POST con el cuerpo exacto y sin encabezados", async () => {
  const fetchFn = fetchContando('{"ok":true}');
  await crearVerificador({ fetchFn })("tok-1", env);
  const { url, opciones } = fetchFn.llamadas[0];
  assert.equal(url, env.APPS_SCRIPT_URL);
  assert.equal(opciones.method, "POST");
  assert.equal(opciones.body, JSON.stringify({ action: "validarSesion", token: "tok-1" }));
  assert.equal("headers" in opciones, false);
  assert.ok(opciones.signal);
});

test("cada verificador tiene su propia caché", async () => {
  const fetchFn = fetchContando('{"ok":true}');
  await crearVerificador({ fetchFn })("tok-1", env);
  await crearVerificador({ fetchFn })("tok-1", env);
  assert.equal(fetchFn.llamadas.length, 2);
});

for (const cuerpo of [
  '{"ok":false,"error":"accion desconocida"}',
  '{"ok":false}',
  '{"ok":false,"error":"migrado"}',
  '{"ok":false,"error":"cualquier otra cosa"}',
]) {
  test(`respuesta ${cuerpo} es auth_no_disponible, no clave`, async () => {
    const verificar = crearVerificador({ fetchFn: fetchContando(cuerpo) });
    assert.deepEqual(await verificar("tok-1", env), { ok: false, error: "auth_no_disponible" });
  });
}

test("clave exacta expulsa el token de la caché", async () => {
  const respuestas = ['{"ok":true}', '{"ok":false,"error":"clave"}'];
  const fetchFn = async () => respuesta(respuestas.shift());
  let t = 0;
  const verificar = crearVerificador({ fetchFn, ahora: () => t, ttlMs: 10 });
  await verificar("tok-1", env);
  t = 10;
  assert.deepEqual(await verificar("tok-1", env), { ok: false, error: "clave" });
  assert.equal(respuestas.length, 0);
});
