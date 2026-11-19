// Acciones POST del Worker. Espeja el doPost del Apps Script: siempre un
// objeto { ok: true, ... } o { ok: false, error }; el HTTP lo arma index.js.
import { leerEstado, guardarConFusion } from "./estado.js";
import { contieneFotosNuevas, subirFotos } from "./fotos.js";
import { snapshotTrasGrabar } from "./snapshot.js";
import { editarPieza, agregarPieza, agregarFilamento, resumenNegocio } from "./acciones.js";

// La versión llega del cliente como cualquier cosa ("", un sello de hora del
// Sheets, basura). Sólo un entero seguro >= 0 vale; lo demás es 0 y cae en la fusión.
export function versionDelCliente(v) {
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0 ? v : 0;
  if (typeof v === "string" && /^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : 0;
  }
  return 0;
}

function esObjeto(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

// Acciones que modifican el estado: con MODO "solo-lectura" se rechazan.
export const ESCRIBEN = ["save", "editarPieza", "agregarPieza", "agregarFilamento"];

export const ACCIONES = {
  async load(_body, ctx) {
    const { data, v } = await leerEstado(ctx.db);
    return { ok: true, data, v: v ? String(v) : "" };
  },

  async save(body, ctx) {
    if (!esObjeto(body.data)) return { ok: false, error: "datos invalidos" };
    let data = body.data;
    const baseV = versionDelCliente(body.v);
    if (contieneFotosNuevas(data)) data = await subirFotos(ctx.env, ctx.token, data, ctx.fetchFn);
    const r = await guardarConFusion(ctx.db, data, baseV);
    if (!r.ok) return { ok: false, error: r.error };
    snapshotTrasGrabar(ctx, r);
    return {
      ok: true,
      actualizado: new Date(ctx.ahora()).toISOString(),
      data: r.data,
      v: String(r.v),
      fusionado: r.fusionado,
    };
  },

  editarPieza,
  agregarPieza,
  agregarFilamento,
  resumenNegocio,
};

export async function manejarPost(body, ctx) {
  try {
    if (!esObjeto(body)) return { ok: false, error: "cuerpo invalido" };
    const token = typeof body.token === "string" ? body.token : "";
    const sesion = await ctx.verificar(token, ctx.env);
    if (!sesion.ok) return sesion;
    if (typeof body.action !== "string" || !Object.hasOwn(ACCIONES, body.action)) {
      return { ok: false, error: "accion desconocida" };
    }
    if (ctx.env.MODO === "solo-lectura" && ESCRIBEN.includes(body.action)) {
      return { ok: false, error: "revertido" };
    }
    return await ACCIONES[body.action](body, { ...ctx, token });
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}
