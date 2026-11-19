import { encabezadosCors } from "./cors.js";
import { manejarPost } from "./rutas.js";
import { verificarSesion } from "./sesion.js";

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
    if (request.method === "GET" && pathname === "/salud") return json({ ok: true }, 200, cors);

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
