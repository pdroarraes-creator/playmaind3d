/* Guarda de los handlers inline (onclick="..." etc.) de app/index.html.
 * main.js es un módulo: sus funciones ya no son globales, así que todo lo que
 * el HTML llame tiene que salir de window.PM. Los nombres se DERIVAN del HTML
 * (no hay lista escrita a mano), así un handler nuevo queda cubierto solo. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..");
const HTML = fs.readFileSync(path.join(RAIZ, "app/index.html"), "utf8");
const PERMITIDAS = new Set(["if", "for", "while", "switch", "return", "function", "confirm", "alert", "prompt"]);

function handlers() {
  const out = [];
  const re = /\bon[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(HTML))) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

// quita literales de texto para no tomar 'x(' de dentro de un string
function sinStrings(js) {
  return js.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");
}

// { desnudas: llamadas sin prefijo, conPM: llamadas PM.x(), globales: D/LOGO sueltos }
function analizar() {
  const desnudas = new Set();
  const conPM = new Set();
  const globales = new Set();
  for (const h of handlers()) {
    const js = sinStrings(h);
    for (const m of js.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (!PERMITIDAS.has(m[1])) desnudas.add(m[1]);
    }
    for (const m of js.matchAll(/(?<![\w$.])PM\.([A-Za-z_$][\w$]*)\s*\(/g)) conPM.add(m[1]);
    for (const m of js.matchAll(/(?<![\w$.])(D|LOGO)\b/g)) globales.add(m[1]);
  }
  return { desnudas, conPM, globales };
}

test("todo handler inline de app/index.html pasa por PM", () => {
  const { desnudas, globales } = analizar();
  assert.deepEqual([...desnudas], [], "llamadas sin PM.: " + [...desnudas].join(", "));
  assert.deepEqual([...globales], [], "globales sueltos (usar PM.D / PM.LOGO): " + [...globales].join(", "));
});

test("cada nombre que el HTML llama existe en window.PM de main.js", () => {
  const main = fs.readFileSync(path.join(RAIZ, "app/js/main.js"), "utf8");
  const i = main.indexOf("window.PM = {");
  assert.ok(i >= 0, "main.js no define window.PM = { ... }");
  const cuerpo = main.slice(i, main.indexOf("};", i));
  const { conPM } = analizar();
  assert.ok(conPM.size > 0, "no se encontró ningún PM.x() en el HTML");
  const faltan = [...conPM].filter((n) => !new RegExp("(^|[\\s,{])" + n.replace("$", "\\$") + "\\s*(,|:|\\n|$)").test(cuerpo));
  assert.deepEqual(faltan, [], "faltan en window.PM: " + faltan.join(", "));
});
