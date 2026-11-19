// Orígenes que pueden llamar a la API: el sitio y los extra de ORIGENES_EXTRA.
const ORIGENES = ["https://playmind3d.com", "https://www.playmind3d.com"];

export function origenPermitido(origin, env) {
  if (!origin) return null;
  const extra = String((env && env.ORIGENES_EXTRA) || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ORIGENES.concat(extra).includes(origin) ? origin : null;
}

export function encabezadosCors(origin, env) {
  const permitido = origenPermitido(origin, env);
  if (!permitido) return {};
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
