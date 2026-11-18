// Pruebas del dibujo del PDF. Carga jsPDF y la fuente como lo hace el navegador.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const app = (f) => path.join(__dirname, "..", "app", f);
vm.runInThisContext(fs.readFileSync(app("vendor/jspdf.umd.min.js"), "utf8"));
vm.runInThisContext(fs.readFileSync(app("vendor/fredoka.js"), "utf8").replace("var FREDOKA_B64", "globalThis.FREDOKA_B64"));
const P = require("../app/presupuesto.js");
const PDF = require("../app/presupuesto-pdf.js");

function presu(items) {
  const it = items || [
    { p: { nome: "Llavero", fotos: ["https://lh3.googleusercontent.com/d/ABC"] }, q: 2, r: { preco: 3000 }, fil: "f" },
    { p: { nome: "Estrella" }, q: 1, r: { preco: 5000 }, fil: null },
  ];
  const bruto = it.reduce((s, x) => s + x.r.preco * x.q, 0);
  return P.armarPresupuesto(
    { it, bruto, desc: 0.1, envio: 1500, total: bruto * 0.9 + 1500 },
    { n: 42, cliente: "María", fecha: new Date(2026, 10, 17), dias: 7, marca: "PlayMind 3d", wa: "+54 9 11 2799", ig: "@playmind3d", colorDe: () => "Azul" },
  );
}
const texto = (buf) => Buffer.from(buf).toString("latin1");

test("idDeDrive", () => {
  assert.equal(PDF.idDeDrive("https://lh3.googleusercontent.com/d/ABC_12-x"), "ABC_12-x");
  assert.equal(PDF.idDeDrive("https://x.com/a.png"), null);
  assert.equal(PDF.idDeDrive(""), null);
});

test("sin foto no rompe", async () => {
  const buf = await PDF.generarPdf(presu(), { cargar: async () => null, salida: "arraybuffer", comprimir: false });
  const s = texto(buf);
  for (const t of ["042", "Total", "$11.400", "17/11/2026", "24/11/2026", "Mar", "Llavero"]) assert.ok(s.includes(t), t);
  for (const t of ["lucro", "costo", "comisi"]) assert.ok(!s.includes(t), t);
});

test("muchas piezas pasan a otra hoja", async () => {
  const it = [];
  for (let i = 0; i < 25; i++) it.push({ p: { nome: i === 3 ? "Nombre larguísimo ".repeat(7) : "Pieza " + i }, q: 1, r: { preco: 1000 }, fil: null });
  const doc = await PDF.generarPdf(presu(it), { cargar: async () => null, salida: "doc" });
  assert.ok(doc.getNumberOfPages() >= 2);
});

test("cargarImagen usa el servidor cuando Google bloquea", async () => {
  const fetchViejo = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError("CORS"); };
  try {
    const r = await PDF.cargarImagen("https://lh3.googleusercontent.com/d/ABC", async (id) => {
      assert.equal(id, "ABC");
      return { ok: true, mime: "image/png", b64: "AAA" };
    });
    assert.ok(r.data.startsWith("data:image/png;base64,"));
    const n = await PDF.cargarImagen("https://lh3.googleusercontent.com/d/ABC", async () => { throw new Error("offline"); });
    assert.equal(n, null);
    assert.equal(await PDF.cargarImagen("", async () => ({})), null);
  } finally {
    globalThis.fetch = fetchViejo;
  }
});
