"use strict";
const $ = (s) => document.querySelector(s);
const el = (t, a = {}, ...k) => {
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
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** Acepta 17,80 y 17.80 por igual: acá se escribe con coma. */
const num = (v) => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = parseFloat(String(v == null ? "" : v).replace(",", "."));
  return isFinite(n) ? n : 0;
};
const money = (v) => "$" + Math.round(v).toLocaleString("es-AR");
const pct = (v) => (v * 100).toFixed(0) + "%";
const hhmm = (h) => {
  const H = Math.floor(h),
    M = Math.round((h - H) * 60);
  return H + "h" + (M ? " " + M + "m" : "");
};
const ceilTo = (v, s) => (s > 1 ? Math.ceil(v / s) * s : Math.ceil(v));
const hoy = () => new Date().toISOString().slice(0, 10);

/* ---------- almacenamiento ---------- */
const LOGO_FULL = "/assets/logo-app-full.png";
const LOGO = "/assets/logo-app.png";
/* Dirección del servidor (Apps Script). Es la misma para todos los que entren. */
const SERVIDOR =
  "https://script.google.com/macros/s/AKfycbyiHVXBAnYzs_CBnIuURgBWuTQS0HFFrKExcPiyxviLDAZiLmsgZ0a-9wE8Y2c1yzDy/exec";
const KEY = "playmind3d:v2";
const local = {
  async get() {
    try {
      if (window.storage && window.storage.get) {
        const r = await window.storage.get(KEY);
        return r && r.value ? JSON.parse(r.value) : null;
      }
      const v = window.localStorage.getItem(KEY);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  },
  async set(d) {
    const s = JSON.stringify(d);
    try {
      if (window.storage && window.storage.set) {
        await window.storage.set(KEY, s);
        return;
      }
      window.localStorage.setItem(KEY, s);
    } catch (e) {
      console.warn(e);
    }
  },
};

const defaults = () => ({
  cfg: {
    marca: "Play Mind 3d",
    logo: LOGO,
    wa: "",
    email: "",
    catalogo: "",
    kwh: 230,
    maoObra: 0,
    risco: 12,
    mult: 4,
    round: 500,
    merma: 12,
    api: "",
    token: "",
    leti: { cita: "", historia: "", foto: "" },
  },
  canais: [
    { id: "c1", nome: "Escuela", comision: 0 },
    { id: "c2", nome: "WhatsApp", comision: 0 },
    { id: "c3", nome: "Marketplace", comision: 13 },
  ],
  filamentos: [
    {
      id: "f1",
      marca: "Bambu Lab",
      nome: "PLA Basic",
      cor: "Blanco",
      hex: "#F2F0EA",
      precoKg: 24000,
      rollo: 1000,
      stock: 1000,
    },
  ],
  impressoras: [
    {
      id: "i1",
      nome: "Bambu Lab A1 mini",
      preco: 505000,
      vida: 5000,
      watts: 48,
      bico: 21000,
      bicoVida: 1000,
      mesa: 35000,
      mesaVida: 2000,
    },
  ],
  insumos: [
    { id: "n1", nome: "Bolsita chica", pack: 7500, unid: 100, stock: 100 },
    { id: "n2", nome: "Bolsita grande", pack: 35000, unid: 25, stock: 25 },
    { id: "n3", nome: "Etiqueta", pack: 10000, unid: 50, stock: 50 },
    { id: "n4", nome: "Argolla de llavero", pack: 5800, unid: 100, stock: 100 },
  ],
  produtos: [],
  vendas: [],
  pedido: {},
  pedidoFil: {},
  radar: [],
  packs: [],
  opiniones: [],
  v: 2,
  _sucio: false,
});
let D = defaults(),
  editId = null,
  fotosTmp = [],
  insumosSel = {};

/* ---------- cálculo ---------- */
function calc(p) {
  const c = D.cfg;
  const fil = D.filamentos.find((f) => f.id === p.fil) || D.filamentos[0] || { precoKg: 0 };
  const imp = D.impressoras.find((i) => i.id === p.imp) ||
    D.impressoras[0] || { preco: 0, vida: 1, watts: 0, bico: 0, bicoVida: 1, mesa: 0, mesaVida: 1 };
  const gr = gramosCon(p),
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
    const it = D.insumos.find((x) => x.id === k);
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
  };
}
const prod = (id) => D.produtos.find((p) => p.id === id);
/** Lo que se gasta de verdad: la pieza más el desperdicio estimado. */
function gramosCon(p) {
  const base = num(p && p.peso);
  return Math.round(base * (1 + num(D.cfg.merma) / 100) * 10) / 10;
}
/** Lo que cuesta UNA unidad del insumo, sacado del precio del paquete. */
function unitario(it) {
  if (!it) return 0;
  if (it.pack !== undefined && it.pack !== null) return num(it.pack) / Math.max(num(it.unid), 1);
  return num(it.preco); // formato viejo: ya venía por unidad
}
function migrarInsumos() {
  (D.insumos || []).forEach((i) => {
    if (i.pack === undefined || i.pack === null) {
      i.pack = num(i.preco);
      i.unid = 1;
    }
    delete i.preco;
    if (i.stock === undefined || i.stock === null) i.stock = num(i.unid);
  });
  (D.filamentos || []).forEach((f) => {
    if (!f.rollo) f.rollo = 1000;
    if (f.stock === undefined || f.stock === null) f.stock = num(f.rollo);
  });
}

/* ---------- stock ---------- */
/** Cuánto se consume al hacer estas piezas: gramos por filamento y unidades por insumo. */
function consumoDe(items) {
  const fil = {},
    ins = {};
  items.forEach(({ p, q, fil: elegido }) => {
    const id = elegido || p.fil;
    fil[id] = num(fil[id]) + gramosCon(p) * q;
    for (const k in p.insumos || {}) ins[k] = num(ins[k]) + num(p.insumos[k]) * q;
  });
  return { fil, ins };
}
function aplicarConsumo(c, signo) {
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
function alertasStock() {
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

/* ---------- fotos ---------- */
function leerFoto(file, cb) {
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 520,
        sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc);
      cv.height = Math.round(img.height * sc);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => toast("No se pudo leer esa imagen.");
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
}
$("#fFoto").addEventListener("change", (e) => {
  const arch = Array.from(e.target.files || []);
  arch.forEach((f) =>
    leerFoto(f, (d) => {
      if (fotosTmp.length < 8) {
        fotosTmp.push(d);
        pintarFoto();
        renderCalc();
      }
    }),
  );
  e.target.value = "";
});
$("#fLogo").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  leerFoto(f, (d) => {
    D.cfg.logo = d;
    save();
    pintarMarca();
    toast("Logo actualizado.");
  });
  e.target.value = "";
});
$("#fLetiFoto").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  leerFoto(f, (d) => {
    D.cfg.leti.foto = d;
    save();
    pintarLeti();
    toast("Foto actualizada.");
  });
  e.target.value = "";
});
function quitarFoto(i) {
  fotosTmp.splice(i, 1);
  pintarFoto();
  renderCalc();
}
function pintarFoto() {
  const b = $("#fotoBox");
  b.textContent = "";
  if (!fotosTmp.length) {
    b.textContent = "📷";
    return;
  }
  b.appendChild(el("img", { src: fotosTmp[0], alt: "" }));
  const tira = $("#fotoTira");
  tira.textContent = "";
  fotosTmp.forEach((f, i) => {
    const m = el(
      "div",
      { class: "minifoto" + (i === 0 ? " tapa" : "") },
      el("img", { src: f, alt: "" }),
      el(
        "button",
        {
          class: "x",
          title: "Quitar",
          onclick: (ev) => {
            ev.stopPropagation();
            quitarFoto(i);
          },
        },
        "×",
      ),
      i === 0 ? el("span", { class: "sello" }, "portada") : null,
    );
    if (i > 0) {
      m.title = "Poner de portada";
      m.addEventListener("click", (ev) => {
        if (ev.target.tagName === "BUTTON") return;
        fotosTmp.unshift(fotosTmp.splice(i, 1)[0]);
        pintarFoto();
        renderCalc();
        toast("Ahora esta es la portada.");
      });
    }
    tira.appendChild(m);
  });
}
function pintarMarca() {
  const lb = $("#logoBox");
  lb.textContent = "";
  if (D.cfg.logo) lb.appendChild(el("img", { src: D.cfg.logo, alt: "" }));
  else lb.appendChild(el("b", {}));
  $("#brandName").textContent = D.cfg.marca || "PlayMind 3D";
  document.title = D.cfg.marca || "PlayMind 3D";
}
function pintarLeti() {
  const b = $("#letiFotoBox");
  if (!b) return;
  b.textContent = "";
  if (D.cfg.leti && D.cfg.leti.foto)
    b.appendChild(
      el("img", {
        src: D.cfg.leti.foto,
        alt: "",
        style: "width:100%;height:100%;object-fit:cover",
      }),
    );
  else b.textContent = "🧑‍🎨";
}
const thumb = (p) => {
  const t = el("div", { class: "thumb" });
  if (p && p.foto) t.appendChild(el("img", { src: p.foto, alt: "", loading: "lazy" }));
  else t.textContent = "🧩";
  return t;
};

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
function renderCat() {
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
function chgQty(id, d) {
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
function sumarStock(p, n) {
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
  });
  p.stock = num(p.stock) - 1;
  save();
  renderAll();
  toast("Vendida: " + money(r.preco) + ". Quedan " + p.stock + ".");
}
const filName = (id) => {
  const f = D.filamentos.find((x) => x.id === id);
  return f ? (f.marca ? f.marca + " " : "") + f.nome + (f.cor ? " · " + f.cor : "") : "—";
};

