import { D } from "./estado.js";
import { num } from "./util.js";

/* ---------- cálculo ---------- */
// La fórmula vive en calculo.js (la comparte el servidor); acá solo se delega.
export function calc(p) {
  return Calculo.calcular(p, D);
}
export const prod = (id) => D.produtos.find((p) => p.id === id);
/** Lo que se gasta de verdad: la pieza más el desperdicio estimado. */
export function gramosCon(p) {
  return Calculo.gramosCon(p, D.cfg);
}
/** Lo que cuesta UNA unidad del insumo, sacado del precio del paquete. */
export function unitario(it) {
  return Calculo.unitario(it);
}
export function migrarInsumos() {
  (D.insumos || []).forEach((i) => {
    if (i.pack === undefined || i.pack === null) {
      i.pack = num(i.preco);
      i.unid = 1;
    }
    delete i.preco;
    if (i.stock === undefined || i.stock === null) i.stock = num(i.unid);
  });
  (D.filamentos || []).forEach((f) => {
    if (!f.rollo) f.rollo = 1000;
    if (f.stock === undefined || f.stock === null) f.stock = num(f.rollo);
  });
  // El número es el que se escribe con marcador en el rollo, para saber de un
  // vistazo cuál de la estantería es cuál. Se numeran los que no tenían,
  // respetando los que ya venían con número puesto a mano.
  let ultimo = proximoNumFil() - 1;
  (D.filamentos || []).forEach((f) => {
    if (!num(f.num)) f.num = ++ultimo;
  });
}
/** El próximo libre: siempre uno más que el mayor, así borrar uno del medio
    no hace que el número vuelva a usarse en otro rollo. */
export function proximoNumFil() {
  return (D.filamentos || []).reduce((m, f) => Math.max(m, num(f.num)), 0) + 1;
}
