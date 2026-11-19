"use strict";
import { $, el, uid, num, money, pct, hhmm, ceilTo, hoy, fechaCorta } from "./util.js";
import {
  D,
  reemplazarEstado,
  defaults,
  local,
  SERVIDOR,
  WORKER_CADASTRO,
  LOGO,
  LOGO_FULL,
} from "./estado.js";
import { toast, showTab, renderAll, renderLight } from "./ui.js";
import {
  calc,
  prod,
  gramosCon,
  unitario,
  migrarInsumos,
  proximoNumFil,
} from "./calculo.js";
import { consumoDe, aplicarConsumo, alertasStock } from "./stock.js";
import {
  fotosTmp,
  setFotosTmp,
  leerFoto,
  pintarFoto,
  pintarMarca,
  pintarLeti,
  thumb,
  iniciarFotos,
} from "./fotos.js";
import { renderCat, chgQty, sumarStock } from "./catalogo.js";
import {
  editId,
  nuevaPieza,
  cargarPieza,
  fillSel,
  abrirInsumos,
  renderCalc,
  buscarMercado,
  gastoSinVenta,
  addAlPedido,
  iniciarEditor,
} from "./editor.js";
import {
  iniciarPedido,
  mandarWA,
  registrarVenta,
  vaciarPedido,
  compartirPresupuesto,
  descargarPresupuesto,
  enviarPresupuesto,
} from "./pedido.js";
import {
  abrirPOS,
  cerrarPOS,
  salirModoVenta,
  cobrar,
  pintarBotonCobrar,
  pintarPOS,
  totalPOS,
  setPosForma,
} from "./pos.js";
import { renderVit, compartirVitrina, bajarVitrina } from "./vitrina.js";

iniciarFotos();
iniciarEditor();
iniciarPedido();

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

