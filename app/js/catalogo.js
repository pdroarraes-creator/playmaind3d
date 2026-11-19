import { $, el, uid, num, money, hhmm, hoy } from "./util.js";
import { D, LOGO_FULL } from "./estado.js";
import { toast, showTab, renderAll } from "./ui.js";
import { calc, gramosCon } from "./calculo.js";
import { consumoDe, aplicarConsumo, alertasStock } from "./stock.js";
import { thumb } from "./fotos.js";
import { save, renderPed } from "./main.js";
import { cargarPieza } from "./editor.js";

/* ---------- catálogo ---------- */
function renderAvisos() {
  const box = $("#avisos");
  box.textContent = "";
  const al = alertasStock();
  if (!al.length) return;
  box.appendChild(
    el(
      "div",
      { class: "warn" + (al.some((a) => a.grave) ? " grave" : "") },
      el("b", { style: "font:600 13px Fredoka,sans-serif" }, "Hay que reponer"),
      el("div", { style: "margin-top:4px" }, al.map((a) => a.txt).join(" · ")),
    ),
  );
}
export function renderCat() {
  renderAvisos();
  const q = ($("#q").value || "").toLowerCase(),
    box = $("#catList");
  box.textContent = "";
  const list = D.produtos.filter(
    (p) => !q || (p.nome + " " + (p.ref || "") + " " + filName(p.fil)).toLowerCase().includes(q),
  );
  if (!list.length) {
    if (D.produtos.length) {
      box.appendChild(el("div", { class: "empty" }, "Nada con ese nombre."));
    } else {
      box.appendChild(
        el(
          "div",
          { class: "empty", style: "padding:8px" },
          el("img", {
            src: LOGO_FULL,
            alt: "PlayMind 3d",
            style: "width:190px;margin:0 auto 10px;opacity:.95",
          }),
          el(
            "p",
            { style: "margin:0;font:600 15px Fredoka,sans-serif;color:var(--deep)" },
            "Empezá cargando tu primera pieza",
          ),
          el(
            "p",
            { class: "mut", style: "margin:5px 0 0" },
            "Peso, tiempo y filamento. El precio lo saca la app.",
          ),
        ),
      );
    }
    return;
  }
  list.forEach((p) => {
    const r = calc(p),
      q0 = num(D.pedido[p.id]);
    box.appendChild(
      el(
        "div",
        { class: "item" },
        thumb(p),
        el(
          "div",
          {
            class: "info",
            onclick: () => {
              cargarPieza(p);
              showTab("calc");
            },
          },
          el("b", {}, p.nome || "(sin nombre)"),
          el(
            "span",
            {},
            (p.libre ? "Color a elegir" : filName(p.fil)) +
              " · " +
              gramosCon(p) +
              "g · " +
              hhmm(r.horas),
            " ",
            selloMercado(p, r),
          ),
        ),
        el(
          "div",
          { class: "val" },
          el("b", {}, money(r.preco)),
          el("span", {}, "costo " + money(r.custo)),
        ),
        el(
          "div",
          { class: "ctrl" },
          el(
            "div",
            { class: "stockcol" },
            el("span", { class: "stlbl" }, "hechas"),
            el(
              "div",
              { class: "qty chico" },
              el("button", { title: "Vendí una", onclick: () => ventaRapida(p) }, "−"),
              el("i", { class: "stnum" + (num(p.stock) > 0 ? " hay" : "") }, String(num(p.stock))),
              el("button", { title: "Imprimí una más", onclick: () => sumarStock(p, 1) }, "+"),
            ),
          ),
          el(
            "div",
            { class: "stockcol" },
            el("span", { class: "stlbl" }, "pedido"),
            el(
              "div",
              { class: "qty chico" },
              el("button", { onclick: () => chgQty(p.id, -1) }, "−"),
              el("input", {
                type: "number",
                inputmode: "numeric",
                min: "0",
                value: q0,
                style: "width:38px",
                oninput: (e) => {
                  D.pedido[p.id] = num(e.target.value);
                  save();
                  renderPed();
                },
              }),
              el("button", { onclick: () => chgQty(p.id, 1) }, "+"),
            ),
          ),
        ),
      ),
    );
  });
}
export function chgQty(id, d) {
  D.pedido[id] = Math.max(0, num(D.pedido[id]) + d);
  save();
  renderCat();
  renderPed();
}
function selloMercado(p, r) {
  const mk = num(p.mercado);
  if (mk <= 0) return null;
  const d = (r.preco - mk) / mk;
  if (d > 0.15) return el("i", { class: "pill y", style: "font-style:normal" }, "cara vs mercado");
  if (d < -0.15) return el("i", { class: "pill g", style: "font-style:normal" }, "podés subir");
  return el("i", { class: "pill", style: "font-style:normal" }, "en precio");
}
/** Imprimió una más: sube el stock y descuenta filamento e insumos. */
export function sumarStock(p, n) {
  p.stock = Math.max(0, num(p.stock) + n);
  if (n > 0) aplicarConsumo(consumoDe([{ p, q: n }]), -1);
  save();
  renderCat();
  const al = alertasStock();
  toast(
    al.length ? "Ahora hay " + p.stock + ". " + al[0].txt : "Ahora hay " + p.stock + " hechas.",
  );
}
/** Vendió una, sin armar pedido: queda registrada al toque. */
function ventaRapida(p) {
  if (num(p.stock) <= 0) {
    toast("No hay ninguna hecha. Tocá + cuando la imprimas.");
    return;
  }
  const r = calc(p);
  const canal = D.canais[0] || { id: "" };
  D.vendas.unshift({
    id: uid(),
    data: hoy(),
    cliente: "Venta rápida",
    canal: canal.id,
    itens: [{ id: p.id, nome: p.nome, qtd: 1, preco: r.preco, custo: r.custo }],
    desconto: 0,
    envio: 0,
    comision: 0,
    total: r.preco,
    custo: r.custo,
    lucro: r.preco - r.custo,
    pago: true,
    entregue: true,
    consumo: null,
    desdeStock: true,
    stockUsado: { [p.id]: 1 },
  });
  p.stock = num(p.stock) - 1;
  save();
  renderAll();
  toast("Vendida: " + money(r.preco) + ". Quedan " + p.stock + ".");
}
export const filName = (id) => {
  const f = D.filamentos.find((x) => x.id === id);
  if (!f) return "—";
  // el número va adelante: es lo que está escrito en el rollo de verdad
  return (
    (num(f.num) ? num(f.num) + " · " : "") +
    (f.marca ? f.marca + " " : "") +
    f.nome +
    (f.cor ? " · " + f.cor : "")
  );
};
