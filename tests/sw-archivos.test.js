// Guarda: ARCHIVOS de app/sw.js debe listar exactamente los archivos que existen.
// cache.addAll() falla entero si un solo camino no existe, y el SW no se instala.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const APP = path.join(RAIZ, "app");

function leerArchivos() {
  const src = fs.readFileSync(path.join(APP, "sw.js"), "utf8");
  const m = src.match(/const\s+ARCHIVOS\s*=\s*\[([\s\S]*?)\]\s*;/);
  assert.ok(m, "no se encontró const ARCHIVOS en sw.js");
  const lista = [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2]);
  return lista.filter((p) => p !== "./");
}

function jsEnApp(dir) {
  const salida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) salida.push(...jsEnApp(abs));
    else if (e.name.endsWith(".js")) salida.push(abs);
  }
  return salida;
}

test("ARCHIVOS no apunta a archivos inexistentes", () => {
  const lista = leerArchivos();
  assert.ok(lista.length > 0);
  for (const p of lista) {
    const abs = p.startsWith("/") ? path.join(RAIZ, p) : path.join(APP, p);
    assert.ok(fs.existsSync(abs), `ARCHIVOS lista un camino inexistente: ${p}`);
  }
});

test("todo .js de app/ está en ARCHIVOS", () => {
  const lista = new Set(leerArchivos());
  for (const abs of jsEnApp(APP)) {
    const rel = path.relative(APP, abs).split(path.sep).join("/");
    if (rel === "sw.js") continue;
    assert.ok(lista.has("./" + rel), `falta en ARCHIVOS: ./${rel}`);
  }
});
