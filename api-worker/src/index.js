import { encabezadosCors } from "./cors.js";
import { manejarPost } from "./rutas.js";
import { verificarSesion } from "./sesion.js";
import { manejarCatalogo } from "./catalogo.js";
import { leerUltimoSnapshot } from "./snapshot.js";

function json(datos, status, cors) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

export default {
  async fetch(request, env, ctxWorker) {
    const cors = encabezadosCors(request.headers.get("Origin"), env);
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET" && pathname === "/salud") {
      const modo = env.MODO === "solo-lectura" ? "solo-lectura" : "escritura";
      let snapshot = null;
      try {
        snapshot = await leerUltimoSnapshot(env.DB);
      } catch {
        // la salud nunca falla por el registro
      }
      return json({ ok: true, modo, snapshot }, 200, cors);
    }

    // Catálogo público: sin sesión y con CORS abierto (lo ve cualquiera, a propósito).
    const { searchParams } = new URL(request.url);
    if (request.method === "GET" &&
        (pathname === "/catalogo" || (pathname === "/" && searchParams.get("action") === "catalogo"))) {
      return manejarCatalogo(env, typeof caches !== "undefined" ? caches.default : null);
    }

    if (request.method === "POST" && pathname !== "/salud") {
      let body;
      try {
        body = JSON.parse(await request.text());
      } catch {
        return json({ ok: false, error: "cuerpo invalido" }, 200, cors);
      }
      const ctx = {
        env,
        db: env.DB,
        fetchFn: (...args) => fetch(...args),
        ahora: Date.now,
        verificar: verificarSesion,
        esperar: (p) => ctxWorker.waitUntil(p),
      };
      return json(await manejarPost(body, ctx), 200, cors);
    }

    return json({ ok: false, error: "no encontrado" }, 404, cors);
  },
};
