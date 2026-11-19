"use strict";
import { $, el, uid, hoy } from "./util.js";
import { D } from "./estado.js";
import { toast, showTab } from "./ui.js";
import { calc } from "./calculo.js";
import { leerFoto } from "./fotos.js";
import { cargarPieza, renderCalc } from "./editor.js";
import { cerrarSheet } from "./ventas.js";
import { save, pedir } from "./main.js";

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

export function nuevaIdea() {
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
export async function traerMundo() {
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
// Es `undefined` hasta que corre iniciarRadar() (la llama main.js donde estaba la sección radar):
// ningún módulo puede leerla al evaluarse, solo dentro de funciones.
export let MODO_VENTA;
var PIEZA_PENDIENTE = (function () {
  try {
    return new URLSearchParams(location.search).get("pieza") || "";
  } catch (e) {
    return "";
  }
})();
export function abrirPiezaDeLaUrl() {
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
export function ideaCompartida() {
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
export async function pegarLink() {
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
export function abrirPegar() {
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
export function cargarRadarAgosto() {
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

/** Lee ?modo= de la URL (y guarda la preferencia): escribe en localStorage, por eso
    corre al iniciar y no al evaluar el módulo. */
export function iniciarRadar() {
  MODO_VENTA = (function () {
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
}
