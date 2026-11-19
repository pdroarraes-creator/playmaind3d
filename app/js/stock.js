import { D } from "./estado.js";
import { num } from "./util.js";
import { gramosCon } from "./calculo.js";
import { filName } from "./main.js";

/* ---------- stock ---------- */
/** Cuánto se consume al hacer estas piezas: gramos por filamento y unidades por insumo. */
export function consumoDe(items) {
  const fil = {},
    ins = {};
  items.forEach(({ p, q, fil: elegido }) => {
    const id = elegido || p.fil;
    fil[id] = num(fil[id]) + gramosCon(p) * q;
    for (const k in p.insumos || {}) ins[k] = num(ins[k]) + num(p.insumos[k]) * q;
  });
  return { fil, ins };
}
export function aplicarConsumo(c, signo) {
  if (!c) return;
  for (const id in c.fil || {}) {
    const f = D.filamentos.find((x) => x.id === id);
    if (f) f.stock = Math.round((num(f.stock) + signo * num(c.fil[id])) * 10) / 10;
  }
  for (const id in c.ins || {}) {
    const i = D.insumos.find((x) => x.id === id);
    if (i) i.stock = num(i.stock) + signo * num(c.ins[id]);
  }
}
export function alertasStock() {
  const out = [];
  D.filamentos.forEach((f) => {
    const g = num(f.stock),
      r = Math.max(num(f.rollo), 1);
    if (g <= 0) out.push({ txt: "Te quedaste sin " + filName(f.id), grave: true });
    else if (g / r < 0.15)
      out.push({ txt: "Quedan " + Math.round(g) + " g de " + filName(f.id), grave: false });
  });
  D.insumos.forEach((i) => {
    const u = num(i.stock),
      p = Math.max(num(i.unid), 1);
    if (u <= 0) out.push({ txt: "Te quedaste sin " + i.nome.toLowerCase(), grave: true });
    else if (u / p < 0.15)
      out.push({ txt: "Quedan " + Math.round(u) + " " + i.nome.toLowerCase(), grave: false });
  });
  return out;
}
