// El chat de cadastro sólo propone categorías que ya existen.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

test("traduce categorías y marca que no se crean", async () => {
  const { traducirParaAgregarPieza } = await import("../cadastro-worker/src/index.js");
  const p = traducirParaAgregarPieza({ nome: "X", preco: 100, categorias: "Navidad, Sensoriales" });
  assert.equal(p.cat, "Navidad, Sensoriales");
  assert.equal(p.catSoloExistentes, true);
  assert.equal(traducirParaAgregarPieza({ nome: "X", preco: 100 }).cat, "");
});

test("las herramientas piden categorías existentes", () => {
  const src = fs.readFileSync(path.join(__dirname, "../cadastro-worker/src/gemini.js"), "utf8");
  const bloque = src.slice(src.indexOf("TOOL_CADASTRAR_PECA"), src.indexOf("TOOL_CADASTRAR_FILAMENTO"));
  assert.ok(bloque.includes("categorias"), "cadastrar_peca sin categorias");
  assert.ok(src.split("Nunca invente categoria").length - 1 >= 2, "falta la regla en las dos herramientas");
});

test("el resumen del negocio lleva la lista", () => {
  const ctx = { Session: { getScriptTimeZone: () => "America/Argentina/Buenos_Aires" }, Utilities: { formatDate: (d) => d.toISOString().slice(0, 7) } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../server/Codigo.gs"), "utf8"), ctx);
  const data = { cfg: {}, categorias: ["Navidad", "Biología"], produtos: [], filamentos: [], impressoras: [], vendas: [], insumos: [] };
  ctx.leerEstado_ = () => data;
  ctx.leerEstadoYV_ = () => ({ data, v: "1" });
  const r = ctx.resumenNegocio_();
  assert.deepEqual(JSON.parse(JSON.stringify(r.resumen.categorias)), ["Navidad", "Biología"]);
});
