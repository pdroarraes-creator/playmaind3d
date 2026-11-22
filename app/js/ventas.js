import { $, el, num, money, pct, hoy, fechaCorta } from "./util.js";
import { D } from "./estado.js";
import { toast, showTab, renderAll } from "./ui.js";
import { calc, prod } from "./calculo.js";
import { consumoDe, aplicarConsumo, alertasStock } from "./stock.js";
import { thumb } from "./fotos.js";
import { save } from "./nube.js";

/* ---------- ventas ---------- */
/** Devuelve al inventario todo lo que esta venta había sacado. */
function revertirVenta(v) {
  for (const id in v.stockUsado || {}) {
    const p = prod(id);
    if (p) p.stock = num(p.stock) + num(v.stockUsado[id]);
  }
  aplicarConsumo(v.consumo, 1);
}
/** Vuelve a descontar del inventario, respetando cómo se hizo la venta:
    las de mostrador salen de lo que ya está hecho; las de pedido se imprimen. */
export function aplicarVenta(v) {
  const faltantes = [],
    usado = {};
  (v.itens || []).forEach((i) => {
    const p = prod(i.id);
    if (!p) return;
    const q = num(i.qtd);
    const hay = v.desdeStock ? Math.min(num(p.stock), q) : 0;
    if (hay > 0) {
      p.stock = num(p.stock) - hay;
      usado[p.id] = num(usado[p.id]) + hay;
    }
    if (q - hay > 0) faltantes.push({ p, q: q - hay });
  });
  v.stockUsado = usado;
  if (faltantes.length) {
    v.consumo = consumoDe(faltantes);
    aplicarConsumo(v.consumo, -1);
    // "fuera de stock" sólo tiene sentido en las de mostrador: la de pedido siempre se imprime
    v.sinStock = v.desdeStock ? faltantes.map((f) => f.q + "x " + f.p.nome).join(", ") : "";
  } else {
    v.consumo = null;
    v.sinStock = "";
  }
}
/** Rehace las cuentas con los precios que tenía la venta, no con los de hoy. */
function recalcVenta(v) {
  let bruto = 0,
    custo = 0;
  (v.itens || []).forEach((i) => {
    bruto += num(i.preco) * num(i.qtd);
    custo += num(i.custo) * num(i.qtd);
  });
  const envio = num(v.envio),
    com = num(v.comision);
  v.total = bruto * (1 - Math.min(num(v.desconto), 0.9)) + envio;
  v.custo = custo;
  v.lucro = (v.total - envio) * (1 - com) - custo;
}
/** Las ventas viejas no anotaban qué salió de lo ya hecho: se deduce del registro. */
export function migrarStockVentas() {
  (D.vendas || []).forEach((v) => {
    if (v.stockUsado) return;
    v.stockUsado = {};
    if (v.consumo == null) {
      // mostrador o venta rápida: no se gastó material, salió todo de lo hecho
      v.desdeStock = true;
      (v.itens || []).forEach((i) => {
        if (i.id) v.stockUsado[i.id] = num(v.stockUsado[i.id]) + num(i.qtd);
      });
    } else if (v.sinStock) {
      // mostrador mezclado: sinStock dice qué hubo que imprimir, el resto estaba hecho
      v.desdeStock = true;
      const falta = {};
      String(v.sinStock)
        .split(",")
        .forEach((t) => {
          const m = t.trim().match(/^(\d+)x\s+(.*)$/);
          if (m) falta[m[2].trim()] = num(m[1]);
        });
      (v.itens || []).forEach((i) => {
        const resto = num(i.qtd) - num(falta[String(i.nome || "").trim()]);
        if (i.id && resto > 0) v.stockUsado[i.id] = num(v.stockUsado[i.id]) + resto;
      });
    } else {
      // pedido: se imprimió a propósito, no se tocó lo que había hecho
      v.desdeStock = false;
    }
  });
}
export function renderVen() {
  const mes = hoy().slice(0, 7);
  const delMes = D.vendas.filter((v) => (v.data || "").slice(0, 7) === mes);
  let fat = 0,
    luc = 0,
    qtd = 0,
    pend = 0,
    efe = 0,
    tra = 0;
  delMes.forEach((v) => {
    fat += num(v.total);
    luc += num(v.lucro);
    (v.itens || []).forEach((i) => (qtd += num(i.qtd)));
    if (v.forma === "transferencia") tra += num(v.total);
    else if (v.forma === "efectivo") efe += num(v.total);
  });
  D.vendas.forEach((v) => {
    if (!v.pago) pend += num(v.total);
  });
  $("#v_fat").textContent = money(fat);
  $("#v_sub").textContent =
    delMes.length +
    " ventas este mes" +
    (efe || tra ? " · efectivo " + money(efe) + " · transferencia " + money(tra) : "") +
    " · " +
    D.vendas.length +
    " en total";
  $("#v_lucro").textContent = money(luc);
  $("#v_qtd").textContent = qtd;
  $("#v_pend").textContent = money(pend);

  let stockVal = 0,
    stockCusto = 0;
  D.produtos.forEach((p) => {
    const q = num(p.stock);
    if (q > 0) {
      const c = calc(p);
      stockVal += c.preco * q;
      stockCusto += c.custo * q;
    }
  });
  $("#v_stockVal").textContent = money(stockVal);
  $("#v_stockCusto").textContent = money(stockCusto);

  const acc = {};
  D.vendas.forEach((v) =>
    (v.itens || []).forEach((i) => {
      const k = i.id || i.nome;
      acc[k] = acc[k] || { nome: i.nome, q: 0, f: 0 };
      acc[k].q += num(i.qtd);
      acc[k].f += num(i.preco) * num(i.qtd);
    }),
  );
  const top = Object.entries(acc)
    .map(([k, v]) => ({ k, ...v }))
    .sort((a, b) => b.q - a.q)
    .slice(0, 6);
  const tb = $("#topList");
  tb.textContent = "";
  if (!top.length)
    tb.appendChild(
      el("div", { class: "empty" }, "Cuando registres ventas, acá vas a ver qué se vende más."),
    );
  top.forEach((t) =>
    tb.appendChild(
      el(
        "div",
        { class: "item" },
        thumb(prod(t.k)),
        el("div", { class: "info" }, el("b", {}, t.nome), el("span", {}, t.q + " vendidas")),
        el("div", { class: "val" }, el("b", {}, money(t.f))),
      ),
    ),
  );

  const lb = $("#venList");
  lb.textContent = "";
  if (!D.vendas.length)
    lb.appendChild(el("div", { class: "empty" }, "Todavía no registraste ninguna venta."));
  D.vendas.slice(0, 40).forEach((v) => {
    const canal = (D.canais.find((c) => c.id === v.canal) || {}).nome || "";
    lb.appendChild(
      el(
        "div",
        { class: "item sinFoto", style: "cursor:pointer", onclick: () => abrirVenta(v) },
        el(
          "div",
          { class: "info" },
          el("b", {}, v.cliente),
          el(
            "span",
            {},
            fechaCorta(v.data) +
              (v.forma ? " · " + v.forma : "") +
              " · " +
              (v.itens || []).reduce((a, i) => a + num(i.qtd), 0) +
              " piezas" +
              (num(v.desconto) > 0 ? " · " + pct(num(v.desconto)) + " off" : ""),
          ),
          v.sinStock
            ? el(
                "i",
                { class: "pill y", style: "font-style:normal;margin-top:4px;display:inline-block" },
                "fuera de stock",
              )
            : null,
        ),
        el(
          "div",
          { class: "val" },
          el("b", {}, money(v.total)),
          v.pago
            ? el("i", { class: "pill g", style: "font-style:normal" }, "cobrada")
            : el("i", { class: "pill y", style: "font-style:normal" }, "a cobrar"),
        ),
      ),
    );
  });
}
function abrirVenta(v) {
  const b = $("#sheetBody");
  b.textContent = "";
  b.appendChild(el("h2", {}, v.cliente));
  b.appendChild(
    el(
      "p",
      { class: "mut" },
      v.data + (v.forma ? " · " + v.forma : "") + " · ganancia " + money(v.lucro),
    ),
  );
  if (v.sinStock)
    b.appendChild(
      el(
        "p",
        { class: "mut", style: "color:#8A5320" },
        "Se vendió sin tenerla hecha: " + v.sinStock + ". Se descontó el material.",
      ),
    );
  const ul = el("div", { style: "margin:12px 0" });
  (v.itens || []).forEach((i) =>
    ul.appendChild(
      el(
        "div",
        { class: "item" },
        thumb(prod(i.id)),
        el(
          "div",
          { class: "info" },
          el("b", {}, i.nome),
          el("span", {}, i.qtd + " × " + money(i.preco)),
        ),
        el("div", { class: "val" }, el("b", {}, money(i.preco * i.qtd))),
      ),
    ),
  );
  b.appendChild(ul);
  b.appendChild(
    el(
      "div",
      { class: "acts" },
      el(
        "button",
        {
          class: "btn" + (v.pago ? " ghost" : ""),
          onclick: () => {
            v.pago = !v.pago;
            save();
            renderVen();
            cerrarSheet();
          },
        },
        v.pago ? "Marcar como no cobrada" : "Marcar cobrada",
      ),
      el(
        "button",
        {
          class: "btn ghost",
          onclick: () => {
            v.entregue = !v.entregue;
            save();
            renderVen();
            cerrarSheet();
          },
        },
        v.entregue ? "Marcar no entregada" : "Marcar entregada",
      ),
      el("button", { class: "btn ghost", onclick: () => editarVenta(v) }, "Editar"),
      el(
        "button",
        {
          class: "btn ghost",
          onclick: () => {
            repetir(v);
            cerrarSheet();
          },
        },
        "Repetir este pedido",
      ),
      el(
        "button",
        {
          class: "btn danger",
          onclick: () => {
            if (confirm("¿Borrar esta venta? Lo que había descontado del stock vuelve.")) {
              revertirVenta(v);
              D.vendas = D.vendas.filter((x) => x.id !== v.id);
              save();
              renderAll();
              cerrarSheet();
            }
          },
        },
        "Borrar",
      ),
    ),
  );
  b.appendChild(
    el(
      "button",
      { class: "btn ghost wide", style: "margin-top:12px", onclick: cerrarSheet },
      "Cerrar",
    ),
  );
  $("#sheet").classList.add("on");
}
/** Edita una venta ya registrada. Se trabaja sobre una copia: si cancela, no se toca nada. */
function editarVenta(v) {
  const b = $("#sheetBody");
  b.textContent = "";
  const bo = {
    cliente: v.cliente || "",
    data: v.data || hoy(),
    forma: v.forma || "",
    canal: v.canal || "",
    desconto: Math.round(num(v.desconto) * 100),
    envio: num(v.envio),
    itens: (v.itens || []).map((i) => Object.assign({}, i)),
  };
  b.appendChild(el("h2", {}, "Editar venta"));
  b.appendChild(
    el(
      "p",
      { class: "mut" },
      "Los precios quedan como estaban el día de la venta, aunque hoy valgan otra cosa.",
    ),
  );

  const totLinea = el("b", { style: "font-size:19px" });
  const pintarTotal = () => {
    let bruto = 0;
    bo.itens.forEach((i) => (bruto += num(i.preco) * num(i.qtd)));
    totLinea.textContent = money(
      bruto * (1 - Math.min(num(bo.desconto), 90) / 100) + num(bo.envio),
    );
  };
  const campo = (lab, inp) => el("div", {}, el("label", { class: "f" }, lab), inp);

  const iCli = el("input", {
    type: "text",
    value: bo.cliente,
    oninput: (e) => (bo.cliente = e.target.value),
  });
  const iFecha = el("input", {
    type: "date",
    value: bo.data,
    oninput: (e) => (bo.data = e.target.value),
  });
  const sForma = el("select", { onchange: (e) => (bo.forma = e.target.value) });
  const formas = ["efectivo", "transferencia"];
  if (bo.forma && formas.indexOf(bo.forma) === -1) formas.push(bo.forma);
  sForma.appendChild(el("option", { value: "" }, "Sin especificar"));
  formas.forEach((f) => sForma.appendChild(el("option", { value: f }, f)));
  sForma.value = bo.forma;
  const sCanal = el("select", { onchange: (e) => (bo.canal = e.target.value) });
  D.canais.forEach((c) => sCanal.appendChild(el("option", { value: c.id }, c.nome)));
  sCanal.value = bo.canal;
  b.appendChild(
    el(
      "div",
      { class: "grid" },
      campo("Cliente", iCli),
      campo("Fecha", iFecha),
      campo("Cómo pagó", sForma),
      campo("Canal", sCanal),
    ),
  );

  const lista = el("div", { style: "margin:12px 0" });
  const pintarItems = () => {
    lista.textContent = "";
    bo.itens.forEach((i) => {
      lista.appendChild(
        el(
          "div",
          { class: "item", style: num(i.qtd) > 0 ? "" : "opacity:.45" },
          thumb(prod(i.id)),
          el(
            "div",
            { class: "info" },
            el("b", {}, i.nome),
            el("span", {}, money(i.preco) + " c/u"),
          ),
          el(
            "div",
            { class: "qty" },
            el(
              "button",
              {
                onclick: () => {
                  i.qtd = Math.max(0, num(i.qtd) - 1);
                  pintarItems();
                  pintarTotal();
                },
              },
              "−",
            ),
            el("input", {
              type: "number",
              inputmode: "numeric",
              min: "0",
              value: i.qtd,
              oninput: (e) => {
                i.qtd = Math.max(0, num(e.target.value));
                pintarTotal();
              },
            }),
            el(
              "button",
              {
                onclick: () => {
                  i.qtd = num(i.qtd) + 1;
                  pintarItems();
                  pintarTotal();
                },
              },
              "+",
            ),
          ),
          el("div", { class: "val" }, el("b", {}, money(num(i.preco) * num(i.qtd)))),
        ),
      );
    });
  };
  pintarItems();
  b.appendChild(lista);
  b.appendChild(el("p", { class: "mut" }, "Poné una pieza en 0 para sacarla de la venta."));

  const iDesc = el("input", {
    type: "number",
    inputmode: "decimal",
    min: "0",
    max: "90",
    value: bo.desconto,
    oninput: (e) => {
      bo.desconto = num(e.target.value);
      pintarTotal();
    },
  });
  const iEnvio = el("input", {
    type: "number",
    inputmode: "decimal",
    min: "0",
    value: bo.envio,
    oninput: (e) => {
      bo.envio = num(e.target.value);
      pintarTotal();
    },
  });
  b.appendChild(
    el("div", { class: "grid" }, campo("Descuento (%)", iDesc), campo("Envío ($)", iEnvio)),
  );
  pintarTotal();
  b.appendChild(
    el(
      "p",
      { style: "margin:14px 0 0;display:flex;justify-content:space-between;align-items:center" },
      el("span", { class: "mut" }, "Total"),
      totLinea,
    ),
  );

  b.appendChild(
    el(
      "div",
      { class: "acts", style: "margin-top:14px" },
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            const quedan = bo.itens.filter((i) => num(i.qtd) > 0);
            if (!quedan.length) {
              toast("Así quedaría vacía. Si no va más, borrala.");
              return;
            }
            // se devuelve al inventario lo viejo y se descuenta lo nuevo
            revertirVenta(v);
            v.cliente = bo.cliente.trim() || "Sin nombre";
            v.data = bo.data || hoy();
            v.forma = bo.forma;
            v.canal = bo.canal;
            v.itens = quedan;
            v.desconto = Math.min(Math.max(num(bo.desconto), 0), 90) / 100;
            v.envio = num(bo.envio);
            const canal = D.canais.find((c) => c.id === bo.canal);
            v.comision = canal ? num(canal.comision) / 100 : 0;
            aplicarVenta(v);
            recalcVenta(v);
            // si le cambió la fecha, que no quede fuera de lugar en la lista
            D.vendas.sort((a, c) => String(c.data || "").localeCompare(String(a.data || "")));
            save();
            renderAll();
            cerrarSheet();
            const al = alertasStock();
            toast(al.length ? "Venta actualizada. " + al[0].txt : "Venta actualizada.");
          },
        },
        "Guardar cambios",
      ),
      el("button", { class: "btn ghost", onclick: () => abrirVenta(v) }, "Cancelar"),
    ),
  );
  $("#sheet").classList.add("on");
}
function repetir(v) {
  D.pedido = {};
  (v.itens || []).forEach((i) => {
    if (prod(i.id)) D.pedido[i.id] = num(i.qtd);
  });
  $("#p_cli").value = v.cliente;
  save();
  renderAll();
  showTab("ped");
  toast("Pedido cargado de nuevo.");
}
export function cerrarSheet() {
  $("#sheet").classList.remove("on");
}

export function iniciarVentas() {
  $("#sheet").addEventListener("click", (e) => {
    if (e.target.id === "sheet") cerrarSheet();
  });
}
