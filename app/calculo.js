/* ---------- cálculo de costo y precio ----------
 * Lógica pura (sin DOM ni estado global): recibe la pieza y los datos.
 * Reproduce exactamente calc()/gramosCon()/unitario() de app.js; la pantalla
 * es la referencia y calcular_() de server/Codigo.gs se alinea a esto.
 * Se prueba con Node en tests/calculo-paridad.test.js.
 */
(function (raiz) {
  /** Acepta 17,80 y 17.80 por igual: acá se escribe con coma. */
  const num = (v) => {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const n = parseFloat(String(v == null ? "" : v).replace(",", "."));
    return isFinite(n) ? n : 0;
  };
  const ceilTo = (v, s) => (s > 1 ? Math.ceil(v / s) * s : Math.ceil(v));

  /** Lo que se gasta de verdad: la pieza más el desperdicio estimado. */
  function gramosCon(p, cfg) {
    const base = num(p && p.peso);
    const c = cfg || {};
    const m = c.merma === null || c.merma === undefined ? 12 : num(c.merma);
    return Math.round(base * (1 + m / 100) * 10) / 10;
  }

  /** Lo que cuesta UNA unidad del insumo, sacado del precio del paquete. */
  function unitario(it) {
    if (!it) return 0;
    if (it.pack !== undefined && it.pack !== null) return num(it.pack) / Math.max(num(it.unid), 1);
    return num(it.preco); // formato viejo: ya venía por unidad
  }

  function calcular(p, data) {
    const d = data || {};
    const c = d.cfg || {};
    const filamentos = d.filamentos || [];
    const impressoras = d.impressoras || [];
    const lista = d.insumos || [];
    const fil = filamentos.find((f) => f.id === p.fil) || filamentos[0] || { precoKg: 0 };
    const imp = impressoras.find((i) => i.id === p.imp) ||
      impressoras[0] || { preco: 0, vida: 1, watts: 0, bico: 0, bicoVida: 1, mesa: 0, mesaVida: 1 };
    const gr = gramosCon(p, c),
      hs = num(p.h) + num(p.m) / 60;
    const material = (num(fil.precoKg) / 1000) * gr;
    const luz = (num(imp.watts) / 1000) * hs * num(c.kwh);
    const desgaste =
      (num(imp.preco) / Math.max(num(imp.vida), 1) +
        num(imp.bico) / Math.max(num(imp.bicoVida), 1) +
        num(imp.mesa) / Math.max(num(imp.mesaVida), 1)) *
      hs;
    const trabalho = num(c.maoObra) * (num(p.mo) / 60);
    let insumos = 0;
    for (const k in p.insumos || {}) {
      const it = lista.find((x) => x.id === k);
      if (it) insumos += unitario(it) * num(p.insumos[k]);
    }
    const impresion = material + luz + desgaste;
    const rp = (p.risco === null || p.risco === undefined ? num(c.risco) : num(p.risco)) / 100;
    const reserva = impresion * rp;
    const custo = impresion + reserva + trabalho + insumos;
    const mult = (p.mult === null || p.mult === undefined ? num(c.mult) : num(p.mult)) || 1;
    const cplx = num(p.cplx) || 1;
    let preco;
    if (p.manual !== null && p.manual !== undefined && p.manual !== "" && num(p.manual) > 0)
      preco = num(p.manual);
    else preco = ceilTo(custo * mult * cplx, num(c.round) || 1);
    const lucro = preco - custo;
    return {
      material,
      luz,
      desgaste,
      trabalho,
      insumos,
      reserva,
      custo,
      preco,
      lucro,
      margem: preco > 0 ? lucro / preco : 0,
      horas: hs,
      porHora: hs > 0 ? lucro / hs : 0,
      gramos: gr,
    };
  }

  const api = { calcular, gramosCon, unitario, num, ceilTo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Calculo = api;
})(typeof window !== "undefined" ? window : globalThis);
