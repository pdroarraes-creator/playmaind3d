import { $, el, uid, num, money, pct, hhmm, hoy } from "./util.js";
import { D } from "./estado.js";
import { toast, showTab, renderAll } from "./ui.js";
import { calc, gramosCon } from "./calculo.js";
import { consumoDe, aplicarConsumo, alertasStock } from "./stock.js";
import { thumb } from "./fotos.js";
import { chgQty } from "./catalogo.js";
import { save, pedir } from "./nube.js";

/* ---------- pedido ---------- */
/** Con qué filamento se va a imprimir esta pieza en este pedido. */
function filDe(p) {
  if (!p) return null;
  if (
    p.libre &&
    D.pedidoFil &&
    D.pedidoFil[p.id] &&
    D.filamentos.some((f) => f.id === D.pedidoFil[p.id])
  )
    return D.pedidoFil[p.id];
  return p.fil;
}
function pedidoItems() {
  const out = [];
  D.produtos.forEach((p) => {
    const q = num(D.pedido[p.id]);
    if (q <= 0) return;
    const fil = filDe(p);
    const r = calc(Object.assign({}, p, { fil }));
    out.push({ p, q, r, fil });
  });
  return out;
}
function pedidoTotales() {
  const it = pedidoItems();
  let bruto = 0,
    custo = 0,
    horas = 0,
    piezas = 0;
  it.forEach((x) => {
    bruto += x.r.preco * x.q;
    custo += x.r.custo * x.q;
    horas += x.r.horas * x.q;
    piezas += x.q;
  });
  const desc = Math.min(num($("#p_desc").value), 90) / 100,
    envio = num($("#p_envio").value);
  const canal = D.canais.find((c) => c.id === $("#p_canal").value) || { comision: 0 };
  const com = num(canal.comision) / 100;
  const total = bruto * (1 - desc) + envio;
  return {
    it,
    bruto,
    custo,
    horas,
    piezas,
    desc,
    envio,
    total,
    com,
    lucro: (total - envio) * (1 - com) - custo,
    canal,
  };
}
export function renderPed() {
  const box = $("#pedList");
  box.textContent = "";
  const t = pedidoTotales();
  if (!t.it.length)
    box.appendChild(
      el("div", { class: "empty" }, "Elegí piezas desde el catálogo con los botones + y −."),
    );
  t.it.forEach(({ p, q, r, fil }) => {
    let elegir = null;
    if (p.libre) {
      elegir = el("select", {
        style: "margin-top:5px;padding:5px 7px;font-size:12px",
        onchange: (e) => {
          D.pedidoFil[p.id] = e.target.value;
          save();
          renderAll();
        },
      });
      D.filamentos.forEach((f) => {
        const g = num(f.stock),
          corto = g < gramosCon(p) * q;
        elegir.appendChild(
          el(
            "option",
            { value: f.id },
            (f.marca ? f.marca + " " : "") +
              f.nome +
              (f.cor ? " · " + f.cor : "") +
              (corto ? " (poco stock)" : ""),
          ),
        );
      });
      elegir.value = fil;
    }
    box.appendChild(
      el(
        "div",
        { class: "item" },
        thumb(p),
        el(
          "div",
          { class: "info" },
          el("b", {}, p.nome),
          el("span", {}, money(r.preco) + " c/u"),
          elegir,
        ),
        el(
          "div",
          { class: "qty" },
          el("button", { onclick: () => chgQty(p.id, -1) }, "−"),
          el("input", {
            type: "number",
            inputmode: "numeric",
            min: "0",
            value: q,
            oninput: (e) => {
              D.pedido[p.id] = num(e.target.value);
              save();
              renderAll();
            },
          }),
          el("button", { onclick: () => chgQty(p.id, 1) }, "+"),
        ),
        el("div", { class: "val" }, el("b", {}, money(r.preco * q))),
      ),
    );
  });
  $("#p_total").textContent = money(t.total);
  $("#p_sub").textContent =
    (t.piezas ? t.piezas + " piezas · " : "") +
    (t.desc > 0 ? pct(t.desc) + " off · " : "") +
    (t.com > 0 ? "comisión " + pct(t.com) + " · " : "") +
    hhmm(t.horas) +
    " de impresión";
  $("#p_custo").textContent = money(t.custo);
  $("#p_lucro").textContent = money(t.lucro);
  $("#p_horas").textContent = hhmm(t.horas);
}
function textoPedido() {
  const t = pedidoTotales();
  if (!t.it.length) return null;
  const cli = $("#p_cli").value.trim();
  let s =
    "Hola" +
    (cli ? " " + cli : "") +
    "! Te paso el presupuesto de " +
    (D.cfg.marca || "PlayMind 3D") +
    ":\n\n";
  t.it.forEach(({ p, q, r }) => {
    s += "• " + q + "x " + p.nome + " — " + money(r.preco * q) + "\n";
  });
  if (t.desc > 0) s += "Descuento: -" + money(t.bruto * t.desc) + "\n";
  if (t.envio > 0) s += "Envío: " + money(t.envio) + "\n";
  s += "\nTotal: " + money(t.total) + "\n\nSe imprime a pedido, elegís el color 🎨";
  return s;
}
export function mandarWA() {
  const t = textoPedido();
  if (!t) {
    toast("El pedido está vacío.");
    return;
  }
  const url = "https://wa.me/?text=" + encodeURIComponent(t);
  window.open(url, "_blank", "noopener");
}
function colorDe(fil) {
  const f = D.filamentos.find((x) => x.id === fil);
  return f ? f.cor || f.nome || "el que elijas" : "el que elijas";
}
let armandoPresu = false;
let presuListo = null; // { blob, nombre, texto } del último PDF armado
function mostrarPresuListo(ver) {
  $("#presuListo").hidden = !ver;
  if (ver) $("#presuListoTit").textContent = "PDF listo — " + presuListo.nombre;
}
export function descargarPresupuesto() {
  if (!presuListo) return;
  const url = URL.createObjectURL(presuListo.blob);
  const a = el("a", { href: url, download: presuListo.nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  const w = window.open("https://wa.me/?text=" + encodeURIComponent(presuListo.texto), "_blank", "noopener");
  if (!w) toast("PDF descargado. Abrí WhatsApp y adjuntalo.");
}
/* Se llama desde un toque, así el navegador deja abrir "compartir". */
export async function compartirPresupuesto() {
  if (!presuListo) return;
  const file = new File([presuListo.blob], presuListo.nombre, { type: "application/pdf" });
  let err = null;
  try {
    await navigator.share({ files: [file], text: presuListo.texto });
  } catch (e) {
    err = e || { name: "Error" };
  }
  const paso = despuesDeCompartir(err);
  if (paso === "listo") mostrarPresuListo(false);
  else if (paso === "boton") mostrarPresuListo(true);
  else {
    console.error(err);
    descargarPresupuesto();
    mostrarPresuListo(true);
  }
}
/* Arma el PDF del presupuesto y lo comparte (o lo descarga si el teléfono no deja). */
export async function enviarPresupuesto() {
  const t = pedidoTotales();
  if (!t.it.length) {
    toast("El pedido está vacío.");
    return;
  }
  if (armandoPresu) return;
  armandoPresu = true;
  mostrarPresuListo(false);
  toast("Armando el presupuesto…");
  const t0 = Date.now();
  try {
    const n = reservarNumero(D.cfg);
    const presu = armarPresupuesto(t, {
      n,
      cliente: $("#p_cli").value.trim(),
      fecha: new Date(),
      dias: D.cfg.presupDias,
      marca: D.cfg.marca || "PlayMind 3d",
      wa: D.cfg.wa,
      ig: "@playmind3d",
      colorDe,
    });
    const pedirFoto = (id) => pedir({ action: "foto", email: D.cfg.email || "", token: D.cfg.token || "", id });
    const logo = await cargarImagen("/assets/logo-app.png");
    const blob = await generarPdf(presu, { logo, pedirFoto });
    // recién ahora, con el PDF hecho, se gasta el número
    confirmarNumero(D.cfg, n);
    D.presupuestos = registrar(D.presupuestos, presu);
    save();
    presuListo = { blob, nombre: nombreArchivo(presu), texto: textoCompartir(presu) };
    const file = new File([blob], presuListo.nombre, { type: "application/pdf" });
    const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    const modo = comoEntregar({ puedeCompartir, ms: Date.now() - t0 });
    if (modo === "compartir") await compartirPresupuesto();
    else if (modo === "boton") mostrarPresuListo(true);
    else {
      descargarPresupuesto();
      mostrarPresuListo(true);
    }
  } catch (e) {
    console.error(e);
    toast("No pude armar el PDF. Probá de nuevo.");
  } finally {
    armandoPresu = false;
  }
}
export function vaciarPedido() {
  D.pedido = {};
  $("#p_desc").value = 0;
  $("#p_envio").value = 0;
  $("#p_cli").value = "";
  save();
  renderAll();
}
export function registrarVenta() {
  const t = pedidoTotales();
  if (!t.it.length) {
    toast("El pedido está vacío.");
    return;
  }
  const v = {
    id: uid(),
    data: hoy(),
    cliente: $("#p_cli").value.trim() || "Sin nombre",
    canal: t.canal.id || "",
    itens: t.it.map(({ p, q, r }) => ({
      id: p.id,
      nome: p.nome,
      qtd: q,
      preco: r.preco,
      custo: r.custo,
    })),
    desconto: t.desc,
    envio: t.envio,
    comision: t.com,
    total: t.total,
    custo: t.custo,
    lucro: t.lucro,
    pago: false,
    entregue: false,
    consumo: consumoDe(t.it),
    desdeStock: false, // el pedido se imprime a propósito, no sale de lo ya hecho
    stockUsado: {},
  };
  aplicarConsumo(v.consumo, -1);
  D.vendas.unshift(v);
  vaciarPedido();
  save();
  renderAll();
  showTab("ven");
  const al = alertasStock();
  toast(al.length ? "Venta registrada. " + al[0].txt : "Venta registrada.");
}

export function iniciarPedido() {
  ["p_desc", "p_envio", "p_canal"].forEach((id) => $("#" + id).addEventListener("input", renderPed));
}
