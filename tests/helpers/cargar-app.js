// Carga el tramo de app/app.js que va desde el inicio hasta el marcador
// `stock` (helpers + almacenamiento + cálculo) en una vm con el DOM simulado.
const fs = require("fs");
const vm = require("vm");

function cargarApp() {
  const src = fs.readFileSync(__dirname + "/../../app/app.js", "utf8");
  const fin = src.indexOf("/* ---------- stock ---------- */");
  if (fin < 0) throw new Error("No se encontró el marcador de la sección stock");
  const nodo = () => ({ addEventListener() {}, setAttribute() {}, appendChild() {}, style: {}, classList: { add() {}, remove() {}, toggle() {} } });
  const ctx = {
    document: { querySelector: () => null, querySelectorAll: () => [], createElement: nodo, createTextNode: nodo, addEventListener() {} },
    window: { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: {},
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(src.slice(0, fin), ctx, { filename: "app/app.js" });
  return {
    calc: (p) => vm.runInContext("calc(__p)", Object.assign(ctx, { __p: p })),
    setD(estado) {
      ctx.__x = estado;
      vm.runInContext("D = __x", ctx);
    },
  };
}

module.exports = { cargarApp };
