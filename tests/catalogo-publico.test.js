// Prueba fotoChica_ y que catalogoPublico_ entregue fotos reducidas (server/Codigo.gs).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");

function cargar() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(__dirname + "/../server/Codigo.gs", "utf8"), ctx);
  return ctx;
}

test("fotoChica_ achica fotos de Drive", () => {
  const ctx = cargar();
  assert.equal(
    ctx.fotoChica_("https://lh3.googleusercontent.com/d/abc123"),
    "https://lh3.googleusercontent.com/d/abc123=w800"
  );
});

test("fotoChica_ no toca lo que ya tiene medida", () => {
  const ctx = cargar();
  const u = "https://lh3.googleusercontent.com/d/abc123=s400";
  assert.equal(ctx.fotoChica_(u), u);
});

test("fotoChica_ no toca otras URLs ni vacíos", () => {
  const ctx = cargar();
  ["https://ejemplo.com/a.jpg", "data:image/png;base64,AAA", ""].forEach((u) => {
    assert.equal(ctx.fotoChica_(u), u);
  });
  assert.equal(ctx.fotoChica_(undefined), undefined);
});

test("catalogoPublico_ entrega fotos chicas sin tocar el estado", () => {
  const ctx = cargar();
  const base = "https://lh3.googleusercontent.com/d/";
  const data = {
    cfg: { merma: 12, kwh: 0, maoObra: 0, risco: 0, mult: 2, round: 1,
           leti: { cita: "c", historia: "h", foto: base + "leti1" } },
    filamentos: [{ id: "f1", cor: "Rojo", hex: "#f00", precoKg: 10000 }],
    impressoras: [{ id: "i1", preco: 0, vida: 1, watts: 0, bico: 0, bicoVida: 1, mesa: 0, mesaVida: 1 }],
    produtos: [{ nome: "Pieza", fil: "f1", imp: "i1", peso: 20, h: 1, m: 0,
                 fotos: [base + "aaa", base + "bbb"] }],
  };
  ctx.leerEstado_ = () => data;
  const r = ctx.catalogoPublico_();
  const fotos = JSON.parse(JSON.stringify(r.piezas[0].fotos));
  assert.equal(fotos.length, 2);
  fotos.forEach((f) => assert.ok(f.endsWith("=w800")));
  assert.ok(r.leti.foto.endsWith("=w800"));
  assert.equal(data.produtos[0].fotos[0], base + "aaa");
  assert.equal(data.cfg.leti.foto, base + "leti1");
});
