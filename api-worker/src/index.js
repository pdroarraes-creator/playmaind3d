import { encabezadosCors } from "./cors.js";

function json(datos, status, cors) {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}

export default {
  async fetch(request, env) {
    const cors = encabezadosCors(request.headers.get("Origin"), env);
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET" && pathname === "/salud") return json({ ok: true }, 200, cors);

    return json({ ok: false, error: "no encontrado" }, 404, cors);
  },
};
