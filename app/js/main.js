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
import { aplicarVenta, cerrarSheet, migrarStockVentas, iniciarVentas } from "./ventas.js";
import { renderVit, compartirVitrina, bajarVitrina } from "./vitrina.js";
import {
  MODO_VENTA,
  renderRad,
  nuevaIdea,
  traerMundo,
  abrirPiezaDeLaUrl,
  ideaCompartida,
  pegarLink,
  abrirPegar,
  cargarRadarAgosto,
  iniciarRadar,
} from "./radar.js";

iniciarFotos();
iniciarEditor();
iniciarPedido();
iniciarRadar();

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

iniciarVentas();

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
