import { $, el, uid, num, money, hhmm, pct } from "./util.js";
import { D } from "./estado.js";
import { toast, showTab, renderAll } from "./ui.js";
import { calc, prod, gramosCon, unitario } from "./calculo.js";
import { consumoDe, aplicarConsumo, alertasStock } from "./stock.js";
import { fotosTmp, setFotosTmp, pintarFoto } from "./fotos.js";
import { renderCat, filName } from "./catalogo.js";
import { save, cerrarSheet } from "./main.js";

export let editId = null;
export let insumosSel = {};

/* ---------- editor ---------- */
export function nuevaPieza() {
  cargarPieza(null);
  showTab("calc");
}
export function cargarPieza(p) {
  editId = p ? p.id : null;
  setFotosTmp(
    p
      ? Array.isArray(p.fotos) && p.fotos.length
        ? p.fotos.slice()
        : p.foto
          ? [p.foto]
          : []
      : [],
  );
  $("#calcTitle").textContent = p ? p.nome || "Pieza" : "Pieza nueva";
  $("#c_nome").value = p ? p.nome : "";
  $("#c_ref").value = p ? p.ref || "" : "";
  fillSel(
    $("#c_fil"),
    D.filamentos.map((f) => ({ id: f.id, nome: filName(f.id) })),
    p ? p.fil : null,
  );
  fillSel($("#c_imp"), D.impressoras, p ? p.imp : null);
  $("#c_peso").value = p ? p.peso : "";
  $("#c_h").value = p ? p.h : "";
  $("#c_m").value = p ? p.m : 0;
  $("#c_mo").value = p ? p.mo : 0;
  $("#c_risk").value = p && p.risco !== null && p.risco !== undefined ? p.risco : "";
  $("#c_mult").value = p && p.mult !== null && p.mult !== undefined ? p.mult : "";
  $("#c_cplx").value = p ? p.cplx || 1 : 1;
  $("#c_manual").value = p && p.manual ? p.manual : "";
  $("#c_mkt").value = p && p.mercado ? p.mercado : "";
  $("#c_cat").value = p ? p.cat || "" : "";
  $("#c_medida").value = p ? p.medida || "" : "";
  $("#c_video").value = p ? p.video || "" : "";
  $("#c_detalle").value = p ? p.detalle || "" : "";
  $("#c_tags").value = p ? p.tags || "" : "";
  $("#c_libre").checked = p ? !!p.libre : false;
  $("#c_desc").value = p ? p.desc || "" : "";
  $("#c_risk").placeholder = D.cfg.risco;
  $("#c_mult").placeholder = D.cfg.mult;
  insumosInputs(p ? p.insumos : null);
  $("#bSave").textContent = p ? "Guardar cambios" : "Guardar pieza";
  $("#bDel").hidden = !p;
  pintarFoto();
  renderCalc();
}
export function fillSel(sel, list, val) {
  sel.textContent = "";
  list.forEach((x) => sel.appendChild(el("option", { value: x.id }, x.nome)));
  if (val) sel.value = val;
}
export function insumosInputs(sel) {
  insumosSel = {};
  for (const k in sel || {}) if (num(sel[k]) > 0) insumosSel[k] = num(sel[k]);
  pintarInsumos();
}
function pintarInsumos() {
  const b = $("#insResumen");
  b.textContent = "";
  const ids = Object.keys(insumosSel).filter((k) => num(insumosSel[k]) > 0);
  if (!ids.length) {
    b.appendChild(el("span", { class: "none" }, "Ninguno todavía"));
    return;
  }
  let total = 0;
  ids.forEach((k) => {
    const it = D.insumos.find((x) => x.id === k);
    if (!it) return;
    total += unitario(it) * num(insumosSel[k]);
    b.appendChild(el("span", {}, (num(insumosSel[k]) > 1 ? insumosSel[k] + "× " : "") + it.nome));
  });
  if (total > 0) b.appendChild(el("span", { class: "none" }, "= " + money(total)));
}
function setIns(id, v) {
  v = Math.max(0, Math.round(v));
  if (v > 0) insumosSel[id] = v;
  else delete insumosSel[id];
  pintarInsumos();
  renderCalc();
}
export function abrirInsumos() {
  const b = $("#sheetBody");
  b.textContent = "";
  b.appendChild(el("h2", {}, "Insumos de la pieza"));
  b.appendChild(el("p", { class: "hint" }, "Buscá y poné cuántos usa. Se suman al costo."));
  const q = el("input", {
    type: "search",
    placeholder: "Buscar insumo…",
    style: "margin-bottom:11px",
  });
  b.appendChild(q);
  const lista = el("div", {});
  b.appendChild(lista);
  const pintar = () => {
    const t = (q.value || "").toLowerCase();
    lista.textContent = "";
    const arr = D.insumos.filter((i) => !t || (i.nome || "").toLowerCase().includes(t));
    if (!arr.length) {
      lista.appendChild(el("div", { class: "empty" }, "Ninguno con ese nombre."));
      return;
    }
    arr.forEach((i) => {
      const cant = num(insumosSel[i.id]);
      const val = el("input", {
        type: "text",
        inputmode: "numeric",
        value: cant || 0,
        style: "width:44px;text-align:center;padding:6px 2px",
      });
      val.addEventListener("input", () => setIns(i.id, num(val.value)));
      lista.appendChild(
        el(
          "div",
          { class: "item sinFoto" + (cant > 0 ? " sel" : "") },
          el(
            "div",
            { class: "info" },
            el("b", {}, i.nome),
            el("span", {}, money(unitario(i)) + " c/u · quedan " + Math.round(num(i.stock))),
          ),
          el(
            "div",
            { class: "qty" },
            el(
              "button",
              {
                onclick: () => {
                  setIns(i.id, num(insumosSel[i.id]) - 1);
                  pintar();
                },
              },
              "−",
            ),
            val,
            el(
              "button",
              {
                onclick: () => {
                  setIns(i.id, num(insumosSel[i.id]) + 1);
                  pintar();
                },
              },
              "+",
            ),
          ),
        ),
      );
    });
  };
  q.addEventListener("input", pintar);
  pintar();
  b.appendChild(
    el(
      "div",
      { class: "acts", style: "margin-top:14px" },
      el("button", { class: "btn wide", onclick: cerrarSheet }, "Listo"),
    ),
  );
  $("#sheet").classList.add("on");
}
function piezaActual() {
  const ins = {};
  for (const k in insumosSel) if (num(insumosSel[k]) > 0) ins[k] = num(insumosSel[k]);
  return {
    id: editId,
    nome: $("#c_nome").value.trim(),
    ref: $("#c_ref").value.trim(),
    foto: fotosTmp[0] || null,
    fotos: fotosTmp.slice(),
    fil: $("#c_fil").value,
    imp: $("#c_imp").value,
    peso: num($("#c_peso").value),
    h: num($("#c_h").value),
    m: num($("#c_m").value),
    mo: num($("#c_mo").value),
    insumos: ins,
    risco: $("#c_risk").value === "" ? null : num($("#c_risk").value),
    mult: $("#c_mult").value === "" ? null : num($("#c_mult").value),
    cplx: num($("#c_cplx").value) || 1,
    manual: $("#c_manual").value === "" ? null : num($("#c_manual").value),
    mercado: $("#c_mkt").value === "" ? null : num($("#c_mkt").value),
    cat: $("#c_cat").value.trim(),
    desc: $("#c_desc").value.trim(),
    libre: $("#c_libre").checked,
    medida: $("#c_medida").value.trim(),
    video: $("#c_video").value.trim(),
    detalle: $("#c_detalle").value.trim(),
    tags: $("#c_tags").value.trim(),
  };
}
export function renderCalc() {
  const p = piezaActual(),
    r = calc(p);
  $("#r_preco").textContent = money(r.preco);
  $("#r_sub").textContent =
    hhmm(r.horas) +
    " de máquina · " +
    gramosCon(p) +
    " g con desperdicio" +
    (p.libre ? " · costo calculado con " + filName(p.fil) + ", el cliente elige al pedir" : "");
  $("#r_custo").textContent = money(r.custo);
  $("#r_lucro").textContent = money(r.lucro);
  $("#r_margem").textContent = pct(r.margem);
  $("#r_hora").textContent = money(r.porHora) + "/h";
  const parts = [
    ["Material", r.material, "var(--deep)"],
    ["Luz", r.luz, "var(--teal)"],
    ["Desgaste", r.desgaste, "var(--sand)"],
    ["Trabajo", r.trabalho, "var(--clay)"],
    ["Insumos", r.insumos, "var(--leaf)"],
    ["Reserva", r.reserva, "#CFC3AE"],
  ].filter((x) => x[1] > 0.5);
  const max = Math.max(...parts.map((x) => x[1]), 1),
    st = $("#stack");
  st.textContent = "";
  if (!parts.length) {
    st.appendChild(el("div", { class: "empty" }, "Cargá peso y tiempo para ver el desglose."));
    return;
  }
  parts
    .sort((a, b) => a[1] - b[1])
    .forEach(([n, v, c]) =>
      st.appendChild(
        el(
          "div",
          {
            class: "layer",
            style: "background:" + c + ";width:" + Math.max(30, (v / max) * 100) + "%",
          },
          el("span", {}, n),
          el("span", { class: "num" }, money(v)),
        ),
      ),
    );
  renderMercado(p, r);
}
function renderMercado(p, r) {
  const box = $("#mktBox");
  box.textContent = "";
  const mk = num(p.mercado);
  if (mk <= 0) return;
  const dif = (r.preco - mk) / mk;
  let clase = "ok",
    txt;
  if (dif > 0.15) {
    clase = "alta";
    txt =
      "Estás " +
      pct(dif) +
      " más cara que el mercado. Si no se vende, bajá el multiplicador o buscá una pieza que use menos filamento.";
  } else if (dif < -0.15) {
    clase = "baja";
    txt =
      "Estás " +
      pct(-dif) +
      " más barata que el mercado. Podés subir el precio hasta " +
      money(mk) +
      " sin quedar cara: son " +
      money(mk - r.preco) +
      " de ganancia extra por pieza.";
  } else txt = "Estás en precio de mercado. Ni cara ni regalada.";
  const min = Math.min(mk, r.preco) * 0.75,
    max2 = Math.max(mk, r.preco) * 1.12;
  const pos = (v) => Math.max(6, Math.min(94, ((v - min) / (max2 - min)) * 100));
  box.appendChild(
    el(
      "div",
      { class: "mkt " + clase },
      el("b", { style: "font:600 13px Fredoka,sans-serif" }, "Tu precio contra el mercado"),
      el(
        "div",
        { class: "bar" },
        el("div", { class: "track" }),
        el(
          "div",
          { class: "mk", style: "left:" + pos(mk) + "%" },
          el("i", {}),
          el("b", {}, "mercado " + money(mk)),
        ),
        el(
          "div",
          { class: "yo", style: "left:" + pos(r.preco) + "%" },
          el("i", {}),
          el("b", {}, "vos " + money(r.preco)),
        ),
      ),
      el("p", {}, txt),
      mk > 0 && mk < r.custo
        ? el(
            "p",
            { style: "font-weight:600" },
            "Ojo: a precio de mercado esta pieza te da pérdida. Te cuesta " +
              money(r.custo) +
              " hacerla.",
          )
        : null,
    ),
  );
}
export function buscarMercado() {
  const q = ($("#c_nome").value || "").trim();
  if (!q) {
    toast("Poné el nombre de la pieza primero.");
    $("#c_nome").focus();
    return;
  }
  window.open(
    "https://listado.mercadolibre.com.ar/" + encodeURIComponent(q + " impresion 3d"),
    "_blank",
    "noopener",
  );
}
export function gastoSinVenta() {
  if (!editId) {
    toast("Guardá la pieza primero.");
    return;
  }
  const p = prod(editId);
  aplicarConsumo(consumoDe([{ p, q: 1 }]), -1);
  save();
  renderAll();
  const al = alertasStock();
  toast(al.length ? "Descontado. " + al[0].txt : "Descontado del stock.");
}
export function addAlPedido() {
  if (!editId) {
    toast("Guardá la pieza primero.");
    return;
  }
  D.pedido[editId] = num(D.pedido[editId]) + 1;
  save();
  renderAll();
  toast("Sumada al pedido.");
}
export function iniciarEditor() {
  $("#bSave").addEventListener("click", () => {
    const p = piezaActual();
    if (!p.nome) {
      toast("Poné un nombre.");
      $("#c_nome").focus();
      return;
    }
    if (editId) {
      const i = D.produtos.findIndex((x) => x.id === editId);
      if (i >= 0) D.produtos[i] = Object.assign({}, D.produtos[i], p);
    } else {
      p.id = uid();
      D.produtos.push(p);
      editId = p.id;
    }
    $("#bSave").textContent = "Guardar cambios";
    $("#bDel").hidden = false;
    $("#calcTitle").textContent = p.nome;
    save();
    renderAll();
    toast("Pieza guardada.");
  });
  $("#bDel").addEventListener("click", () => {
    if (!editId || !confirm("¿Borrar esta pieza del catálogo?")) return;
    D.produtos = D.produtos.filter((x) => x.id !== editId);
    delete D.pedido[editId];
    cargarPieza(null);
    save();
    renderAll();
    showTab("cat");
    toast("Pieza borrada.");
  });
  [
    "c_nome",
    "c_fil",
    "c_imp",
    "c_peso",
    "c_h",
    "c_m",
    "c_mo",
    "c_risk",
    "c_mult",
    "c_cplx",
    "c_manual",
    "c_mkt",
    "c_cat",
    "c_desc",
    "c_medida",
    "c_video",
    "c_detalle",
    "c_tags",
  ].forEach((id) => $("#" + id).addEventListener("input", renderCalc));
  $("#c_libre").addEventListener("change", renderCalc);
  $("#q").addEventListener("input", renderCat);
}