export function renderRad() {
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
export function verPost(p) {
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
export var MODO_VENTA = (function () {
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

/* ---------- cadastro por chat ---------- */
var CHAT = {
  historial: [], // [{role:'user'|'model', texto}]
  foto: null, // data URL completa ("data:image/jpeg;base64,...") o null
  contextoMakerWorld: null,
  propuesta: null, // últimos campos que el modelo propuso via function call
  acao: null, // nombre de la función que propuso (cadastrar_peca, etc)
  saludo: "", // el "hola" de entrada: se dibuja, pero no viaja en el historial
  pensando: false, // esperando respuesta: se dibuja la burbuja de puntitos
  error: "", // último fallo. Se muestra, pero NO entra al historial: si
  // entrara, en el turno siguiente el modelo leería "hubo un error" como algo
  // que dijo él y se pondría a responder sobre eso.
};

/** El nombre viene del login; si la sesión es vieja y no lo tiene guardado,
    se saca del mail antes del arroba. Vacío si no hay ninguno de los dos. */
function nombreUsuario() {
  const n = String(D.cfg.usuario || "").trim();
  if (n) return n.split(/\s+/)[0];
  const mail = String(D.cfg.email || "").trim();
  if (!mail) return "";
  const antes = mail.split("@")[0].replace(/[._\-0-9]+/g, " ").trim();
  if (!antes) return "";
  return antes.charAt(0).toUpperCase() + antes.slice(1);
}

/** Se arma acá y no se le pide al Gemini: gastar un pedido de la cuota y
    hacer esperar dos segundos para decir "hola" no tiene sentido. */
function saludoMind() {
  const h = new Date().getHours();
  const momento = h < 12 ? "buen día" : h < 19 ? "buenas tardes" : "buenas noches";
  const quien = nombreUsuario();
  return (
    "¡Hola, " +
    momento +
    (quien ? ", " + quien : "") +
    "! Soy la Mind, tu asistente. ¿En qué te puedo ayudar hoy?"
  );
}

/* Las acciones que tocan piezas/ventas se ejecutan acá, no en el servidor:
   así reusan las mismas funciones que la app ya usa a mano (sumarStock,
   aplicarVenta, calc) en vez de tener una segunda copia de esa lógica en
   Codigo.gs, y el estado del cliente sigue siendo el que manda — un save
   posterior no pisa lo que el servidor hubiera escrito por su cuenta.
   Cada una devuelve el texto que se le muestra al usuario en el chat. */
function piezaPorNombre(nome) {
  const norm = (x) =>
    String(x || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return D.produtos.find((p) => norm(p.nome) === norm(nome)) || null;
}

function accionEditarPieza(a) {
  const p = piezaPorNombre(a.nome);
  if (!p) return 'Não achei nenhuma peça chamada "' + a.nome + '".';
  if (a.descricao != null) p.desc = String(a.descricao);
  if (a.detalhe != null) p.detalle = String(a.detalhe);
  if (a.medida != null) p.medida = String(a.medida);
  if (a.tags != null) p.tags = String(a.tags);
  if (a.categoria != null) p.cat = String(a.categoria);
  save();
  renderAll();
  return "Pronto, " + p.nome + " atualizada.";
}

function accionAjustarStock(a) {
  const p = piezaPorNombre(a.nome);
  if (!p) return 'Não achei nenhuma peça chamada "' + a.nome + '".';
  const n = num(a.quantidade);
  if (!n) return "Preciso de uma quantidade diferente de zero.";
  sumarStock(p, n); // ya descuenta filamento e insumos y avisa por toast
  return "Agora tem " + p.stock + " de " + p.nome + ".";
}

function accionRegistrarVenta(a) {
  const itens = [],
    faltan = [];
  (a.itens || []).forEach((it) => {
    const p = piezaPorNombre(it.nome);
    if (!p) {
      faltan.push(it.nome);
      return;
    }
    const r = calc(p);
    itens.push({ id: p.id, nome: p.nome, qtd: num(it.qtd) || 1, preco: r.preco, custo: r.custo });
  });
  if (faltan.length) return "Não achei estas peças: " + faltan.join(", ") + ". Nada foi registrado.";
  if (!itens.length) return "Nenhuma peça válida na venda.";

  const total = itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  const costo = itens.reduce((s, i) => s + i.custo * i.qtd, 0);
  const canal = D.canais[0] || { id: "" };
  const v = {
    id: uid(),
    data: hoy(),
    cliente: String(a.cliente || "").trim() || "Sin nombre",
    canal: canal.id,
    forma: a.forma === "transferencia" ? "transferencia" : "efectivo",
    itens: itens,
    desconto: 0,
    envio: 0,
    comision: 0,
    total: total,
    custo: costo,
    lucro: total - costo,
    pago: true,
    entregue: true,
    consumo: null,
    desdeStock: true,
    stockUsado: {},
  };
  aplicarVenta(v); // la misma que usa el punto de venta
  D.vendas.unshift(v);
  save();
  renderAll();
  return (
    "Venda de " +
    money(total) +
    " registrada" +
    (v.sinStock ? " (fora de stock: " + v.sinStock + ")" : "") +
    "."
  );
}

const ACCIONES_LOCALES = {
  editar_peca: accionEditarPieza,
  ajustar_estoque: accionAjustarStock,
  registrar_venda: accionRegistrarVenta,
};

const ROTULO_CONFIRMAR = {
  cadastrar_peca: "Confirmar cadastro",
  cadastrar_filamento: "Confirmar filamento",
  editar_peca: "Confirmar correção",
  ajustar_estoque: "Confirmar estoque",
  registrar_venda: "Confirmar venda",
};

function urlBookmarklet() {
  const src = WORKER_CADASTRO + "/bookmarklet.js?" + Date.now();
  return (
    "javascript:(function(){var s=document.createElement('script');s.src=" +
    JSON.stringify(src) +
    ";document.body.appendChild(s);})();"
  );
}

/** Chica o grande: se recuerda mientras dure la sesión, así no hay que
    volver a agrandarla cada vez que se abre el cerebro. */
var MIND_GRANDE = false;
function aplicarTamanoMind() {
  $("#chatCad").classList.toggle("grande", MIND_GRANDE);
  const b = $("#mindExpandir");
  b.textContent = MIND_GRANDE ? "⤡" : "⤢";
  b.title = MIND_GRANDE ? "Achicar" : "Agrandar";
}
function alternarTamanoMind() {
  MIND_GRANDE = !MIND_GRANDE;
  aplicarTamanoMind();
}

function abrirChatCad() {
  CHAT = {
    historial: [],
    foto: null,
    contextoMakerWorld: null,
    propuesta: null,
    acao: null,
    saludo: saludoMind(),
    pensando: false,
    error: "",
  };
  $("#chatInput").value = "";
  pintarFotoChat();
  $("#chatConfirmar").hidden = true;
  const bm = $("#chatBookmarklet");
  if (bm) bm.href = urlBookmarklet();
  aplicarTamanoMind();
  pintarChatMsgs();
  $("#chatCad").hidden = false;
  $("#chatInput").focus();
}
function cerrarChatCad() {
  $("#chatCad").hidden = true;
}

/** El modelo resalta los números escribiendo **así**. Se convierte en <b>
    armando nodos a mano, nunca con innerHTML: ese texto viene del modelo y
    de lo que se scrapeó del MakerWorld, no es nuestro como para confiarle
    HTML. Sin esto se leía el asterisco crudo en pantalla. */
function conNegritas(txt) {
  return String(txt || "")
    .split(/\*\*([\s\S]+?)\*\*/)
    .map((parte, i) => (i % 2 ? el("b", {}, parte) : parte));
}

function pintarChatMsgs() {
  const box = $("#chatMsgs");
  const dica = $("#chatDica");
  if (dica) dica.hidden = !!CHAT.historial.length;
  box.textContent = "";
  // El saludo se dibuja como un mensaje más, pero no está en el historial:
  // ese arranca con el usuario, que es como la API espera la conversación.
  if (CHAT.saludo) box.appendChild(el("div", { class: "chatMsg bot" }, CHAT.saludo));
  CHAT.historial.forEach((h) => {
    const esMio = h.role === "user";
    box.appendChild(
      el("div", { class: "chatMsg " + (esMio ? "eu" : "bot") }, esMio ? h.texto : conNegritas(h.texto)),
    );
  });
  if (CHAT.pensando) box.appendChild(el("div", { class: "chatMsg bot pensando" }, "···"));
  if (CHAT.error) box.appendChild(el("div", { class: "chatErr" }, CHAT.error));
  box.scrollTop = box.scrollHeight;
}

function pintarFotoChat() {
  const caja = $("#chatFoto");
  if (CHAT.foto) $("#chatFotoPrev").src = CHAT.foto;
  caja.hidden = !CHAT.foto;
}
function ponerFotoChat(dataUrl) {
  CHAT.foto = dataUrl;
  pintarFotoChat();
}
function quitarFotoChat() {
  CHAT.foto = null;
  pintarFotoChat();
}

// Dos entradas: la cámara (capture) y el carrete/archivos. En la compu el
// capture se ignora y las dos abren el explorador, que es lo esperable.
["#fChatCam", "#fChatFoto"].forEach((sel) => {
  $(sel).addEventListener("change", (e) => {
    const f = (e.target.files || [])[0];
    e.target.value = ""; // si no, elegir la misma foto dos veces no dispara nada
    if (f) leerFoto(f, ponerFotoChat);
  });
});

/** Ctrl+V con una captura o una foto en el portapapeles. */
$("#chatCad").addEventListener("paste", (e) => {
  const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
  const img = items.find((i) => i.type && i.type.indexOf("image/") === 0);
  if (!img) return; // texto pegado: que siga de largo al input
  const f = img.getAsFile();
  if (!f) return;
  e.preventDefault();
  leerFoto(f, (d) => {
    ponerFotoChat(d);
    toast("Foto pegada.");
  });
});

/** {mimeType, base64} sin el prefijo "data:...;base64," — así lo espera
    inlineData de la API del Gemini. agregarPieza sí quiere la data URL
    completa, por eso se guarda CHAT.foto entero y se corta acá nomás. */
function fotoParaGemini(dataUrl) {
  if (!dataUrl) return null;
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return null;
  return { mimeType: m[1], base64: m[2] };
}

async function enviarChatCad(mensajeForzado) {
  const mensaje = mensajeForzado != null ? mensajeForzado : $("#chatInput").value.trim();
  if (!mensaje && !CHAT.foto) return;

  const historialPrevio = CHAT.historial.slice(); // snapshot antes de este turno
  CHAT.historial.push({ role: "user", texto: mensaje || "(foto adjunta)" });
  $("#chatInput").value = "";
  CHAT.error = "";
  CHAT.pensando = true;
  pintarChatMsgs();

  const btn = $("#chatEnviarBtn");
  btn.disabled = true;
  btn.textContent = "…";
  try {
    const r = await fetch(WORKER_CADASTRO + "/chat", {
      method: "POST",
      body: JSON.stringify({
        token: D.cfg.token || "",
        historial: historialPrevio,
        mensaje,
        foto: fotoParaGemini(CHAT.foto),
        contextoMakerWorld: CHAT.contextoMakerWorld,
      }),
    });
    const j = await r.json();
    if (!j.ok) {
      CHAT.error = "No pude responder: " + (j.error || "error desconocido");
      return;
    }
    CHAT.historial.push({ role: "model", texto: j.texto || "" });
    CHAT.propuesta = j.propuestaCadastro || null;
    CHAT.acao = j.acao || null;
    $("#chatConfirmar").hidden = !CHAT.propuesta;
    $("#chatConfirmar").textContent = ROTULO_CONFIRMAR[CHAT.acao] || "Confirmar";
  } catch (e) {
    CHAT.error = "No pude hablar con el servidor. Probá de nuevo en un momento.";
  } finally {
    CHAT.pensando = false;
    pintarChatMsgs();
    btn.disabled = false;
    btn.textContent = "Enviar";
  }
}

async function confirmarChatCad() {
  if (!CHAT.propuesta) return;
  const btn = $("#chatConfirmar");
  const rotulo = ROTULO_CONFIRMAR[CHAT.acao] || "Confirmar";
  btn.disabled = true;
  btn.textContent = "Salvando…";

  // Editar, ajustar stock y registrar venta se resuelven acá mismo: no
  // necesitan al servidor y el save() de siempre los sincroniza solo.
  const local = ACCIONES_LOCALES[CHAT.acao];
  if (local) {
    let texto;
    try {
      texto = local(CHAT.propuesta);
    } catch (e) {
      texto = "Não consegui fazer isso: " + e.message;
    }
    CHAT.historial.push({ role: "model", texto: texto });
    CHAT.propuesta = null;
    CHAT.acao = null;
    btn.hidden = true;
    btn.disabled = false;
    btn.textContent = rotulo;
    pintarChatMsgs();
    return;
  }

  try {
    const r = await fetch(WORKER_CADASTRO + "/chat", {
      method: "POST",
      body: JSON.stringify({
        token: D.cfg.token || "",
        confirmar: CHAT.propuesta,
        acao: CHAT.acao,
        link: (CHAT.contextoMakerWorld && CHAT.contextoMakerWorld.link) || "",
        foto: fotoParaGemini(CHAT.foto),
      }),
    });
    const j = await r.json();
    if (!j.ok) {
      toast("Não consegui cadastrar: " + (j.error || "erro desconhecido"));
      return;
    }
    toast(
      CHAT.acao === "cadastrar_filamento"
        ? "Filamento " + (j.num || "") + " cargado. Escribí ese número en el rollo."
        : "Peça cadastrada! Vai aparecer no editor ao sincronizar.",
    );
    cerrarChatCad();
    traerDeLaNubeManual();
  } catch (e) {
    toast("Não consegui falar com o servidor agora.");
  } finally {
    btn.disabled = false;
    btn.textContent = rotulo;
  }
}

/** Si venís del bookmarklet (?cadastro=mw&mw=...), abre el chat ya con el
    contexto del MakerWorld y manda un primer mensaje automático. */
function revisarLinkCadastroMW() {
  const p = new URLSearchParams(location.search);
  if (p.get("cadastro") !== "mw") return;
  const raw = p.get("mw");
  if (!raw) return;
  let ctx;
  try {
    ctx = JSON.parse(raw);
  } catch (e) {
    return;
  }
  history.replaceState(null, "", location.pathname);
  MIND_GRANDE = true; // viene con mucho para revisar: se abre grande
  abrirChatCad();
  CHAT.contextoMakerWorld = ctx;
  showTab("cat");
  enviarChatCad(
    "Vim do MakerWorld: " + ctx.titulo + ". Link: " + ctx.link + ". Me ajuda a cadastrar essa peça.",
  );
}

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
function migrarStockVentas() {
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
const addFil = () => {
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
function alternarClave() {
  const i = $("#entClave"),
    b = $("#bVerClave");
  const mostrar = i.type === "password";
  i.type = mostrar ? "text" : "password";
  b.textContent = mostrar ? "Ocultar" : "Ver";
}
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
  D.cfg.usuario = r.usuario || ""; // el nombre lindo, para que la Mind salude
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
export async function pedir(cuerpo) {
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
  const enviado = JSON.parse(JSON.stringify(D)); // foto exacta que se manda, para calzar la respuesta
  try {
    setSync("", "Guardando…");
    const r = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        action: "save",
        email: D.cfg.email || "",
        token: D.cfg.token || "",
        v: D._v || "",
        data: enviado,
      }),
    });
    const j = await r.json();
    if (j && j.ok) {
      if (j.data && j.data.produtos) {
        // Cambiamos las fotos pesadas por los links que ya guardó el servidor,
        // calzando por el contenido (la foto en sí), no por la posición: si
        // agregaste o sacaste una foto mientras esto subía, el largo ya no
        // coincide, pero las fotos que sí se subieron igual quedan resueltas.
        // Antes, ese desfasaje dejaba la foto en base64 para siempre y se
        // volvía a subir a Drive en cada guardado siguiente.
        const mapaFotosPorPieza = {};
        j.data.produtos.forEach(function (np) {
          const viejo = enviado.produtos.find((x) => x.id === np.id);
          if (!np.fotos || !viejo || !viejo.fotos) return;
          const mapa = {};
          viejo.fotos.forEach((f, i) => {
            if (
              String(f).indexOf("data:image") === 0 &&
              String(np.fotos[i]).indexOf("http") === 0
            )
              mapa[f] = np.fotos[i];
          });
          mapaFotosPorPieza[np.id] = mapa;
          const p = D.produtos.find((x) => x.id === np.id);
          if (!p) return;
          const mias = p.fotos && p.fotos.length ? p.fotos : p.foto ? [p.foto] : [];
          let cambio = false;
          const nuevas = mias.map((f) => {
            if (mapa[f]) {
              cambio = true;
              return mapa[f];
            }
            return f;
          });
          if (cambio) {
            p.fotos = nuevas;
            p.foto = nuevas[0];
          }
        });
        if (j.data.cfg && j.data.cfg.logo) D.cfg.logo = j.data.cfg.logo;
        local.set(D);
        if (editId && mapaFotosPorPieza[editId]) {
          const mapa = mapaFotosPorPieza[editId];
          let cambio = false;
          setFotosTmp(
            fotosTmp.map((f) => {
              if (mapa[f]) {
                cambio = true;
                return mapa[f];
              }
              return f;
            }),
          );
          if (cambio) pintarFoto();
        }
        renderCat();
        renderVit();
      }
      // la versión que quedó guardada pasa a ser la base del próximo save
      if (j.v) D._v = j.v;
      D._sucio = false;
      avisoSyncPendiente = false;
      local.set(D);
      setSync(
        "on",
        "En la nube · " +
          new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      );
      // El servidor junto esta copia con cosas que habia cargado otra
      // persona. Lo guardado ya esta completo, pero acá todavía falta verlo:
      // por eso se baja de nuevo, que ahora es seguro (no quedó nada sucio).
      if (j.fusionado) {
        toast("Había cambios de otra persona: se juntaron los dos.");
        await bajarDeLaNube();
      }
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
      reemplazarEstado(Object.assign(defaults(), j.data));
      D.cfg.api = api;
      D.cfg.token = tk;
      // de qué versión salió esta copia: viaja de vuelta en cada save para
      // que el servidor sepa si tiene que fusionar o puede pisar tranquilo
      D._v = j.v || "";
      if (!D.cfg.leti) D.cfg.leti = { cita: "", historia: "", foto: "" };
      migrarInsumos();
      migrarStockVentas();
      migrarPresupuestos(D);
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
  revisarLinkCadastroMW();
}
var listoParaSubir = false; // recién true cuando ya bajamos lo que hay en la nube
export function save() {
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
      reemplazarEstado(Object.assign(defaults(), d));
      D.cfg.api = api;
      D.cfg.token = tk;
      if (!D.cfg.leti) D.cfg.leti = { cita: "", historia: "", foto: "" };
      migrarInsumos();
      migrarStockVentas();
      migrarPresupuestos(D);
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
document
  .querySelectorAll("nav.tabs button")
  .forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
["qFil", "qIns"].forEach((id) => $("#" + id).addEventListener("input", renderCfgLists));
$("#radMes").addEventListener("change", renderRad);
$("#entBtn").addEventListener("click", entrar);
$("#posCobrar").addEventListener("click", cobrar);
$("#posQ").addEventListener("input", pintarPOS);
$("#posRecibido").addEventListener("input", totalPOS);
document.querySelectorAll("#posFormas button").forEach((b) =>
  b.addEventListener("click", () => {
    setPosForma(b.dataset.forma);
    document
      .querySelectorAll("#posFormas button")
      .forEach((x) => x.classList.toggle("on", x === b));
    pintarBotonCobrar();
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
  if (s && s.cfg) reemplazarEstado(Object.assign(defaults(), s));
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
  migrarStockVentas();
  migrarPresupuestos(D);
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

/* ---------- PM: puente para los handlers inline del HTML ---------- */
/* Este archivo es un módulo: sus funciones no son globales. Los on*="..." de
 * index.html llaman PM.nombre(). D se reasigna al sincronizar, por eso va como getter. */
window.PM = {
  get D() {
    return D;
  },
  LOGO,
  salir,
  alternarClave,
  nuevaPieza,
  abrirInsumos,
  buscarMercado,
  addAlPedido,
  gastoSinVenta,
  pegarLink,
  abrirPegar,
  nuevaIdea,
  cargarRadarAgosto,
  traerMundo,
  enviarPresupuesto,
  mandarWA,
  registrarVenta,
  vaciarPedido,
  compartirPresupuesto,
  descargarPresupuesto,
  compartirVitrina,
  bajarVitrina,
  abrirPOS,
  salirModoVenta,
  cerrarPOS,
  traerDeLaNubeManual,
  subirAhora,
  exportar,
  addFil,
  addImp,
  addIns,
  addPack,
  addOpi,
  addCanal,
  abrirChatCad,
  alternarTamanoMind,
  cerrarChatCad,
  confirmarChatCad,
  enviarChatCad,
  quitarFotoChat,
  save,
  pintarMarca,
  pintarLeti,
  toast,
};
