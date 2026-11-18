/* ---------- presupuesto: datos, numeración e historial ----------
 * Lógica pura (sin DOM). La usan app.js y presupuesto-pdf.js, y la prueban
 * las pruebas de tests/ con Node. Nunca expone costo, lucro, comisión ni horas.
 */
(function (raiz) {
  const HISTORIAL_MAX = 30;

  const dinero = (v) => "$" + Math.round(v).toLocaleString("es-AR");
  const dos = (n) => String(n).padStart(2, "0");

  function migrarPresupuestos(D) {
    if (!Array.isArray(D.presupuestos)) D.presupuestos = [];
    if (!D.cfg) D.cfg = {};
    if (typeof D.cfg.presupNum !== "number") D.cfg.presupNum = 0;
    if (typeof D.cfg.presupDias !== "number") D.cfg.presupDias = 7;
  }

  function siguienteNumero(cfg) {
    cfg.presupNum = (Number(cfg.presupNum) || 0) + 1;
    return cfg.presupNum;
  }

  /** Número que va a tener el próximo presupuesto, sin gastarlo todavía. */
  const reservarNumero = (cfg) => (Number(cfg.presupNum) || 0) + 1;
  /** Gasta el número recién cuando el PDF ya existe. */
  function confirmarNumero(cfg, n) {
    cfg.presupNum = Math.max(Number(cfg.presupNum) || 0, n);
  }

  // El navegador sólo deja abrir "compartir" poco después del toque (~5 s).
  const VENTANA_TOQUE_MS = 4000;
  function comoEntregar({ puedeCompartir, ms }) {
    if (!puedeCompartir) return "descargar";
    return ms < VENTANA_TOQUE_MS ? "compartir" : "boton";
  }
  /** err = null si se compartió. Cancelar o quedar sin permiso deja el botón para reintentar. */
  function despuesDeCompartir(err) {
    if (!err) return "listo";
    return err.name === "AbortError" || err.name === "NotAllowedError" ? "boton" : "descargar";
  }

  const numeroTxt = (n) => String(n).padStart(3, "0");
  const fechaTxt = (d) => dos(d.getDate()) + "/" + dos(d.getMonth() + 1) + "/" + d.getFullYear();
  const fechaIso = (d) => d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate());

  function armarPresupuesto(tot, o) {
    const hoy = o.fecha || new Date();
    const vence = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + (Number(o.dias) || 7));
    const items = tot.it.map(({ p, q, r, fil }) => ({
      nome: p.nome || "Pieza",
      color: o.colorDe ? o.colorDe(fil) : "",
      q,
      unit: r.preco,
      sub: r.preco * q,
      foto: (Array.isArray(p.fotos) && p.fotos[0]) || p.foto || "",
    }));
    return {
      n: o.n,
      numero: numeroTxt(o.n),
      fecha: fechaTxt(hoy),
      iso: fechaIso(hoy),
      valido: fechaTxt(vence),
      cliente: (o.cliente || "").trim(),
      marca: o.marca || "PlayMind 3d",
      wa: o.wa || "",
      ig: o.ig || "",
      items,
      bruto: tot.bruto,
      descPct: tot.desc,
      descMonto: tot.bruto * tot.desc,
      envio: tot.envio,
      total: tot.total,
    };
  }

  function nombreArchivo(pr) {
    const cli = (pr.cliente || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return "Presupuesto-" + pr.numero + (cli ? "-" + cli : "") + ".pdf";
  }

  function registrar(lista, pr) {
    const l = (Array.isArray(lista) ? lista : []).concat([
      { n: pr.n, f: pr.iso, c: pr.cliente, t: Math.round(pr.total) },
    ]);
    return l.slice(-HISTORIAL_MAX);
  }

  function textoCompartir(pr) {
    return (
      "¡Hola" + (pr.cliente ? " " + pr.cliente : "") + "! Te paso el Presupuesto N° " + pr.numero +
      " de " + pr.marca + ": total " + dinero(pr.total) + ", válido hasta " + pr.valido +
      ". Se imprime a pedido 🎨"
    );
  }

  const api = {
    migrarPresupuestos, siguienteNumero, reservarNumero, confirmarNumero, comoEntregar, despuesDeCompartir, numeroTxt, fechaTxt, armarPresupuesto,
    nombreArchivo, registrar, textoCompartir, dinero,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(raiz, api);
})(typeof window !== "undefined" ? window : globalThis);