/* ---------- editor ---------- */
function nuevaPieza() {
  cargarPieza(null);
  showTab("calc");
}
function cargarPieza(p) {
  editId = p ? p.id : null;
  fotosTmp = p
    ? Array.isArray(p.fotos) && p.fotos.length
      ? p.fotos.slice()
      : p.foto
        ? [p.foto]
        : []
    : [];
  $("#calcTitle").textContent = p ? p.nome || "Pieza" : "Pieza nueva";
  $("#c_nome").value = p ? p.nome : "";
  $("#c_ref").value = p ? p.ref || "" : "";
  fillSel(
    $("#c_fil"),
    D.filamentos.map((f) => ({
      id: f.id,
      nome: (f.marca ? f.marca + " " : "") + f.nome + (f.cor ? " · " + f.cor : ""),
    })),
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
function fillSel(sel, list, val) {
  sel.textContent = "";
  list.forEach((x) => sel.appendChild(el("option", { value: x.id }, x.nome)));
  if (val) sel.value = val;
}
function insumosInputs(sel) {
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
function abrirInsumos() {
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
          { class: "item" + (cant > 0 ? " sel" : "") },
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
function renderCalc() {
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

function buscarMercado() {
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
function gastoSinVenta() {
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
function addAlPedido() {
  if (!editId) {
    toast("Guardá la pieza primero.");
    return;
  }
  D.pedido[editId] = num(D.pedido[editId]) + 1;
  save();
  renderAll();
  toast("Sumada al pedido.");
}
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
function renderPed() {
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
["p_desc", "p_envio", "p_canal"].forEach((id) => $("#" + id).addEventListener("input", renderPed));
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
function mandarWA() {
  const t = textoPedido();
  if (!t) {
    toast("El pedido está vacío.");
    return;
  }
  const url = "https://wa.me/?text=" + encodeURIComponent(t);
  window.open(url, "_blank", "noopener");
}
function vaciarPedido() {
  D.pedido = {};
  $("#p_desc").value = 0;
  $("#p_envio").value = 0;
  $("#p_cli").value = "";
  save();
  renderAll();
}
function registrarVenta() {
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

/* ---------- vitrina ---------- */
function agrupado() {
  const g = {};
  D.produtos.forEach((p) => {
    if (p.oculta) return;
    const c = (p.cat || "Otras creaciones").trim() || "Otras creaciones";
    (g[c] = g[c] || []).push(p);
  });
  return g;
}
function renderVit() {
  $("#vitTitulo").textContent = D.cfg.marca || "PlayMind 3d";
  const lg = $("#vitLogo");
  if (D.cfg.logo) lg.src = D.cfg.logo;
  else lg.removeAttribute("src");
  const box = $("#vitList");
  box.textContent = "";
  const g = agrupado(),
    cats = Object.keys(g);
  if (!cats.length) {
    box.appendChild(
      el("div", { class: "empty" }, "Cargá piezas con foto y descripción para armar la vitrina."),
    );
    return;
  }
  cats.forEach((c) => {
    box.appendChild(el("div", { class: "vitcat" }, c));
    const grid = el("div", { class: "vitgrid" });
    g[c].forEach((p) => {
      const r = calc(p);
      grid.appendChild(
        el(
          "div",
          { class: "vitem" },
          (() => {
            const fotos = p.fotos && p.fotos.length ? p.fotos : p.foto ? [p.foto] : [];
            const ph = el("div", { class: "ph" });
            if (!fotos.length) ph.textContent = "🧩";
            fotos.forEach((f, i) =>
              ph.appendChild(
                el("img", { src: f, alt: p.nome, loading: "lazy", class: i === 0 ? "on" : "" }),
              ),
            );
            if (fotos.length > 1) {
              let act = 0;
              const ver = (n) => {
                act = (n + fotos.length) % fotos.length;
                ph.querySelectorAll("img").forEach((im, k) => im.classList.toggle("on", k === act));
                cnt.textContent = act + 1 + "/" + fotos.length;
              };
              const cnt = el("span", { class: "cnt" }, "1/" + fotos.length);
              ph.appendChild(
                el(
                  "button",
                  {
                    class: "nav prev",
                    onclick: (ev) => {
                      ev.stopPropagation();
                      ver(act - 1);
                    },
                  },
                  "‹",
                ),
              );
              ph.appendChild(
                el(
                  "button",
                  {
                    class: "nav next",
                    onclick: (ev) => {
                      ev.stopPropagation();
                      ver(act + 1);
                    },
                  },
                  "›",
                ),
              );
              ph.appendChild(cnt);
            }
            if (p.video)
              ph.appendChild(
                el(
                  "button",
                  {
                    class: "playbtn",
                    title: "Ver video",
                    onclick: (ev) => {
                      ev.stopPropagation();
                      window.open(p.video, "_blank", "noopener");
                    },
                  },
                  "▶",
                ),
              );
            return ph;
          })(),
          el(
            "div",
            { class: "txt" },
            el("b", {}, p.nome || "Sin nombre"),
            el(
              "p",
              {},
              (p.desc || "Contame si querés saber más de esta.") +
                (p.libre ? " Elegís el color." : ""),
            ),
            el("u", {}, money(r.preco)),
            el(
              "button",
              {
                class: "btn ghost mini",
                style: "margin-top:8px;width:100%",
                onclick: (ev) => {
                  ev.stopPropagation();
                  verPost(p);
                },
              },
              "Post",
            ),
          ),
        ),
      );
    });
    box.appendChild(grid);
  });
}

/** Arma un HTML suelto con SOLO el catálogo: nada de costos ni ventas. */
function vitrinaHTML() {
  const g = agrupado(),
    marca = D.cfg.marca || "PlayMind 3d";
  let cuerpo = "";
  Object.keys(g).forEach((c) => {
    cuerpo += "<h2>" + esc(c) + '</h2><div class="grid">';
    g[c].forEach((p) => {
      const r = calc(p);
      cuerpo +=
        '<div class="it">' +
        (p.foto
          ? '<img src="' + p.foto + '" alt="' + esc(p.nome) + '">'
          : '<div class="ph">🧩</div>') +
        '<div class="tx"><b>' +
        esc(p.nome || "") +
        "</b><p>" +
        esc(p.desc || "") +
        "</p><u>" +
        money(r.preco) +
        "</u></div></div>";
    });
    cuerpo += "</div>";
  });
  const wa = (D.cfg.wa || "").replace(/[^0-9]/g, "");
  return (
    '<!DOCTYPE html><html lang="es-AR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    esc(marca) +
    "</title>" +
    '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&family=Nunito:wght@400;600;800&display=swap" rel="stylesheet">' +
    "<style>body{margin:0;background:#FAF6EE;color:#3A3A38;font:15px/1.5 Nunito,sans-serif}" +
    ".w{max-width:820px;margin:0 auto;padding:22px 16px 50px}" +
    "header{display:flex;gap:13px;align-items:center;margin-bottom:22px}" +
    "header img{width:60px;height:60px;border-radius:50%;border:1.5px solid #E6DCC9;object-fit:cover}" +
    "h1{font:600 22px Fredoka,sans-serif;margin:0;color:#2C7A7B}" +
    "header p{margin:3px 0 0;font-size:13px;color:#6E6E6A}" +
    "h2{font:600 15px Fredoka,sans-serif;color:#E8895A;margin:26px 0 11px;display:flex;align-items:center;gap:9px}" +
    'h2:after{content:"";flex:1;height:1px;background:#E4DCCB}' +
    ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(152px,1fr));gap:13px}" +
    ".it{background:#fff;border:1.5px solid #E6DCC9;border-radius:15px;overflow:hidden}" +
    ".it img,.it .ph{width:100%;aspect-ratio:1;object-fit:cover;display:block}" +
    ".it .ph{background:#E3EFEC;display:grid;place-items:center;font-size:32px}" +
    ".tx{padding:10px 11px 13px}.tx b{font:600 14px Fredoka,sans-serif;display:block}" +
    ".tx p{margin:4px 0 8px;font-size:12px;color:#6E6E6A;line-height:1.45}" +
    ".tx u{text-decoration:none;font:700 15px Nunito,sans-serif;color:#2C7A7B}" +
    "footer{margin-top:34px;text-align:center;font-size:13px;color:#6E6E6A}" +
    "a.b{display:inline-block;margin-top:10px;background:#2C7A7B;color:#fff;text-decoration:none;" +
    'font:500 15px Fredoka,sans-serif;padding:11px 22px;border-radius:12px}</style></head><body><div class="w">' +
    "<header>" +
    (D.cfg.logo ? '<img src="' + D.cfg.logo + '" alt="">' : "") +
    "<div><h1>" +
    esc(marca) +
    "</h1><p>Juguetes sensoriales y creaciones en 3D, hechos a pedido.</p></div></header>" +
    cuerpo +
    "<footer>Se imprimen a pedido y elegís el color." +
    (wa ? '<br><a class="b" href="https://wa.me/' + wa + '">Hacer un pedido</a>' : "") +
    "</footer></div></body></html>"
  );
}
const esc = (t) =>
  String(t || "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
function bajarVitrina() {
  if (!D.produtos.length) {
    toast("Primero cargá alguna pieza.");
    return;
  }
  const b = new Blob([vitrinaHTML()], { type: "text/html" });
  const a = el("a", { href: URL.createObjectURL(b), download: "catalogo-playmind3d.html" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Catálogo bajado. Podés mandarlo o publicarlo.");
}
function compartirVitrina() {
  const g = agrupado();
  if (!D.produtos.length) {
    toast("Primero cargá alguna pieza.");
    return;
  }
  let t = (D.cfg.marca || "PlayMind 3d") + " — catálogo\n";
  Object.keys(g).forEach((c) => {
    t += "\n" + c + "\n";
    g[c].forEach((p) => {
      t += "• " + p.nome + " — " + money(calc(p).preco) + (p.desc ? "\n   " + p.desc : "") + "\n";
    });
  });
  t += "\nSe imprimen a pedido y elegís el color 🎨";
  window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank", "noopener");
}

/* ---------- radar ---------- */
var ORIGENES = [
  { id: "radar", nome: "Del radar del mes" },
  { id: "propia", nome: "Mías" },
  { id: "auto", nome: "De la máquina" },
];
var ESTADOS = [
  { id: "anotada", nome: "Anotada", color: "var(--soft)" },
  { id: "probar", nome: "Para probar", color: "var(--clay)" },
  { id: "probada", nome: "Probada", color: "var(--teal)" },
  { id: "vende", nome: "Se vende", color: "var(--leaf)" },
  { id: "descartada", nome: "Descartada", color: "#B9AFA0" },
];
const estadoDe = (id) => ESTADOS.find((e) => e.id === id) || ESTADOS[0];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function mesCorto(f) {
  if (!f) return "";
  const p = String(f).split("-");
  return p.length < 2 ? "" : MESES[Number(p[1]) - 1] + " " + p[0].slice(2);
}
const mesDe = (f) => String(f || hoy()).slice(0, 7);

/** Todos los meses que tienen ideas, del más nuevo al más viejo. */
function mesesDelRadar() {
  const m = {};
  D.radar.forEach((i) => {
    (i.visto || [mesDe(i.desde)]).forEach((x) => (m[x] = 1));
  });
  return Object.keys(m).sort().reverse();
}

/** NUEVA / SE MANTIENE / SALIÓ, comparando con el mes anterior. */
function seniaMes(i, mes) {
  const visto = i.visto || [mesDe(i.desde)];
  const meses = mesesDelRadar();
  const pos = meses.indexOf(mes);
  const anterior = pos >= 0 ? meses[pos + 1] : null;
  const ahora = visto.indexOf(mes) >= 0;
  const antes = anterior ? visto.indexOf(anterior) >= 0 : false;
  if (ahora && !antes && anterior) return { t: "NUEVA", c: "g" };
  if (ahora && antes) return { t: "se mantiene", c: "" };
  if (!ahora && antes) return { t: "salió del radar", c: "y" };
  return null;
}

function renderRad() {
  const box = $("#radList");
  box.textContent = "";
  const meses = mesesDelRadar();
  $("#bSemilla").hidden = D.radar.some((i) => (i.visto || []).indexOf("2026-08") >= 0);
  const sel = $("#radMes");
  const previo = sel.value;
  sel.textContent = "";
  sel.appendChild(el("option", { value: "" }, "Todas las ideas"));
  meses.forEach((m) =>
    sel.appendChild(el("option", { value: m }, "Radar de " + mesCorto(m + "-01"))),
  );
  sel.value = meses.indexOf(previo) >= 0 ? previo : "";
  $("#radMesWrap").hidden = !meses.length;

  const mes = sel.value,
    org = $("#radOrigen").value;
  let lista = D.radar;
  if (org) lista = lista.filter((i) => (i.origen || "propia") === org);
  if (mes)
    lista = lista.filter((i) => {
      const v = i.visto || [mesDe(i.desde)];
      const pos = meses.indexOf(mes),
        ant = meses[pos + 1];
      return v.indexOf(mes) >= 0 || (ant && v.indexOf(ant) >= 0);
    });

  if (!lista.length) {
    box.appendChild(
      el(
        "div",
        { class: "empty" },
        D.radar.length
          ? "Nada en ese mes."
          : "Todavía no hay ideas. Pegá el radar del mes o cargá una a mano.",
      ),
    );
    return;
  }
  ESTADOS.forEach((es) => {
    const grupo = lista.filter((i) => (i.estado || "anotada") === es.id);
    if (!grupo.length) return;
    box.appendChild(
      el(
        "div",
        { class: "vitcat", style: "color:" + es.color },
        es.nome + " (" + grupo.length + ")",
      ),
    );
    grupo.forEach((i) => {
      const sen = mes ? seniaMes(i, mes) : null;
      box.appendChild(
        el(
          "div",
          { class: "item" },
          (() => {
            const t = el("div", {
              class: "thumb",
              style: "background:var(--deep-soft);font-size:17px",
              onclick: () => abrirIdea(i),
            });
            if (i.foto) t.appendChild(el("img", { src: i.foto, alt: "", loading: "lazy" }));
            else t.textContent = i.emoji || "💡";
            return t;
          })(),
          el(
            "div",
            { class: "info", onclick: () => abrirIdea(i) },
            el("b", { style: "white-space:normal" }, i.nome),
            el("span", {}, [i.fuente, i.pais].filter(Boolean).join(" · ")),
            sen
              ? el(
                  "i",
                  {
                    class: "pill " + sen.c,
                    style: "font-style:normal;margin-top:4px;display:inline-block",
                  },
                  sen.t,
                )
              : null,
          ),
          el(
            "div",
            { class: "val" },
            el(
              "b",
              { style: "font-size:12px" },
              i.potencial && i.potencial !== "—" ? i.potencial : "",
            ),
            el("span", {}, mesCorto(i.desde)),
          ),
          i.link
            ? el(
                "button",
                {
                  class: "btn ghost mini verlink",
                  title: "Ver ejemplos",
                  onclick: (ev) => {
                    ev.stopPropagation();
                    window.open(i.link, "_blank", "noopener");
                  },
                },
                "↗",
              )
            : null,
        ),
      );
    });
  });
}

function nuevaIdea() {
  abrirIdea({
    id: uid(),
    nome: "",
    fuente: "",
    pais: "",
    desde: hoy(),
    estado: "anotada",
    nota: "",
    link: "",
    emoji: "💡",
    potencial: "",
    visto: [mesDe(hoy())],
    origen: "propia",
    nueva: true,
  });
}

function abrirIdea(i) {
  const b = $("#sheetBody");
  b.textContent = "";
  const campo = (lab, key, ph, tipo) => {
    const d = el("div", { style: "margin-bottom:11px" }, el("label", { class: "f" }, lab));
    const inp =
      tipo === "area"
        ? el("textarea", { rows: "3", placeholder: ph || "" })
        : el("input", { type: "text", placeholder: ph || "" });
    inp.value = i[key] || "";
    inp.addEventListener("input", () => {
      i[key] = inp.value;
    });
    d.appendChild(inp);
    return d;
  };
  b.appendChild(el("h2", {}, i.nueva ? "Idea nueva" : i.nome || "Idea"));
  if (i.visto && i.visto.length > 1)
    b.appendChild(
      el(
        "p",
        { class: "mut", style: "margin:0 0 12px" },
        "Apareció en " +
          i.visto.length +
          " radares: " +
          i.visto.map((m) => mesCorto(m + "-01")).join(", "),
      ),
    );
  b.appendChild(campo("Qué es", "nome", "Flexi axolote llavero"));
  b.appendChild(campo("Dónde lo viste", "fuente", "Etsy, MakerWorld, TikTok…"));
  if (i.origen && !i.nueva) {
    const o = ORIGENES.find((x) => x.id === i.origen);
    if (o) b.appendChild(el("p", { class: "mut", style: "margin:-6px 0 12px" }, o.nome));
  }
  b.appendChild(campo("Dónde se vende", "pais", "EE.UU. / Argentina / Mundo"));
  b.appendChild(campo("Precio afuera", "potencial", "USD 9 / $8.000"));
  b.appendChild(campo("Link para verlo", "link", "https://…"));
  b.appendChild(campo("Notas", "nota", "Por qué te parece que puede funcionar acá", "area"));

  const fotoWrap = el("div", { class: "acts", style: "margin-bottom:12px" });
  const box = el("div", { class: "thumb", style: "width:64px;height:64px" });
  const pintarF = () => {
    box.textContent = "";
    if (i.foto) box.appendChild(el("img", { src: i.foto, alt: "" }));
    else box.textContent = "🖼️";
  };
  pintarF();
  const inp = el("input", { type: "file", accept: "image/*", style: "display:none" });
  inp.addEventListener("change", (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    leerFoto(f, (d) => {
      i.foto = d;
      pintarF();
    });
    ev.target.value = "";
  });
  fotoWrap.appendChild(box);
  fotoWrap.appendChild(inp);
  fotoWrap.appendChild(
    el("button", { class: "btn ghost mini", onclick: () => inp.click() }, "Poner captura"),
  );
  if (i.foto)
    fotoWrap.appendChild(
      el(
        "button",
        {
          class: "btn danger mini",
          onclick: () => {
            i.foto = null;
            pintarF();
          },
        },
        "Quitar",
      ),
    );
  b.appendChild(fotoWrap);

  const sel = el("div", { style: "margin:6px 0 12px" }, el("label", { class: "f" }, "En qué está"));
  const fila = el("div", { class: "acts" });
  ESTADOS.forEach((es) => {
    const on = (i.estado || "anotada") === es.id;
    fila.appendChild(
      el(
        "button",
        {
          class: "btn mini" + (on ? "" : " ghost"),
          onclick: () => {
            i.estado = es.id;
            i.hist = (i.hist || []).concat([hoy() + ": " + es.nome]);
            guardarIdea(i);
            abrirIdea(i);
          },
        },
        es.nome,
      ),
    );
  });
  sel.appendChild(fila);
  b.appendChild(sel);

  if (i.hist && i.hist.length)
    b.appendChild(
      el("p", { class: "mut", style: "margin:0 0 12px" }, "Historia: " + i.hist.join(" · ")),
    );

  b.appendChild(
    el(
      "div",
      { class: "acts" },
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            guardarIdea(i);
            cerrarSheet();
            toast("Idea guardada.");
          },
        },
        "Guardar",
      ),
      i.link
        ? el(
            "button",
            { class: "btn ghost", onclick: () => window.open(i.link, "_blank", "noopener") },
            "Ver ejemplos",
          )
        : null,
      el(
        "button",
        {
          class: "btn ghost",
          onclick: () => {
            guardarIdea(i);
            cerrarSheet();
            cargarPieza(null);
            $("#c_nome").value = i.nome;
            $("#c_ref").value = i.link || "";
            renderCalc();
            showTab("calc");
            toast("Cargá peso y tiempo para saber a cuánto te sale.");
          },
        },
        "Convertir en pieza",
      ),
      i.nueva
        ? null
        : el(
            "button",
            {
              class: "btn danger",
              onclick: () => {
                if (!confirm("¿Borrar esta idea?")) return;
                D.radar = D.radar.filter((x) => x.id !== i.id);
                save();
                renderRad();
                cerrarSheet();
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

function guardarIdea(i) {
  if (!i.nome) {
    toast("Ponele un nombre.");
    return;
  }
  delete i.nueva;
  if (!i.visto || !i.visto.length) i.visto = [mesDe(i.desde)];
  const k = D.radar.findIndex((x) => x.id === i.id);
  if (k >= 0) D.radar[k] = i;
  else D.radar.push(i);
  save();
  renderRad();
}

/* ----- lo que junta el radar automático en la planilla ----- */
var MUNDO = [];
async function traerMundo() {
  const url = (D.cfg.api || "").trim();
  if (!url) {
    toast("Primero conectá el servidor en Ajustes.");
    return;
  }
  const box = $("#mundoList");
  box.textContent = "";
  box.appendChild(el("div", { class: "empty" }, "Buscando…"));
  try {
    const j = await pedir({
      action: "mundo",
      email: D.cfg.email || "",
      token: D.cfg.token || "",
    });
    if (!j || !j.ok) {
      box.textContent = "";
      box.appendChild(
        el(
          "div",
          { class: "empty" },
          "No pude traerlo. Puede que falte publicar la versión nueva del servidor.",
        ),
      );
      return;
    }
    MUNDO = j.mundo || [];
    renderMundo();
  } catch (e) {
    box.textContent = "";
    box.appendChild(el("div", { class: "empty" }, "Sin conexión con el servidor."));
  }
}
function renderMundo() {
  const box = $("#mundoList");
  box.textContent = "";
  if (!MUNDO.length) {
    box.appendChild(
      el(
        "div",
        { class: "empty" },
        "La planilla todavía no tiene nada. Corré “correrRadar” en el Apps Script.",
      ),
    );
    return;
  }
  MUNDO.slice(0, 25).forEach((m) => {
    box.appendChild(
      el(
        "div",
        { class: "item" },
        el(
          "div",
          { class: "thumb", style: "background:var(--deep-soft);font-size:15px" },
          String(m.puesto || "·"),
        ),
        el(
          "div",
          { class: "info" },
          el("b", { style: "white-space:normal" }, m.nome),
          el(
            "span",
            {},
            [m.fuente, m.creador, m.likes ? m.likes + " me gusta" : ""].filter(Boolean).join(" · "),
          ),
        ),
        el(
          "button",
          {
            class: "btn ghost mini",
            onclick: () => {
              const idea = {
                id: uid(),
                nome: m.nome,
                fuente: m.fuente || "Thingiverse",
                pais: "Mundo",
                link: m.link || "",
                nota: "Salió del radar automático. Ver si tiene sentido para el colegio.",
                emoji: "💡",
                desde: hoy(),
                estado: "anotada",
                visto: [mesDe(hoy())],
                origen: "auto",
                hist: [hoy() + ": Anotada (radar automático)"],
              };
              D.radar.push(idea);
              save();
              renderRad();
              toast("Anotada en el radar.");
            },
          },
          "Anotar",
        ),
        m.link
          ? el(
              "button",
              {
                class: "btn ghost mini verlink",
                onclick: () => window.open(m.link, "_blank", "noopener"),
              },
              "↗",
            )
          : null,
      ),
    );
  });
}

/* ----- textos listos para publicar ----- */
/** El post sale de lo que ella ya escribió en la pieza. Nada nuevo que inventar. */
function textoPost(p) {
  const r = calc(p);
  const frase = (p.desc || "").trim();
  let t = (p.nome || "") + "\n\n";
  if (frase) t += frase + "\n\n";
  if (p.libre) t += "Elegís el color 🎨\n";
  t += "$" + Math.round(r.preco).toLocaleString("es-AR") + "\n";
  t += "La hago a pedido. Escribime y te la preparo.";
  if (D.cfg.catalogo) t += "\n\nCatálogo completo: " + D.cfg.catalogo;
  return t;
}
function copiarPost(p) {
  if (!p.desc) {
    toast("Primero escribí la frase de la pieza.");
    cargarPieza(p);
    showTab("calc");
    $("#c_desc").focus();
    return;
  }
  copy(textoPost(p));
}
function verPost(p) {
  const b = $("#sheetBody");
  b.textContent = "";
  b.appendChild(el("h2", {}, "Post de " + (p.nome || "la pieza")));
  b.appendChild(
    el(
      "p",
      { class: "hint" },
      "Copialo y pegalo en Instagram, en el estado de WhatsApp o en el grupo. Acordate de subir la foto o el video.",
    ),
  );
  const ta = el("textarea", { rows: "9" });
  ta.value = textoPost(p);
  b.appendChild(ta);
  b.appendChild(
    el(
      "div",
      { class: "acts", style: "margin-top:12px" },
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            copy(ta.value);
            cerrarSheet();
          },
        },
        "Copiar",
      ),
      el("button", { class: "btn ghost", onclick: cerrarSheet }, "Cerrar"),
    ),
  );
  $("#sheet").classList.add("on");
}

/* ----- capturar una idea desde afuera ----- */
/** Cuando compartís algo al app, Android manda título, texto y link acá. */
/** Si venís del catálogo con ?pieza=Nombre, abrimos esa ficha. */
var MODO_VENTA = (function () {
  try {
    var q = new URLSearchParams(location.search);
    if (q.get("modo") === "venta") {
      localStorage.setItem("pm3d_modo", "venta");
      return true;
    }
    if (q.get("modo") === "todo") {
      localStorage.removeItem("pm3d_modo");
      return false;
    }
    return localStorage.getItem("pm3d_modo") === "venta";
  } catch (e) {
    return false;
  }
})();
var PIEZA_PENDIENTE = (function () {
  try {
    return new URLSearchParams(location.search).get("pieza") || "";
  } catch (e) {
    return "";
  }
})();
function abrirPiezaDeLaUrl() {
  if (!PIEZA_PENDIENTE) return;
  const q = PIEZA_PENDIENTE;
  const norm = (x) =>
    String(x || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const p = D.produtos.find((x) => norm(x.nome) === norm(q));
  if (!p) return; // puede que los datos aún no hayan llegado
  PIEZA_PENDIENTE = "";
  history.replaceState({}, "", location.pathname);
  cargarPieza(p);
  showTab("calc");
}
function ideaCompartida() {
  const p = new URLSearchParams(location.search);
  const url = p.get("url") || "",
    txt = p.get("text") || "",
    tit = p.get("title") || "";
  if (!url && !txt && !tit) return false;
  // a veces el link viene metido dentro del texto
  const enTexto = (txt.match(/https?:\/\/\S+/) || [])[0] || "";
  const link = url || enTexto;
  let nome = (tit || txt.replace(enTexto, "") || "").trim().slice(0, 90);
  if (!nome && link) {
    try {
      nome = decodeURIComponent(link.split("/").filter(Boolean).pop())
        .replace(/[-_+]/g, " ")
        .slice(0, 90);
    } catch (e) {}
  }
  const fuente = fuenteDe(link);
  history.replaceState({}, "", location.pathname);
  elegirDestino(nome, link, fuente, txt);
  return true;
}

/** Lo que llega de afuera puede ser una idea para después, o una pieza que ya va a imprimir. */
function elegirDestino(nome, link, fuente, txt) {
  const b = $("#sheetBody");
  b.textContent = "";
  b.appendChild(el("h2", {}, "¿Qué hacemos con esto?"));
  b.appendChild(el("p", { class: "hint" }, nome || link));
  b.appendChild(
    el(
      "div",
      { style: "display:grid;gap:9px;margin-top:14px" },
      el(
        "button",
        {
          class: "btn wide",
          onclick: () => {
            cerrarSheet();
            crearPiezaDesdeLink(nome, link);
          },
        },
        "La voy a imprimir — crear pieza",
      ),
      el(
        "button",
        {
          class: "btn ghost wide",
          onclick: () => {
            cerrarSheet();
            showTab("rad");
            abrirIdea({
              id: uid(),
              nome: nome || "",
              fuente: fuente,
              pais: "",
              desde: hoy(),
              estado: "anotada",
              nota: txt && txt !== nome ? String(txt).slice(0, 300) : "",
              link: link,
              emoji: "💡",
              potencial: "",
              visto: [mesDe(hoy())],
              origen: "propia",
              nueva: true,
            });
          },
        },
        "Todavía no — anotar como idea",
      ),
      el("button", { class: "btn ghost wide", onclick: cerrarSheet }, "Nada, cerrar"),
    ),
  );
  $("#sheet").classList.add("on");
}

function crearPiezaDesdeLink(nome, link) {
  cargarPieza(null);
  $("#c_nome").value = nome || "";
  $("#c_ref").value = link || "";
  renderCalc();
  showTab("calc");
  $("#c_peso").focus();
  toast("Poné peso y tiempo del slicer.");
}
function fuenteDe(link) {
  const l = String(link || "").toLowerCase();
  if (l.includes("makerworld")) return "MakerWorld";
  if (l.includes("printables")) return "Printables";
  if (l.includes("thingiverse")) return "Thingiverse";
  if (l.includes("etsy")) return "Etsy";
  if (l.includes("tiktok")) return "TikTok";
  if (l.includes("instagram")) return "Instagram";
  if (l.includes("youtube") || l.includes("youtu.be")) return "YouTube";
  if (l.includes("mercadolibre")) return "Mercado Libre";
  if (l.includes("amazon")) return "Amazon";
  return "";
}
/** Para iPhone y para cuando se copia el link a mano. */
async function pegarLink() {
  let t = "";
  try {
    t = await navigator.clipboard.readText();
  } catch (e) {}
  const link = (String(t).match(/https?:\/\/\S+/) || [])[0] || "";
  if (!link) {
    toast("Copiá primero el link y volvé a tocar acá.");
    return;
  }
  let nome = "";
  try {
    nome = decodeURIComponent(link.split("/").filter(Boolean).pop())
      .replace(/[-_+]/g, " ")
      .slice(0, 90);
  } catch (e) {}
  elegirDestino(nome, link, fuenteDe(link), "");
}

/* ----- pegar el radar del mes ----- */
function abrirPegar() {
  const b = $("#sheetBody");
  b.textContent = "";
  b.appendChild(el("h2", {}, "Pegar el radar del mes"));
  b.appendChild(
    el(
      "p",
      { class: "hint" },
      "Pegá acá el texto del radar. Las ideas que ya estaban se marcan como “se mantiene”; las que no vuelven a aparecer, como “salió del radar”.",
    ),
  );
  const ta = el("textarea", { rows: "9", placeholder: '{"mes":"2026-09","ideas":[…]}' });
  b.appendChild(ta);
  const info = el("p", { class: "mut", style: "margin:9px 0 0" });
  b.appendChild(info);
  b.appendChild(
    el(
      "div",
      { class: "acts", style: "margin-top:12px" },
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            const r = importarRadar(ta.value);
            info.textContent = r.msg;
            if (r.ok) {
              toast(r.msg);
              cerrarSheet();
            }
          },
        },
        "Cargar",
      ),
      el("button", { class: "btn ghost", onclick: cerrarSheet }, "Cancelar"),
    ),
  );
  $("#sheet").classList.add("on");
}

/** Acepta el JSON del radar, con o sin las comillas de código alrededor. */
function importarRadar(txt) {
  let t = String(txt || "")
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  if (!t) return { ok: false, msg: "No pegaste nada." };
  let d;
  try {
    d = JSON.parse(t);
  } catch (e) {
    return {
      ok: false,
      msg: "Ese texto no se entiende. Pegá el radar completo, desde la primera llave hasta la última.",
    };
  }
  const mes = String(d.mes || mesDe(hoy())).slice(0, 7);
  const ideas = Array.isArray(d.ideas) ? d.ideas : Array.isArray(d) ? d : null;
  if (!ideas) return { ok: false, msg: "No encontré la lista de ideas." };

  let nuevas = 0,
    repetidas = 0;
  const norm = (x) =>
    String(x || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  ideas.forEach((x) => {
    if (!x || !x.nome) return;
    const ya = D.radar.find((v) => norm(v.nome) === norm(x.nome));
    if (ya) {
      ya.visto = ya.visto || [mesDe(ya.desde)];
      if (ya.visto.indexOf(mes) < 0) ya.visto.push(mes);
      ya.visto.sort();
      if (x.potencial) ya.potencial = x.potencial;
      if (x.link && !ya.link) ya.link = x.link;
      if (x.nota) ya.nota = x.nota;
      repetidas++;
    } else {
      D.radar.push({
        id: uid(),
        nome: x.nome,
        fuente: x.fuente || "",
        pais: x.pais || "",
        potencial: x.potencial || "",
        link: x.link || "",
        nota: x.nota || "",
        emoji: x.emoji || "💡",
        desde: mes + "-01",
        estado: "anotada",
        visto: [mes],
        origen: "radar",
        hist: [mes + "-01: Anotada (radar de " + mesCorto(mes + "-01") + ")"],
      });
      nuevas++;
    }
  });
  save();
  renderRad();
  return { ok: true, msg: nuevas + " ideas nuevas, " + repetidas + " que se mantienen." };
}

/** Primer radar: agosto 2026. Se puede tocar más de una vez: no duplica. */
function cargarRadarAgosto() {
  var ideas = [
    {
      nome: "Flexi animales chiquitos (axolote, dragón, gato)",
      emoji: "\ud83d\udc09",
      fuente: "Etsy · MakerWorld",
      pais: "Mundo",
      potencial: "USD 8-14",
      link: "https://makerworld.com/en/search/models?keyword=flexi%20animal",
      nota: "Es la categoría que más vende afuera, y se vende en packs de varios animalitos, no de a uno. Imprime en una pieza, sin armar. Para ella: probar un pack de 3 chiquitos a precio de uno mediano.",
    },
    {
      nome: "Llavero flexi (axolote o serpiente)",
      emoji: "\ud83d\udd11",
      fuente: "Etsy",
      pais: "EE.UU.",
      potencial: "USD 7-9",
      link: "https://makerworld.com/en/search/models?keyword=flexi%20keychain",
      nota: "Une las dos cosas que ya funcionan: llavero y flexi. Poco filamento, poco tiempo, y sirve de muestra colgada en la mochila. Publicidad andante en el colegio.",
    },
    {
      nome: "Llavero con nombre personalizado",
      emoji: "\u270f\ufe0f",
      fuente: "Etsy",
      pais: "EE.UU.",
      potencial: "USD 7",
      link: "https://www.printables.com/search/models?q=name%20keychain",
      nota: "Vende por volumen y el nombre propio permite cobrar más. En un colegio es ideal: cada compañera quiere el suyo. Ojo con el tiempo de diseño por unidad.",
    },
    {
      nome: "Llavero de equipo de fútbol",
      emoji: "\u26bd",
      fuente: "MakerWorld",
      pais: "Mundo",
      potencial: "—",
      link: "https://makerworld.com/en/search/models?keyword=football%20keychain",
      nota: "Categoría que más creció este año en MakerWorld. En Argentina es terreno fértil. CUIDADO: escudos de clubes son marca registrada; hacer versiones propias con los colores, no copias del escudo.",
    },
    {
      nome: "Fidget de jugador que patea la pelota",
      emoji: "\ud83e\uddf8",
      fuente: "Mayoristas AR",
      pais: "Argentina",
      potencial: "—",
      link: "https://makerworld.com/en/search/models?keyword=soccer%20fidget",
      nota: "Se vende en jugueterías argentinas como producto de impulso: chiquito, barato, se aprieta y patea. Formato que funciona en mostrador y en recreo.",
    },
    {
      nome: "Cubo infinito / cubo que cambia de forma",
      emoji: "\ud83e\uddca",
      fuente: "Amazon · MakerWorld",
      pais: "EE.UU.",
      potencial: "USD 10-25",
      link: "https://makerworld.com/en/search/models?keyword=infinity%20cube",
      nota: "Impresiona mucho más de lo que cuesta imprimir: sin soportes, sin armado. Buen candidato para peça de mayor precio dentro del catálogo.",
    },
    {
      nome: "Piedras de la calma texturadas",
      emoji: "\ud83e\udea8",
      fuente: "Amazon",
      pais: "EE.UU.",
      potencial: "USD 1-2 c/u en pack",
      link: "https://www.printables.com/search/models?q=worry%20stone",
      nota: "Muy vendidas en packs para aulas. Diminutas, rapidísimas de imprimir. La oportunidad no es la pieza: es el pack de 6 con bolsita.",
    },
    {
      nome: "Portalápices y organizadores del escritorio",
      emoji: "\ud83d\uddc2\ufe0f",
      fuente: "Etsy · Printables",
      pais: "Mundo",
      potencial: "—",
      link: "https://www.printables.com/search/models?q=pencil%20holder",
      nota: "Decoración útil, buen margen porque el valor percibido es alto. Ya está en el catálogo del PPT: vale la pena probarlo en serio.",
    },
    {
      nome: "Fidget dumpling / comida kawaii con estuche",
      emoji: "\ud83e\udd5f",
      fuente: "Etsy",
      pais: "EE.UU.",
      potencial: "—",
      link: "https://makerworld.com/en/search/models?keyword=kawaii%20fidget",
      nota: "Tendencia nueva, todavía poco vista acá. Es de las que más pueden sorprender en el colegio justamente porque nadie la tiene.",
    },
    {
      nome: "Set de dados y miniaturas de fantasía",
      emoji: "\ud83c\udfb2",
      fuente: "MakerWorld",
      pais: "Mundo",
      potencial: "—",
      link: "https://www.printables.com/search/models?q=dice%20box",
      nota: "Fuerte crecimiento global, pero público adolescente/adulto de juegos de mesa. Para ella sirve sólo si hay chicos que jueguen a eso en el club.",
    },
  ];
  var r = importarRadar(JSON.stringify({ mes: "2026-08", ideas: ideas }));
  showTab("rad");
  toast(r.msg);
}

/* ---------- punto de venta ---------- */
var POS = {},
  POS_FORMA = "efectivo";

function abrirPOS() {
  POS = {};
  POS_FORMA = "efectivo";
  $("#posCliente").value = "";
  $("#posQ").value = "";
  $("#posQ").value = "";
  document
    .querySelectorAll("#posFormas button")
    .forEach((b) => b.classList.toggle("on", b.dataset.forma === "efectivo"));
  pintarPOS();
  $("#pos").hidden = false;
}
function salirModoVenta() {
  try {
    localStorage.removeItem("pm3d_modo");
  } catch (e) {}
  location.href = "/app/?modo=todo";
}
function cerrarPOS() {
  $("#pos").hidden = true;
  if (MODO_VENTA) showTab("ven");
}

function pintarPOS() {
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
  // primero las elegidas, después las que hay hechas
  const lista = D.produtos
    .filter(
      (p) =>
        !q || (p.nome || "").toLowerCase().includes(q) || (p.cat || "").toLowerCase().includes(q),
    )
    .sort(
      (a, b) =>
        (num(POS[b.id]) > 0 ? 1 : 0) - (num(POS[a.id]) > 0 ? 1 : 0) ||
        (num(b.stock) > 0 ? 1 : 0) - (num(a.stock) > 0 ? 1 : 0),
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
    t.appendChild(im);
    const hay = num(p.stock);
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
function totalPOS() {
  let n = 0,
    t = 0;
  for (const id in POS) {
    const p = prod(id);
    if (!p) continue;
    n += POS[id];
    t += calc(p).preco * POS[id];
  }
  $("#posCant").textContent = n ? n + (n === 1 ? " pieza" : " piezas") : "Elegí las piezas";
  $("#posTotal").textContent = money(t);
  return { n, t };
}
function cobrar() {
  const { n, t } = totalPOS();
  if (!n) {
    toast("Elegí al menos una pieza.");
    return;
  }
  const itens = [],
    items = [];
  for (const id in POS) {
    const p = prod(id);
    if (!p) continue;
    const r = calc(p);
    itens.push({ id: p.id, nome: p.nome, qtd: POS[id], preco: r.preco, custo: r.custo });
    items.push({ p, q: POS[id] });
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
    desconto: 0,
    envio: 0,
    comision: 0,
    total: t,
    custo: costo,
    lucro: t - costo,
    pago: true,
    entregue: true,
    consumo: null,
  };

  // si había piezas hechas, se descuentan; si no, se descuenta el material
  const faltantes = [];
  items.forEach(({ p, q }) => {
    const hay = Math.min(num(p.stock), q);
    p.stock = num(p.stock) - hay;
    if (q - hay > 0) faltantes.push({ p, q: q - hay });
  });
  if (faltantes.length) {
    const c = consumoDe(faltantes);
    aplicarConsumo(c, -1);
    v.consumo = c;
    v.sinStock = faltantes.map((f) => f.q + "x " + f.p.nome).join(", ");
  }

  D.vendas.unshift(v);
  save();
  renderAll();
  cerrarPOS();
  toast(
    v.sinStock
      ? "Venta de " + money(t) + ". Anotada como fuera de stock."
      : "Venta de " + money(t) + " registrada.",
  );
}

/* ---------- ventas ---------- */
function renderVen() {
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
        { class: "item" },
        el(
          "div",
          { class: "info", onclick: () => abrirVenta(v) },
          el("b", {}, v.cliente),
          el(
            "span",
            {},
            v.data +
              (v.forma ? " · " + v.forma : "") +
              " · " +
              (v.itens || []).reduce((a, i) => a + num(i.qtd), 0) +
              " piezas",
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
          el(
            "span",
            {},
            v.pago
              ? el("i", { class: "pill g", style: "font-style:normal" }, "cobrada")
              : el("i", { class: "pill y", style: "font-style:normal" }, "a cobrar"),
          ),
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
              aplicarConsumo(v.consumo, 1);
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
function cerrarSheet() {
  $("#sheet").classList.remove("on");
}
$("#sheet").addEventListener("click", (e) => {
  if (e.target.id === "sheet") cerrarSheet();
});

/* ---------- ajustes ---------- */
var CFG_ATADO = false;
function bindCfg() {
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
function renderAccesos() {
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
function renderCfgLists() {
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
              if (!confirm("¿Quitar este filamento?")) return;
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
const addFil = () => {
  D.filamentos.push({
    id: uid(),
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
};
const addIns = () => {
  D.insumos.push({ id: uid(), nome: "Insumo nuevo", pack: 1000, unid: 10, stock: 10 });
  save();
  renderAll();
};
const addOpi = () => {
  D.opiniones.push({ id: uid(), quien: "", pieza: "", texto: "", visible: true, fecha: hoy() });
  save();
  renderAll();
};
const addPack = () => {
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
const addCanal = () => {
  D.canais.push({ id: uid(), nome: "Canal", comision: 0 });
  save();
  renderAll();
};
const addImp = () => {
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

/* ---------- entrada ---------- */
async function probarLogin(email, clave) {
  try {
    const r = await fetch(SERVIDOR, {
      method: "POST",
      body: JSON.stringify({ action: "login", email: email, clave: clave }),
    });
    const j = await r.json();
    // La clave viaja una sola vez, acá. Después se usa el token de sesión.
    return j && j.ok
      ? { ok: true, usuario: j.usuario || "", token: j.token || "" }
      : { ok: false, error: (j && j.error) || "clave" };
  } catch (e) {
    return { ok: false, error: "red" };
  }
}
function mostrarEntrada() {
  const lg = $("#entLogo");
  if (D.cfg.logo) lg.src = D.cfg.logo;
  else lg.removeAttribute("src");
  $("#entrada").hidden = false;
  $("#entMail").value = D.cfg.email || "";
  setTimeout(() => {
    (D.cfg.email ? $("#entClave") : $("#entMail")).focus();
  }, 150);
}
async function entrar() {
  const email = $("#entMail").value.trim(),
    clave = $("#entClave").value.trim();
  const err = $("#entErr"),
    btn = $("#entBtn");
  err.hidden = true;
  if (!clave) {
    err.textContent = "Falta la clave.";
    err.hidden = false;
    return;
  }
  btn.disabled = true;
  btn.textContent = "Entrando…";
  const r = await probarLogin(email, clave);
  btn.disabled = false;
  btn.textContent = "Entrar";
  if (!r.ok) {
    err.textContent =
      r.error === "red"
        ? "No pude conectar. Probá de nuevo en un momento."
        : "Ese mail o esa clave no coinciden.";
    err.hidden = false;
    return;
  }
  D.cfg.email = email;
  D.cfg.token = r.token; // token de sesión: la clave no se guarda en el equipo
  D.cfg.api = SERVIDOR;
  await local.set(D);
  $("#entrada").hidden = true;
  await sincronizarAlAbrir();
}
/** La clave guardada dejó de servir (la cambiaron en el servidor). */
function claveVencida() {
  setSync("err", "Hay que entrar de nuevo");
  D.cfg.token = "";
  local.set(D);
  listoParaSubir = false;
  const err = $("#entErr");
  mostrarEntrada();
  if (err) {
    err.textContent = "La clave cambió. Entrá otra vez.";
    err.hidden = false;
  }
}
function salir() {
  if (!confirm("¿Cerrar sesión en este equipo? Los datos siguen en la nube.")) return;
  // avisamos al servidor para que ese token deje de servir aunque quede copiado
  try {
    pedir({ action: "logout", token: D.cfg.token || "" });
  } catch (e) {}
  D.cfg.token = "";
  local.set(D);
  try {
    localStorage.removeItem("pm3d_admin");
    localStorage.removeItem("pm3d_clave");
  } catch (e) {}
  location.reload();
}

/* ---------- nube ---------- */
/** Todo lo privado va por POST: así ni la clave ni el token quedan en la URL.
    Sin encabezados propios, para no disparar el preflight de CORS. */
async function pedir(cuerpo) {
  const url = (D.cfg.api || SERVIDOR || "").trim();
  if (!url) throw new Error("sin servidor");
  const r = await fetch(url, { method: "POST", body: JSON.stringify(cuerpo) });
  return await r.json();
}
let syncTimer = null;
function setSync(state, txt) {
  const b = $("#syncBox");
  b.className = "sync" + (state ? " " + state : "");
  $("#syncTxt").textContent = txt;
}
let reintentoTimer = null;
let avisoSyncPendiente = false;
/** Si quedó algo sin subir (por ej. sin señal), reintenta solo más tarde. */
function programarReintento() {
  if (reintentoTimer) return;
  reintentoTimer = setTimeout(() => {
    reintentoTimer = null;
    if (D._sucio && listoParaSubir) subirALaNube();
  }, 20000);
}
window.addEventListener("online", () => {
  if (D._sucio && listoParaSubir) subirALaNube();
});
async function subirALaNube() {
  const url = (D.cfg.api || "").trim();
  if (!url) return;
  if (!listoParaSubir) {
    setSync("err", "Esperando traer lo de la nube");
    return;
  }
  try {
    setSync("", "Guardando…");
    const r = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        email: D.cfg.email || "",
        token: D.cfg.token || "",
        data: D,
      }),
    });
    const j = await r.json();
    if (j && j.ok) {
      if (j.data && j.data.produtos) {
        // cambiamos las fotos pesadas por los links que ya guardó el servidor
        j.data.produtos.forEach(function (np) {
          var p = D.produtos.find(function (x) {
            return x.id === np.id;
          });
          if (!p || !np.fotos) return;
          // sólo si la lista sigue teniendo el mismo largo: si editaste mientras subía, no tocamos nada
          var mias = p.fotos && p.fotos.length ? p.fotos : p.foto ? [p.foto] : [];
          if (mias.length !== np.fotos.length) return;
          var nuevas = mias.map(function (f, i) {
            return String(f).indexOf("data:image") === 0 &&
              String(np.fotos[i]).indexOf("http") === 0
              ? np.fotos[i]
              : f;
          });
          p.fotos = nuevas;
          p.foto = nuevas[0];
        });
        if (j.data.cfg && j.data.cfg.logo) D.cfg.logo = j.data.cfg.logo;
        local.set(D);
        if (editId) {
          var act = prod(editId);
          if (act && act.fotos && act.fotos.length === fotosTmp.length) {
            fotosTmp = fotosTmp.map(function (f, i) {
              return String(f).indexOf("data:image") === 0 &&
                String(act.fotos[i]).indexOf("http") === 0
                ? act.fotos[i]
                : f;
            });
            pintarFoto();
          }
        }
        renderCat();
        renderVit();
      }
      D._sucio = false;
      avisoSyncPendiente = false;
      local.set(D);
      setSync(
        "on",
        "En la nube · " +
          new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      );
    } else if (j && j.error === "clave") {
      claveVencida();
    } else {
      setSync("err", "Error al guardar");
      if (!avisoSyncPendiente) {
        avisoSyncPendiente = true;
        toast("No pude guardar en la nube. Se va a reintentar solo.");
      }
      programarReintento();
    }
  } catch (e) {
    setSync("err", "No se pudo guardar");
    if (!avisoSyncPendiente) {
      avisoSyncPendiente = true;
      toast("No pude guardar en la nube. Se va a reintentar solo.");
    }
    programarReintento();
  }
}
/** Botón manual: si hay algo sin subir todavía, avisa antes de pisarlo. */
async function traerDeLaNubeManual() {
  if (
    D._sucio &&
    !confirm(
      "Hay cambios acá que todavía no se subieron a la nube (por ej. una venta). " +
        "Si traés la nube ahora, se pierden. ¿Traer igual?",
    )
  )
    return;
  await bajarDeLaNube();
}
async function subirAhora() {
  if (!D.cfg.api) {
    toast("Primero conectá el servidor.");
    return;
  }
  listoParaSubir = true;
  await subirALaNube();
}
async function bajarDeLaNube() {
  const url = (D.cfg.api || "").trim();
  if (!url) {
    toast("Primero pegá la dirección del servidor.");
    return;
  }
  try {
    setSync("", "Trayendo…");
    const j = await pedir({
      action: "load",
      email: D.cfg.email || "",
      token: D.cfg.token || "",
    });
    if (j && j.ok && j.data && j.data.cfg) {
      const api = D.cfg.api,
        tk = D.cfg.token;
      D = Object.assign(defaults(), j.data);
      D.cfg.api = api;
      D.cfg.token = tk;
      if (!D.cfg.leti) D.cfg.leti = { cita: "", historia: "", foto: "" };
      migrarInsumos();
      await local.set(D);
      cargarPieza(null);
      bindCfg();
      renderAll();
      pintarMarca();
      pintarLeti();
      listoParaSubir = true;
      setSync("on", "En la nube");
      toast("Datos traídos de la nube.");
      abrirPiezaDeLaUrl();
      if (MODO_VENTA) {
        showTab("ven");
        abrirPOS();
      }
    } else if (j && j.error === "clave") {
      claveVencida();
    } else {
      listoParaSubir = true;
      setSync("err", "No había datos guardados");
      toast("El servidor todavía no tiene datos.");
    }
  } catch (e) {
    setSync("err", "Sin conexión");
    toast("No se pudo conectar.");
  }
}
/**
 * Se llama al abrir la app o al entrar. Si hay algo grabado acá que todavía
 * no llegó a la nube (por ej. una venta con el celular sin señal), lo sube
 * primero: bajar de la nube en ese momento pisaría eso sin avisar.
 */
async function sincronizarAlAbrir() {
  listoParaSubir = false;
  if (D._sucio) {
    setSync("", "Subiendo cambios pendientes…");
    listoParaSubir = true;
    await subirALaNube();
  }
  if (D._sucio) {
    setSync("err", "Sin subir · va a reintentar solo");
    if (MODO_VENTA) {
      showTab("ven");
      abrirPOS();
    }
    return;
  }
  setSync("", "Trayendo de la nube…");
  await bajarDeLaNube();
}
var listoParaSubir = false; // recién true cuando ya bajamos lo que hay en la nube
function save() {
  D._sucio = true;
  local.set(D);
  if (D.cfg.api && listoParaSubir) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(subirALaNube, 1500);
  }
}
function exportar() {
  const copia = JSON.parse(JSON.stringify(D));
  copia.cfg.token = "";
  copia.cfg.api = ""; // la clave no viaja en el archivo
  const b = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(b), download: "playmind3d-" + hoy() + ".json" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Copia descargada.");
}
$("#fImp").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d.cfg) throw 0;
      const api = D.cfg.api,
        tk = D.cfg.token;
      D = Object.assign(defaults(), d);
      D.cfg.api = api;
      D.cfg.token = tk;
      if (!D.cfg.leti) D.cfg.leti = { cita: "", historia: "", foto: "" };
      migrarInsumos();
      cargarPieza(null);
      bindCfg();
      save();
      renderAll();
      pintarMarca();
      pintarLeti();
      toast("Copia restaurada.");
    } catch (err) {
      toast("Ese archivo no sirve.");
    }
  };
  rd.readAsText(f);
  e.target.value = "";
});

/* ---------- plumbing ---------- */
function renderLight() {
  renderCat();
  renderPed();
  renderVen();
  renderVit();
  renderRad();
  renderCalc();
}
function renderAll() {
  const kf = $("#c_fil").value,
    ki = $("#c_imp").value;
  fillSel(
    $("#c_fil"),
    D.filamentos.map((f) => ({
      id: f.id,
      nome: (f.marca ? f.marca + " " : "") + f.nome + (f.cor ? " · " + f.cor : ""),
    })),
    kf,
  );
  fillSel($("#c_imp"), D.impressoras, ki);
  insumosInputs(insumosSel);
  renderAccesos();
  renderCfgLists();
  renderCat();
  renderPed();
  renderVen();
  renderVit();
  renderRad();
  renderCalc();
}
let tId;
function toast(m) {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("on");
  clearTimeout(tId);
  tId = setTimeout(() => t.classList.remove("on"), 1800);
}
function showTab(n) {
  document
    .querySelectorAll("nav.tabs button")
    .forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === n)));
  ["cat", "calc", "ped", "vit", "rad", "ven", "cfg"].forEach((t) => {
    $("#tab-" + t).hidden = t !== n;
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}
document
  .querySelectorAll("nav.tabs button")
  .forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
["qFil", "qIns"].forEach((id) => $("#" + id).addEventListener("input", renderCfgLists));
$("#radMes").addEventListener("change", renderRad);
$("#entBtn").addEventListener("click", entrar);
$("#posCobrar").addEventListener("click", cobrar);
$("#posQ").addEventListener("input", pintarPOS);
$("#posQ").addEventListener("input", pintarPOS);
document.querySelectorAll("#posFormas button").forEach((b) =>
  b.addEventListener("click", () => {
    POS_FORMA = b.dataset.forma;
    document
      .querySelectorAll("#posFormas button")
      .forEach((x) => x.classList.toggle("on", x === b));
  }),
);
$("#entClave").addEventListener("keydown", (e) => {
  if (e.key === "Enter") entrar();
});
$("#radOrigen").addEventListener("change", renderRad);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

(async function init() {
  const s = await local.get();
  if (s && s.cfg) D = Object.assign(defaults(), s);
  if (!D.cfg.logo) D.cfg.logo = LOGO;
  /* migración: logos base64 gigantes rompían el guardado (celda de Sheets = 50.000 chars) */
  if (typeof D.cfg.logo === "string" && D.cfg.logo.startsWith("data:") && D.cfg.logo.length > 50000)
    D.cfg.logo = LOGO;
  migrarInsumos();
  if (!D.pedidoFil) D.pedidoFil = {};
  if (!D.radar) D.radar = [];
  if (!D.packs) D.packs = [];
  if (!D.opiniones) D.opiniones = [];
  if (!D.cfg.leti) D.cfg.leti = { cita: "", historia: "", foto: "" };
  if (D.cfg.merma === undefined || D.cfg.merma === null) D.cfg.merma = 12;
  if (!D.canais || !D.canais.length) D.canais = defaults().canais;
  bindCfg();
  pintarMarca();
  pintarLeti();
  cargarPieza(null);
  renderAll();
  if (MODO_VENTA) document.body.classList.add("modoventa");
  D.cfg.api = SERVIDOR;
  if (D.cfg.token) {
    await sincronizarAlAbrir();
  } else {
    listoParaSubir = false;
    mostrarEntrada();
  }
  ideaCompartida();
})();
