import { $, el, uid, num, money, pct, hoy } from "./util.js";
import { D } from "./estado.js";
import { toast, showTab, renderAll } from "./ui.js";
import { calc, prod } from "./calculo.js";
import { save } from "./nube.js";
import { MODO_VENTA } from "./radar.js";
import { aplicarVenta } from "./ventas.js";

/* ---------- punto de venta ---------- */
var POS = {},
  POS_FORMA = "efectivo";

/** Cuántas se vendieron de cada pieza, para poner arriba las que más salen. */
function masVendidas() {
  const c = {};
  (D.vendas || []).forEach((v) =>
    (v.itens || []).forEach((i) => {
      if (i.id) c[i.id] = num(c[i.id]) + num(i.qtd);
    }),
  );
  return c;
}

export function abrirPOS() {
  POS = {};
  POS_FORMA = "efectivo";
  $("#posCliente").value = "";
  $("#posRecibido").value = "";
  $("#posQ").value = "";
  document
    .querySelectorAll("#posFormas button")
    .forEach((b) => b.classList.toggle("on", b.dataset.forma === "efectivo"));
  pintarBotonCobrar();
  pintarPOS();
  $("#pos").hidden = false;
}
/** Con fiado no se está cobrando nada: el botón no puede decir "Cobré". */
export function pintarBotonCobrar() {
  $("#posCobrar").textContent = POS_FORMA === "fiado" ? "Se la llevó fiada" : "Cobré";
}
export function salirModoVenta() {
  try {
    localStorage.removeItem("pm3d_modo");
  } catch (e) {}
  location.href = "/app/?modo=todo";
}
export function cerrarPOS() {
  $("#pos").hidden = true;
  if (MODO_VENTA) showTab("ven");
}

export function pintarPOS() {
  const g = $("#posGrid");
  g.textContent = "";
  const q = ($("#posQ").value || "").toLowerCase().trim();
  if (!D.produtos.length) {
    g.appendChild(
      el(
        "div",
        { class: "empty", style: "grid-column:1/-1" },
        "Primero cargá piezas en el catálogo.",
      ),
    );
    return;
  }
  // primero las elegidas, después las que hay hechas, y entre ésas las que más salen:
  // en la feria las campeonas tienen que quedar arriba, sin scrollear
  const vendidas = masVendidas();
  const lista = D.produtos
    .filter(
      (p) =>
        !q || (p.nome || "").toLowerCase().includes(q) || (p.cat || "").toLowerCase().includes(q),
    )
    .sort(
      (a, b) =>
        (num(POS[b.id]) > 0 ? 1 : 0) - (num(POS[a.id]) > 0 ? 1 : 0) ||
        (num(b.stock) > 0 ? 1 : 0) - (num(a.stock) > 0 ? 1 : 0) ||
        num(vendidas[b.id]) - num(vendidas[a.id]),
    );
  if (!lista.length) {
    g.appendChild(
      el("div", { class: "empty", style: "grid-column:1/-1" }, "Ninguna pieza con ese nombre."),
    );
    totalPOS();
    return;
  }
  lista.forEach((p) => {
    const r = calc(p),
      n = num(POS[p.id]);
    const t = el("button", {
      class: "postile" + (n > 0 ? " on" : ""),
      type: "button",
      onclick: () => {
        POS[p.id] = num(POS[p.id]) + 1;
        pintarPOS();
      },
    });
    const im = el("div", { class: "im" });
    const src = (p.fotos && p.fotos.length ? p.fotos[0] : p.foto) || "";
    if (src) {
      const img = el("img", { src: src, alt: "", loading: "lazy" });
      img.addEventListener("error", () => {
        im.textContent = "🧩";
      });
      im.appendChild(img);
    } else im.textContent = "🧩";
    const hay = num(p.stock);
    if (hay > 0) im.appendChild(el("span", { class: "stockBadge" }, String(hay)));
    t.appendChild(im);
    t.appendChild(el("b", {}, p.nome || "Sin nombre"));
    t.appendChild(el("u", {}, money(r.preco)));
    t.appendChild(
      el(
        "i",
        { class: "st" + (hay > 0 ? " hay" : "") },
        hay > 0 ? hay + " hecha" + (hay > 1 ? "s" : "") : "a pedido",
      ),
    );
    if (n > 0) {
      t.appendChild(el("span", { class: "n" }, String(n)));
      t.appendChild(
        el(
          "span",
          {
            class: "menos",
            onclick: (ev) => {
              ev.stopPropagation();
              quitarPOS(p.id);
            },
          },
          "−",
        ),
      );
    }
    g.appendChild(t);
  });
  totalPOS();
}
function quitarPOS(id) {
  POS[id] = Math.max(0, num(POS[id]) - 1);
  if (!POS[id]) delete POS[id];
  pintarPOS();
}
/** Lo que se cobra de verdad. Si se escribió un monto en "¿Cobraste otro
    monto?", ese manda y la diferencia se guarda sola:
      cobró menos  -> descuento
      cobró de más -> envío, que es el campo que ya existe para lo que se
                      suma arriba del precio de lista
    El descuento topea en 90% porque es el mismo tope que ya tenía la
    pantalla de editar venta: guardar algo afuera de ese rango hacía que el
    total se moviera solo al reabrirla. Cuando topea se avisa en pantalla,
    así el número que se va a guardar está a la vista antes de confirmar. */
