"use strict";
import { $, el, uid, num, money, pct, ceilTo, hoy } from "./util.js";
import { D } from "./estado.js";
import { toast, renderAll, renderLight } from "./ui.js";
import { calc, unitario, proximoNumFil } from "./calculo.js";
import { pintarMarca } from "./fotos.js";
import { fillSel } from "./editor.js";
import { save } from "./main.js";

/* ---------- ajustes ---------- */
var CFG_ATADO = false;
export function bindCfg() {
  const map = {
    s_kwh: "kwh",
    s_mo: "maoObra",
    s_risk: "risco",
    s_mult: "mult",
    s_round: "round",
    s_merma: "merma",
  };

  // 1) mostrar siempre lo que hay ahora (después de traer de la nube, también)
  for (const id in map) $("#" + id).value = D.cfg[map[id]];
  $("#s_marca").value = D.cfg.marca || "";
  $("#s_wa").value = D.cfg.wa || "";
  $("#s_presupDias").value = D.cfg.presupDias || 7;
  $("#s_cat").value = D.cfg.catalogo || "";
  $("#s_letiCita").value = D.cfg.leti.cita || "";
  $("#s_letiHistoria").value = D.cfg.leti.historia || "";
  const q = $("#quienSoy");
  if (q)
    q.textContent = D.cfg.email
      ? "Estás dentro como " + D.cfg.email
      : "Estás dentro con la clave del sistema.";

  // 2) los oyentes se atan una sola vez: si no, cada campo terminaba con varios
  if (CFG_ATADO) return;
  CFG_ATADO = true;
  for (const id in map) {
    const i = $("#" + id),
      k = map[id];
    i.addEventListener("input", () => {
      D.cfg[k] = num(i.value);
      $("#c_risk").placeholder = D.cfg.risco;
      $("#c_mult").placeholder = D.cfg.mult;
      save();
      renderLight();
    });
  }
  $("#s_marca").addEventListener("input", () => {
    D.cfg.marca = $("#s_marca").value;
    save();
    pintarMarca();
  });
  $("#s_wa").addEventListener("input", () => {
    D.cfg.wa = $("#s_wa").value;
    save();
  });
  $("#s_presupDias").addEventListener("input", () => {
    D.cfg.presupDias = Math.max(1, num($("#s_presupDias").value));
    save();
  });
  $("#s_cat").addEventListener("input", () => {
    D.cfg.catalogo = $("#s_cat").value.trim();
    save();
  });
  $("#s_letiCita").addEventListener("input", () => {
    D.cfg.leti.cita = $("#s_letiCita").value;
    save();
  });
  $("#s_letiHistoria").addEventListener("input", () => {
    D.cfg.leti.historia = $("#s_letiHistoria").value;
    save();
  });
}
function fieldRow(obj, campos, onDel, nota, acciones, resumen) {
  if (resumen) return fieldCard(obj, campos, onDel, nota, acciones, resumen);
  return fieldPlain(obj, campos, onDel, nota, acciones);
}
/** Ficha plegada: se ve una línea; se abre al tocarla. */
function fieldCard(obj, campos, onDel, nota, acciones, resumen) {
  const d = el("details", { class: "ficha" });
  const sum = el("summary", {});
  const pintar = () => {
    sum.textContent = "";
    resumen(sum);
  };
  pintar();
  d.appendChild(sum);
  d.appendChild(fieldPlain(obj, campos, onDel, nota, acciones, pintar));
  return d;
}
function fieldPlain(obj, campos, onDel, nota, acciones, alCambiar) {
  const w = el("div", {
    style: "border:1.5px solid var(--line);border-radius:12px;padding:12px;margin-bottom:9px",
  });
  const g = el("div", { class: "grid" });
  const notaEl = nota ? el("p", { class: "mut", style: "margin:9px 0 0" }, nota()) : null;
  campos.forEach(([k, lab, tipo, suf]) => {
    const d = el("div", { class: suf ? "suffix" : "" }, el("label", { class: "f" }, lab));
    const i = el("input", {
      type: tipo,
      value: obj[k] !== undefined && obj[k] !== null ? obj[k] : tipo === "color" ? "#CFC3AE" : "",
      inputmode: tipo === "number" ? "decimal" : null,
      min: tipo === "number" ? "0" : null,
      step: tipo === "number" ? "1" : null,
      oninput: (e) => {
        obj[k] = tipo === "number" ? num(e.target.value) : e.target.value;
        if (notaEl) notaEl.textContent = nota();
        if (alCambiar) alCambiar();
        save();
        renderLight();
      },
    });
    d.appendChild(i);
    if (suf) d.appendChild(el("em", {}, suf));
    g.appendChild(d);
  });
  w.appendChild(g);
  if (notaEl) w.appendChild(notaEl);
  const barra = el("div", { class: "acts", style: "margin-top:9px" });
  (acciones || []).forEach(([lab, fn]) =>
    barra.appendChild(
      el(
        "button",
        {
          class: "btn ghost mini",
          onclick: () => {
            fn();
            if (alCambiar) alCambiar();
            if (notaEl) notaEl.textContent = nota();
          },
        },
        lab,
      ),
    ),
  );
  if (onDel)
    barra.appendChild(el("button", { class: "btn danger mini", onclick: onDel }, "Quitar"));
  if (barra.childNodes.length) w.appendChild(barra);
  return w;
}
export function renderAccesos() {
  const box = $("#accesos");
  if (!box) return;
  const base = location.origin && location.origin !== "null" ? location.origin : "";
  const items = [
    { c: "var(--clay)", n: "Catálogo", d: "El que se manda a los clientes", u: base + "/" },
    { c: "var(--leaf)", n: "Vender", d: "Punto de venta, dos toques", u: base + "/vender" },
    {
      c: "var(--deep)",
      n: "Sistema completo",
      d: "Costos, precios, stock, radar",
      u: base + "/app/",
    },
  ];
  box.textContent = "";
  items.forEach((i) => {
    box.appendChild(
      el(
        "div",
        { class: "item" },
        el("div", {
          class: "thumb",
          style: "background:" + i.c + ";width:12px;height:44px;border-radius:6px;flex:none",
        }),
        el(
          "div",
          { class: "info" },
          el("b", {}, i.n),
          el("span", {}, i.d),
          el(
            "span",
            {
              style:
                "display:block;margin-top:3px;word-break:break-all;color:var(--deep);font-weight:700",
            },
            i.u,
          ),
        ),
        el(
          "div",
          { class: "ctrl", style: "justify-content:flex-start" },
          el("button", { class: "btn ghost mini", onclick: () => copy(i.u) }, "Copiar"),
          el(
            "button",
            { class: "btn ghost mini", onclick: () => window.open(i.u, "_blank", "noopener") },
            "Abrir",
          ),
        ),
      ),
    );
  });
}
export function renderCfgLists() {
  const qf = (($("#qFil") && $("#qFil").value) || "").toLowerCase();
  const qi = (($("#qIns") && $("#qIns").value) || "").toLowerCase();

  const fb = $("#filList");
  fb.textContent = "";
  const fils = D.filamentos.filter(
    (f) =>
      !qf ||
      ((f.marca || "") + " " + (f.nome || "") + " " + (f.cor || "")).toLowerCase().includes(qf),
  );
  if (!fils.length)
    fb.appendChild(el("div", { class: "empty" }, "Ningún filamento con ese nombre."));
  fils.forEach((f) =>
    fb.appendChild(
      fieldRow(
        f,
        [
          ["num", "N° del rollo", "number"],
          ["marca", "Marca", "text"],
          ["nome", "Tipo", "text"],
          ["cor", "Color", "text"],
          ["hex", "Color en pantalla", "color"],
          ["precoKg", "Precio", "number", "$/kg"],
          ["rollo", "Rollo entero", "number", "g"],
          ["stock", "Queda", "number", "g"],
        ],
        D.filamentos.length > 1
          ? () => {
              // Las piezas guardan el id del filamento. Si se borra uno en uso,
              // esas piezas quedan apuntando al vacío y el precio pasa a
              // calcularse con el primero de la lista, sin que se note.
              const usan = D.produtos.filter((p) => p.fil === f.id);
              const aviso = usan.length
                ? "Lo están usando " + usan.length + " pieza(s): " +
                  usan.slice(0, 3).map((p) => p.nome).join(", ") +
                  (usan.length > 3 ? "…" : "") +
                  ". Si lo sacás, se les calcula el precio con otro filamento.\n\n¿Quitar igual?"
                : "¿Quitar este filamento?";
              if (!confirm(aviso)) return;
              D.filamentos = D.filamentos.filter((x) => x.id !== f.id);
              save();
              renderAll();
            }
          : null,
        () => {
          const g = num(f.stock),
            r = Math.max(num(f.rollo), 1);
          return (
            "Queda " +
            Math.round(g) +
            " g, " +
            pct(Math.max(g, 0) / r) +
            " del rollo. Alcanza para " +
            Math.floor(Math.max(g, 0) / 40) +
            " piezas de 40 g."
          );
        },
        [
          [
            "+ Rollo nuevo",
            () => {
              f.stock = num(f.stock) + num(f.rollo || 1000);
              save();
              renderAll();
              toast("Rollo cargado.");
            },
          ],
        ],
        (sum) => {
          const g = num(f.stock),
            r = Math.max(num(f.rollo), 1),
            bajo = g / r < 0.15;
          sum.appendChild(
            el("i", { class: "swatch", style: "background:" + (f.hex || "#CFC3AE") }),
          );
          sum.appendChild(
            el(
              "b",
              {},
              (
                (num(f.num) ? num(f.num) + " · " : "") +
                (f.marca ? f.marca + " " : "") +
                (f.nome || "") +
                (f.cor ? " · " + f.cor : "")
              ).trim() || "Sin nombre",
            ),
          );
          sum.appendChild(
            el("span", { class: "det" + (bajo ? " bajo" : "") }, Math.round(g) + " g"),
          );
        },
      ),
    ),
  );

  const ib = $("#impList");
  ib.textContent = "";
  D.impressoras.forEach((i) => {
    const dep = () =>
      num(i.preco) / Math.max(num(i.vida), 1) +
      num(i.bico) / Math.max(num(i.bicoVida), 1) +
      num(i.mesa) / Math.max(num(i.mesaVida), 1);
    ib.appendChild(
      fieldRow(
        i,
        [
          ["nome", "Impresora", "text"],
          ["preco", "Precio", "number", "$"],
          ["vida", "Vida útil", "number", "h"],
          ["watts", "Consumo", "number", "W"],
          ["bico", "Boquilla", "number", "$"],
          ["bicoVida", "Vida boquilla", "number", "h"],
          ["mesa", "Placa", "number", "$"],
          ["mesaVida", "Vida placa", "number", "h"],
        ],
        D.impressoras.length > 1
          ? () => {
              // no tenía confirmación: un toque de más y se borraba sola
              const usan = D.produtos.filter((p) => p.imp === i.id);
              const aviso = usan.length
                ? "La están usando " + usan.length + " pieza(s): " +
                  usan.slice(0, 3).map((p) => p.nome).join(", ") +
                  (usan.length > 3 ? "…" : "") +
                  ". Si la sacás, se les calcula el precio con otra impresora.\n\n¿Quitar igual?"
                : "¿Quitar esta impresora?";
              if (!confirm(aviso)) return;
              D.impressoras = D.impressoras.filter((x) => x.id !== i.id);
              save();
              renderAll();
            }
          : null,
        () => "Se gasta " + money(dep()) + " por hora de impresión.",
        null,
        (sum) => {
          sum.appendChild(el("b", {}, i.nome || "Impresora"));
          sum.appendChild(el("span", { class: "det" }, money(dep()) + "/h"));
        },
      ),
    );
  });

  const nb = $("#insList");
  nb.textContent = "";
  const inss = D.insumos.filter((n) => !qi || (n.nome || "").toLowerCase().includes(qi));
  if (!inss.length) nb.appendChild(el("div", { class: "empty" }, "Ningún insumo con ese nombre."));
  inss.forEach((n) =>
    nb.appendChild(
      fieldRow(
        n,
        [
          ["nome", "Insumo", "text"],
          ["pack", "Precio del paquete", "number", "$"],
          ["unid", "Vienen", "number", "un"],
          ["stock", "Quedan", "number", "un"],
        ],
        () => {
          if (!confirm("¿Quitar “" + n.nome + "”? Se saca de todas las piezas que lo usan."))
            return;
          D.insumos = D.insumos.filter((x) => x.id !== n.id);
          D.produtos.forEach((p) => {
            if (p.insumos) delete p.insumos[n.id];
          });
          save();
          renderAll();
        },
        () =>
          "Cada unidad te sale " +
          money(unitario(n)) +
          ". Quedan " +
          Math.round(num(n.stock)) +
          ".",
        [
          [
            "+ Paquete nuevo",
            () => {
              n.stock = num(n.stock) + num(n.unid || 1);
              save();
              renderAll();
              toast("Paquete cargado.");
            },
          ],
        ],
        (sum) => {
          const u = num(n.stock),
            p = Math.max(num(n.unid), 1),
            bajo = u / p < 0.15;
          sum.appendChild(el("b", {}, n.nome || "Insumo"));
          sum.appendChild(
            el(
              "span",
              { class: "det" + (bajo ? " bajo" : "") },
              money(unitario(n)) + " · " + Math.round(u) + " un",
            ),
          );
        },
      ),
    ),
  );

  const pb = $("#packList");
  pb.textContent = "";
  if (!D.packs.length) pb.appendChild(el("div", { class: "empty" }, "Ningún pack todavía."));
  D.packs.forEach((k) =>
    pb.appendChild(
      fieldRow(
        k,
        [
          ["nome", "Cómo se llama", "text"],
          ["off", "Descuento", "number", "%"],
          ["desde", "A partir de", "number", "un"],
          ["piezas", "Sólo estas piezas (opcional)", "text"],
          ["qtd", "Cuántas piezas (precio fijo)", "number", "un"],
          ["preco", "Precio fijo", "number", "$"],
          ["incluye", "Qué entra", "text"],
          ["desc", "Frase para el cliente", "text"],
        ],
        () => {
          if (!confirm("¿Quitar este pack?")) return;
          D.packs = D.packs.filter((x) => x.id !== k.id);
          save();
          renderAll();
        },
        () => {
          if (num(k.off) > 0) {
            const d = Math.max(num(k.desde), 2);
            const sobre = (k.piezas || "").trim()
              ? "sólo sobre: " + k.piezas
              : "sobre todo lo que lleve";
            return (
              "Llevando " +
              d +
              " o más, se le descuenta " +
              num(k.off) +
              "% " +
              sobre +
              ". Se aplica solo en el carrito."
            );
          }
          const q = Math.max(num(k.qtd), 1),
            sueltas = num(k.sueltas);
          if (sueltas > 0) {
            const ahorro = sueltas - num(k.preco);
            return (
              "Pack de precio fijo. Sueltas saldrían " +
              money(sueltas) +
              ": el cliente ahorra " +
              money(ahorro) +
              " (" +
              pct(ahorro / sueltas) +
              ") y vos cobrás " +
              money(num(k.preco) / q) +
              " por pieza."
            );
          }
          return "Poné un % de descuento arriba, o un precio fijo abajo. Una de las dos cosas.";
        },
        [
          [
            "Calcular sueltas",
            () => {
              const q = Math.max(num(k.qtd), 1);
              const precios = D.produtos.map((p) => calc(p).preco).sort((a, b) => a - b);
              if (!precios.length) {
                toast("Cargá piezas primero.");
                return;
              }
              const baratas = precios.slice(0, q);
              k.sueltas = baratas.reduce((a, b) => a + b, 0);
              if (!num(k.preco)) k.preco = ceilTo(k.sueltas * 0.8, num(D.cfg.round) || 1);
              save();
              renderAll();
            },
          ],
        ],
      ),
    ),
  );

  const ob = $("#opiList");
  ob.textContent = "";
  if (!D.opiniones.length)
    ob.appendChild(el("div", { class: "empty" }, "Todavía no cargaste ninguno."));
  D.opiniones.forEach((o) => {
    const w = el("div", {
      style: "border:1.5px solid var(--line);border-radius:14px;padding:13px;margin-bottom:9px",
    });
    const g = el("div", { class: "g2" });
    [
      ["quien", "Quién lo dijo", "text"],
      ["pieza", "Sobre qué pieza", "text"],
    ].forEach(([k, lab]) => {
      const d = el("div", {}, el("label", { class: "f" }, lab));
      const i = el("input", {
        type: "text",
        value: o[k] || "",
        oninput: (e) => {
          o[k] = e.target.value;
          save();
        },
      });
      d.appendChild(i);
      g.appendChild(d);
    });
    w.appendChild(g);
    w.appendChild(el("label", { class: "f", style: "margin-top:10px" }, "Qué dijo"));
    const t = el("textarea", { rows: "2", maxlength: "220" });
    t.value = o.texto || "";
    t.addEventListener("input", () => {
      o.texto = t.value;
      save();
    });
    w.appendChild(t);
    w.appendChild(
      el(
        "div",
        { class: "acts", style: "margin-top:10px" },
        el(
          "label",
          { class: "chk" },
          (() => {
            const c = el("input", { type: "checkbox" });
            c.checked = o.visible !== false;
            c.addEventListener("change", () => {
              o.visible = c.checked;
              save();
              renderCfgLists();
            });
            return c;
          })(),
          "Se ve en el catálogo",
        ),
        el(
          "button",
          {
            class: "btn danger mini",
            onclick: () => {
              if (!confirm("¿Borrar este comentario?")) return;
              D.opiniones = D.opiniones.filter((x) => x.id !== o.id);
              save();
              renderAll();
            },
          },
          "Borrar",
        ),
      ),
    );
    ob.appendChild(w);
  });

  const cb = $("#canList");
  cb.textContent = "";
  D.canais.forEach((c) =>
    cb.appendChild(
      fieldRow(
        c,
        [
          ["nome", "Canal", "text"],
          ["comision", "Comisión", "number", "%"],
        ],
        D.canais.length > 1
          ? () => {
              D.canais = D.canais.filter((x) => x.id !== c.id);
              save();
              renderAll();
            }
          : null,
        null,
        null,
        (sum) => {
          sum.appendChild(el("b", {}, c.nome || "Canal"));
          sum.appendChild(
            el("span", { class: "det" }, num(c.comision) ? num(c.comision) + "%" : "sin comisión"),
          );
        },
      ),
    ),
  );

  fillSel($("#p_canal"), D.canais, $("#p_canal").value || D.canais[0].id);
}
export const addFil = () => {
  const n = proximoNumFil();
  D.filamentos.push({
    id: uid(),
    num: n,
    marca: "",
    nome: "PLA",
    cor: "",
    hex: "#CFC3AE",
    precoKg: 25000,
    rollo: 1000,
    stock: 1000,
  });
  save();
  renderAll();
  toast("Filamento " + n + ". Escribí ese número en el rollo.");
};
export const addIns = () => {
  D.insumos.push({ id: uid(), nome: "Insumo nuevo", pack: 1000, unid: 10, stock: 10 });
  save();
  renderAll();
};
export const addOpi = () => {
  D.opiniones.push({ id: uid(), quien: "", pieza: "", texto: "", visible: true, fecha: hoy() });
  save();
  renderAll();
};
export const addPack = () => {
  D.packs.push({
    id: uid(),
    nome: "Llevando 3 o más",
    off: 15,
    desde: 3,
    piezas: "",
    qtd: 0,
    preco: 0,
    sueltas: 0,
    incluye: "",
    desc: "Llevá 3 o más y te hacemos 15% de descuento.",
  });
  save();
  renderAll();
};
export const addCanal = () => {
  D.canais.push({ id: uid(), nome: "Canal", comision: 0 });
  save();
  renderAll();
};
export const addImp = () => {
  D.impressoras.push({
    id: uid(),
    nome: "Impresora",
    preco: 500000,
    vida: 5000,
    watts: 60,
    bico: 20000,
    bicoVida: 1000,
    mesa: 30000,
    mesaVida: 2000,
  });
  save();
  renderAll();
};
