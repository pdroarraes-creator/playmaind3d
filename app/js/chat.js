"use strict";
import { $, el, uid, num, money, hoy } from "./util.js";
import { D, WORKER_CADASTRO } from "./estado.js";
import { toast, showTab, renderAll } from "./ui.js";
import { calc } from "./calculo.js";
import { leerFoto } from "./fotos.js";
import { sumarStock } from "./catalogo.js";
import { aplicarVenta } from "./ventas.js";
import { save, traerDeLaNubeManual } from "./main.js";

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
export function alternarTamanoMind() {
  MIND_GRANDE = !MIND_GRANDE;
  aplicarTamanoMind();
}

export function abrirChatCad() {
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
export function cerrarChatCad() {
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
export function quitarFotoChat() {
  CHAT.foto = null;
  pintarFotoChat();
}

/** {mimeType, base64} sin el prefijo "data:...;base64," — así lo espera
    inlineData de la API del Gemini. agregarPieza sí quiere la data URL
    completa, por eso se guarda CHAT.foto entero y se corta acá nomás. */
function fotoParaGemini(dataUrl) {
  if (!dataUrl) return null;
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return null;
  return { mimeType: m[1], base64: m[2] };
}

export async function enviarChatCad(mensajeForzado) {
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

export async function confirmarChatCad() {
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
export function revisarLinkCadastroMW() {
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

export function iniciarChat() {
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
}