function cobradoPOS(bruto) {
  const escrito = num(($("#posRecibido") && $("#posRecibido").value) || 0);
  if (!(escrito > 0) || !(bruto > 0)) return { total: bruto, desconto: 0, envio: 0, topo: false };
  if (escrito >= bruto) return { total: escrito, desconto: 0, envio: escrito - bruto, topo: false };
  const crudo = 1 - escrito / bruto;
  const desconto = Math.min(crudo, 0.9);
  return { total: bruto * (1 - desconto), desconto: desconto, envio: 0, topo: crudo > 0.9 };
}

export function totalPOS() {
  let n = 0,
    t = 0;
  for (const id in POS) {
    const p = prod(id);
    if (!p) continue;
    n += POS[id];
    t += calc(p).preco * POS[id];
  }
  const c = cobradoPOS(t);
  $("#posCant").textContent = n ? n + (n === 1 ? " pieza" : " piezas") : "Elegí las piezas";
  $("#posTotal").textContent = "";
  $("#posTotal").appendChild(document.createTextNode(money(c.total)));
  if (c.topo) {
    $("#posTotal").appendChild(
      el("span", { class: "desc" }, "el descuento llega hasta 90%: se guarda " + money(c.total)),
    );
  } else if (c.desconto > 0) {
    $("#posTotal").appendChild(
      el("span", { class: "desc" }, "antes " + money(t) + " · " + pct(c.desconto) + " off"),
    );
  } else if (c.envio > 0) {
    $("#posTotal").appendChild(
      el("span", { class: "desc" }, "lista " + money(t) + " + " + money(c.envio)),
    );
  }
  return { n, t, total: c.total, desconto: c.desconto, envio: c.envio };
}
export function cobrar() {
  const { n, t, total, desconto, envio } = totalPOS();
  if (!n) {
    toast("Elegí al menos una pieza.");
    return;
  }
  const fiado = POS_FORMA === "fiado";
  if (fiado && !$("#posCliente").value.trim()) {
    toast("Poné de quién es: fiado sin nombre no se cobra nunca.");
    $("#posCliente").focus();
    return;
  }
  const itens = [];
  for (const id in POS) {
    const p = prod(id);
    if (!p) continue;
    const r = calc(p);
    itens.push({ id: p.id, nome: p.nome, qtd: POS[id], preco: r.preco, custo: r.custo });
  }
  const costo = itens.reduce((a, i) => a + i.custo * i.qtd, 0);
  const canal = D.canais[0] || { id: "" };
  const v = {
    id: uid(),
    data: hoy(),
    cliente: $("#posCliente").value.trim() || "Sin nombre",
    canal: canal.id,
    forma: POS_FORMA,
    itens: itens,
    desconto: desconto,
    envio: envio,
    comision: 0,
    total: total,
    custo: costo,
    lucro: total - costo,
    // fiado = se la llevó y todavía no pagó: queda sumando en "Por cobrar"
    pago: !fiado,
    entregue: true,
    consumo: null,
    desdeStock: true,
    stockUsado: {},
  };

  // si había piezas hechas, se descuentan; si no, se descuenta el material
  aplicarVenta(v);

  D.vendas.unshift(v);
  save();
  renderAll();
  cerrarPOS();
  toast(
    fiado
      ? "Fiado " + money(total) + " a " + v.cliente + ". Queda en «Por cobrar»."
      : v.sinStock
        ? "Venta de " + money(total) + ". Anotada como fuera de stock."
        : "Venta de " + money(total) + " registrada.",
  );
}

export function setPosForma(v) {
  POS_FORMA = v;
}
