export const $ = (s) => document.querySelector(s);
export const el = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const p in a) {
    if (p === "html") e.innerHTML = a[p];
    else if (p.slice(0, 2) === "on") e.addEventListener(p.slice(2), a[p]);
    else if (a[p] !== null && a[p] !== false) e.setAttribute(p, a[p]);
  }
  k.flat().forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    e.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  });
  return e;
};
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** Acepta 17,80 y 17.80 por igual: acá se escribe con coma. */
export const num = (v) => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v == null ? "" : v).replace(",", "."));
  return isFinite(n) ? n : 0;
};
export const money = (v) => "$" + Math.round(v).toLocaleString("es-AR");
export const pct = (v) => (v * 100).toFixed(0) + "%";
export const hhmm = (h) => {
  const H = Math.floor(h),
    M = Math.round((h - H) * 60);
  return H + "h" + (M ? " " + M + "m" : "");
};
export const ceilTo = (v, s) => (s > 1 ? Math.ceil(v / s) * s : Math.ceil(v));
export const hoy = () => new Date().toISOString().slice(0, 10);
/** 2026-08-30 -> 30/08. En una lista de ventas el año casi siempre sobra. */
export const fechaCorta = (d) => {
  const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3] + "/" + m[2] : String(d || "");
};
