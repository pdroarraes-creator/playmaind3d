import { validarSesion, agregarPieza } from "./appsscript.js";
import { conversar } from "./gemini.js";
import { BOOKMARKLET_JS } from "./bookmarklet.js";

// El chat corre en playmind3d.com y este Worker vive en otro origen
// (*.workers.dev) — sin estos headers el navegador bloquea la respuesta
// antes de que el JS del chat la pueda leer (así se vio el bug: el fetch
// tiraba una excepción genérica, "Failed to fetch", en cada mensaje).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** Traduce los campos de la tool cadastrar_peca (nombres pensados para el
    chat) al shape que agregarPieza_ espera en Codigo.gs (mismos campos que
    el editor normal). No hay un campo de "color" en el modelo de producto
    (el color depende del filamento elegido, gestionado aparte) — por eso la
    cor que el usuario confirmó en el chat se guarda como texto en detalle,
    en vez de perderse. */
function traducirParaAgregarPieza(propuesta, link, foto) {
  // agregarPieza_/moverFotosADrive_ esperan una data URL completa
  // ("data:image/jpeg;base64,...."), no el {mimeType,base64} suelto.
  const fotoUrl = foto ? `data:${foto.mimeType || "image/jpeg"};base64,${foto.base64}` : null;
  const detalle = propuesta.cor ? `Cor: ${propuesta.cor}` : "";
  return {
    nome: propuesta.nome,
    desc: propuesta.descricao || "",
    tags: propuesta.tags || "",
    peso: Number(propuesta.peso_g) || 0,
    h: Math.floor((Number(propuesta.tempo_min) || 0) / 60),
    m: Math.round((Number(propuesta.tempo_min) || 0) % 60),
    manual: propuesta.preco != null ? Number(propuesta.preco) : null,
    detalle,
    ref: link || "",
    foto: fotoUrl,
    fotos: fotoUrl ? [fotoUrl] : [],
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Servido para instalarse como bookmarklet — ver README para el link
    // "javascript:" que lo carga. Corre en el origen de makerworld.com
    // cuando el usuario lo clickea ahí, por eso puede leer __NEXT_DATA__
    // sin problema de CORS (nuestro servidor nunca consigue leer esa
    // página: el anti-bot de MakerWorld bloquea tanto Cloudflare como
    // Google — probado en esta misma sesión).
    if (req.method === "GET" && url.pathname === "/bookmarklet.js") {
      return new Response(BOOKMARKLET_JS, {
        headers: { "Content-Type": "application/javascript; charset=utf-8", ...CORS_HEADERS },
      });
    }

    if (req.method !== "POST" || url.pathname !== "/chat") {
      return jsonResp({ ok: false, error: "usar POST /chat" }, 404);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResp({ ok: false, error: "json inválido" }, 400);
    }

    const { token, historial, mensaje, foto, contextoMakerWorld } = body;
    if (!token) return jsonResp({ ok: false, error: "falta token" }, 401);

    const sesionValida = await validarSesion(env, token);
    if (!sesionValida) return jsonResp({ ok: false, error: "sesión inválida" }, 401);

    // Confirmação real: o cliente já mostrou os campos (voltaram como
    // propuestaCadastro num turno anterior) e o usuário apertou o botão
    // "Confirmar cadastro" — aqui SÓ gravamos, sem passar pelo Gemini de novo.
    if (body.confirmar) {
      const pieza = traducirParaAgregarPieza(body.confirmar, body.link, body.foto);
      if (!pieza.nome) return jsonResp({ ok: false, error: "falta el nombre" }, 400);
      const r = await agregarPieza(env, token, pieza);
      return jsonResp(r);
    }

    let resultado;
    try {
      resultado = await conversar(env, {
        historial: historial || [],
        mensaje,
        foto,
        contextoMakerWorld: contextoMakerWorld || null,
      });
    } catch (e) {
      return jsonResp({ ok: false, error: String(e) }, 502);
    }

    return jsonResp({
      ok: true,
      texto: resultado.texto,
      // El cliente decide si muestra el botón "Confirmar cadastro" cuando
      // llega esto — la ejecución real sólo pasa con body.confirmar (arriba).
      propuestaCadastro: resultado.chamada ? resultado.chamada.args : null,
    });
  },
};
