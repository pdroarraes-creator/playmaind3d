#!/usr/bin/env node
/* Ensayo en navegador del protocolo de dos servidores (Apps Script / Worker).
 * Usa el Playwright del ambiente (no se instala nada en el repo), levanta un
 * servidor estático en la raíz y intercepta TODAS las llamadas a los dos
 * servidores: nada sale a la red real.
 * Uso: node scripts/ensayo-protocolo.js   (sale con 0 solo si todo pasa)
 */
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const { chromium } = require("playwright");

const RAIZ = path.resolve(__dirname, "..");
const APPS = "https://script.google.com/**";
const WORKER = "https://playmind3d-api-prod.pdroarraes.workers.dev/**";
const CLAVE_MODO = "pm3d:servidor-estado";
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function puertoLibre() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
    s.on("error", rej);
  });
}

/** Estado inventado: 2 piezas y 1 venta. */
function estadoSemilla() {
  return {
    cfg: { email: "ensayo@example.com", token: "tok-ensayo", api: "", merma: 12 },
    produtos: [
      { id: "p1", nome: "Pieza uno", gramas: 10, horas: 1, fotos: [] },
      { id: "p2", nome: "Pieza dos", gramas: 20, horas: 2, fotos: [] },
    ],
    vendas: [{ id: "v1", data: "2026-01-01", itens: [], total: 1000 }],
    _sucio: false,
    v: 2,
  };
}

/** Corre un escenario en un contexto limpio. cfg: {modo, apps, worker}. */
async function correr(browser, base, cfg, fn) {
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  const page = await ctx.newPage();
  const llamadas = []; // {servidor, body, action}
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  const manejador = (servidor, getHandler) => async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
      });
    }
    const raw = req.postData() || "";
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch (e) {}
    llamadas.push({ servidor, raw, body, action: body.action });
    const h = getHandler();
    const r = h ? h(body) : { ok: true };
    if (r === "abort") return route.abort();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(r),
    });
  };
  const stubs = { apps: cfg.apps, worker: cfg.worker };
  await page.route(APPS, manejador("apps", () => stubs.apps));
  await page.route(WORKER, manejador("worker", () => stubs.worker));
  const semilla = estadoSemilla();
  if (cfg.sinStorage) {
    // navegador que bloquea el almacenamiento: el getter de window.localStorage lanza
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("bloqueado", "SecurityError");
        },
      });
    });
  }
  if (!cfg.sinStorage) await page.addInitScript(
    ([s, modo, clave]) => {
      if (!window.localStorage.getItem("playmind3d:v2"))
        window.localStorage.setItem("playmind3d:v2", JSON.stringify(s));
      if (modo === "worker" && !window.localStorage.getItem(clave))
        window.localStorage.setItem(clave, "worker");
    },
    [semilla, cfg.modo || "apps", CLAVE_MODO],
  );
  if (cfg.raiz) {
    // página pública de la raíz (catálogo): no tiene el estado D de la app
    await page.goto(base + "/");
    await page.waitForFunction(() => typeof enviarEdicionPieza === "function" && document.readyState === "complete");
    await dormir(300);
  } else {
    await page.goto(base + "/app/");
    await page.waitForFunction(() => typeof D !== "undefined" && document.readyState === "complete");
    await dormir(700); // deja terminar el load inicial
  }
  const ayuda = {
    page,
    llamadas,
    errores,
    stubs,
    sync: () => page.locator("#syncTxt").textContent(),
    modo: () => page.evaluate((k) => localStorage.getItem(k), CLAVE_MODO),
    estado: () =>
      page.evaluate(() => ({
        sucio: D._sucio,
        v: D._v,
        token: D.cfg.token,
        listo: listoParaSubir,
        piezas: D.produtos.length,
        ventas: D.vendas.length,
        entrada: !document.getElementById("entrada").hidden,
        reintento: reintentoTimer !== null,
      })),
    subir: () => page.evaluate(async () => { D._sucio = true; await subirALaNube(); }),
    cuenta: (servidor, action) =>
      llamadas.filter((c) => (!servidor || c.servidor === servidor) && (!action || c.action === action)).length,
  };
  try {
    return await fn(ayuda);
  } finally {
    await ctx.close();
  }
}

const okLoad = (v = "100") => ({ ok: true, v, data: estadoSemilla() });
function porAccion(mapa) {
  return (b) => (mapa[b.action] ? mapa[b.action](b) : { ok: true });
}

const escenarios = [
  [
    "1. Apps normal",
    { apps: porAccion({ load: () => okLoad(), save: () => ({ ok: true, v: "101" }) }) },
    async (t) => {
      await t.subir();
      const e = await t.estado();
      const sync = await t.sync();
      const m = await t.modo();
      return [
        [t.cuenta("worker") === 0, "no debe llamar al Worker"],
        [m === null || m === "apps", "modo=" + m],
        [e.sucio === false, "_sucio=" + e.sucio],
        [/En la nube/.test(sync), "sync=" + sync],
      ];
    },
  ],
  [
    "2. Corte con la sesión abierta",
    {
      apps: porAccion({ load: () => okLoad(), save: () => ({ ok: false, error: "migrado" }) }),
      worker: porAccion({ save: () => ({ ok: true, v: "1900000000" }) }),
    },
    async (t) => {
      await t.subir();
      const ap = t.llamadas.filter((c) => c.servidor === "apps" && c.action === "save");
      const wk = t.llamadas.filter((c) => c.servidor === "worker" && c.action === "save");
      const e = await t.estado();
      const m = await t.modo();
      const apsAntes = t.cuenta("apps", "save");
      await t.subir();
      return [
        [ap.length === 1 && wk.length === 1, `saves apps=${ap.length} worker=${wk.length}`],
        [ap[0] && wk[0] && ap[0].raw === wk[0].raw, "el Worker debe recibir el mismo cuerpo"],
        [m === "worker", "modo=" + m],
        [e.sucio === false, "_sucio=" + e.sucio],
        [e.v === "1900000000", "_v=" + e.v],
        [t.cuenta("worker", "save") === 2 && t.cuenta("apps", "save") === apsAntes, "el 2do save debe ir directo al Worker"],
      ];
    },
  ],
  [
    "3. Inicio ya en el Worker",
    { modo: "worker", worker: porAccion({ load: () => okLoad("7") }) },
    async (t) => {
      const e = await t.estado();
      return [
        [t.cuenta("worker", "load") === 1 && t.cuenta("apps") === 0, "load debe ir solo al Worker"],
        [/En la nube/.test(await t.sync()), "sync=" + (await t.sync())],
        [e.listo === true, "listoParaSubir=" + e.listo],
      ];
    },
  ],
  [
    "4. Rollback",
    {
      modo: "worker",
      worker: porAccion({ load: () => okLoad(), save: () => ({ ok: false, error: "revertido" }) }),
      apps: porAccion({ save: () => ({ ok: true, v: "55" }) }),
    },
    async (t) => {
      await t.subir();
      const e = await t.estado();
      return [
        [(await t.modo()) === "apps", "modo=" + (await t.modo())],
        [t.cuenta("apps", "save") === 1, "apps save=" + t.cuenta("apps", "save")],
        [e.sucio === false, "_sucio=" + e.sucio],
        [/En la nube/.test(await t.sync()), "sync=" + (await t.sync())],
      ];
    },
  ],
  [
    "4b. Rollback con load (Worker en solo-lectura: revertido a todo)",
    {
      modo: "worker",
      worker: porAccion({ load: () => ({ ok: false, error: "revertido" }), save: () => ({ ok: false, error: "revertido" }) }),
      apps: porAccion({ load: () => okLoad("55"), save: () => ({ ok: true, v: "56" }) }),
    },
    async (t) => {
      const e = await t.estado();
      return [
        [(await t.modo()) === "apps", "modo=" + (await t.modo())],
        [t.cuenta("worker", "load") === 1, "worker load=" + t.cuenta("worker", "load")],
        [t.cuenta("apps", "load") === 1, "apps load=" + t.cuenta("apps", "load")],
        [e.v === "55", "v=" + e.v + " (debe venir del Apps Script)"],
        [e.listo === true, "listoParaSubir=" + e.listo],
        [e.entrada === false, "no debe aparecer el login"],
      ];
    },
  ],
  [
    "4c. Solo-lectura: load revertido y el Apps Script también falla -> sin subida",
    {
      modo: "worker",
      worker: porAccion({ load: () => ({ ok: false, error: "revertido" }), save: () => ({ ok: false, error: "revertido" }) }),
      apps: porAccion({ load: () => ({ ok: false, error: "caído" }) }),
    },
    async (t) => {
      const e = await t.estado();
      return [
        [e.listo === false, "listoParaSubir=" + e.listo + " (solo con ok:true)"],
        [t.cuenta("worker", "load") === 1 && t.cuenta("apps", "load") >= 1, "load worker/apps"],
      ];
    },
  ],
  [
    "5. Lazo imposible",
    {
      apps: porAccion({ load: () => okLoad(), save: () => ({ ok: false, error: "migrado" }) }),
      worker: porAccion({ save: () => ({ ok: false, error: "revertido" }) }),
    },
    async (t) => {
      await t.subir();
      await dormir(600);
      const e = await t.estado();
      return [
        [t.cuenta(null, "save") === 2, "requests save=" + t.cuenta(null, "save")],
        [/Error|No se pudo/i.test(await t.sync()), "sync=" + (await t.sync())],
        [e.sucio === true, "_sucio=" + e.sucio],
      ];
    },
  ],
  [
    "6. Apps Script del acceso fuera del aire",
    {
      modo: "worker",
      worker: porAccion({ load: () => okLoad(), save: () => ({ ok: false, error: "auth_no_disponible" }) }),
    },
    async (t) => {
      await t.subir();
      const e = await t.estado();
      const sync = await t.sync();
      t.stubs.worker = porAccion({ save: () => ({ ok: true, v: "200" }) });
      await t.subir();
      const e2 = await t.estado();
      return [
        [e.entrada === false, "no debe aparecer el login"],
        [e.token === "tok-ensayo", "token=" + e.token],
        [/El servidor de acceso no responde/.test(sync), "sync=" + sync],
        [e.reintento === true, "debe haber reintento agendado"],
        [e2.sucio === false && e2.v === "200", `reintento manual: sucio=${e2.sucio} v=${e2.v}`],
      ];
    },
  ],
  [
    "7. Sesión inválida",
    { apps: porAccion({ load: () => okLoad(), save: () => ({ ok: false, error: "clave" }) }) },
    async (t) => {
      await t.subir();
      const e = await t.estado();
      return [[e.entrada === true, "debe aparecer el login"]];
    },
  ],
  [
    "8. Falla de red",
    { apps: porAccion({ load: () => okLoad(), save: () => "abort" }) },
    async (t) => {
      await t.subir();
      const e = await t.estado();
      return [
        [e.sucio === true, "_sucio=" + e.sucio],
        [e.reintento === true, "debe haber reintento agendado"],
      ];
    },
  ],
  [
    "9. Load con error no libera el save",
    { apps: porAccion({ load: () => ({ ok: false, error: "cualquiera" }) }) },
    async (t) => {
      const antes = await t.estado();
      await t.page.evaluate(() => { D.vendas[0].total = 1234; save(); });
      await dormir(2200);
      const e = await t.estado();
      const guardado = await t.page.evaluate(() => JSON.parse(localStorage.getItem("playmind3d:v2")));
      return [
        [antes.listo === false && e.listo === false, `listoParaSubir=${antes.listo}/${e.listo}`],
        [t.cuenta(null, "save") === 0, "no debe salir ningún save: " + t.cuenta(null, "save")],
        [e.piezas === 2 && e.ventas === 1, `piezas=${e.piezas} ventas=${e.ventas}`],
        [guardado.produtos.length === 2 && guardado.vendas.length === 1, "estado local intacto"],
      ];
    },
  ],
  [
    "10. Sin datos de verdad",
    { apps: porAccion({ load: () => ({ ok: true, data: null }) }) },
    async (t) => {
      const e = await t.estado();
      return [
        [/No había datos guardados/.test(await t.sync()), "sync=" + (await t.sync())],
        [e.listo === true, "listoParaSubir=" + e.listo],
      ];
    },
  ],
  [
    "11. Página de la raíz: editarPieza",
    {
      raiz: true,
      apps: porAccion({ editarPieza: () => ({ ok: false, error: "migrado" }) }),
      worker: porAccion({ editarPieza: () => ({ ok: true, desde: "worker" }) }),
    },
    async (t) => {
      const llamar = () =>
        t.page.evaluate(() => enviarEdicionPieza("peça x", { desc: "a" }, "tok-ensayo"));
      const r1 = await llamar();
      const ap = t.llamadas.filter((c) => c.servidor === "apps" && c.action === "editarPieza");
      const wk = t.llamadas.filter((c) => c.servidor === "worker" && c.action === "editarPieza");
      const m = await t.modo();
      const r2 = await llamar();
      return [
        [ap.length === 1 && wk.length >= 1, `apps=${ap.length} worker=${wk.length}`],
        [ap[0] && wk[0] && ap[0].raw === wk[0].raw, "el Worker debe recibir el mismo cuerpo"],
        [r1 && r1.ok === true && r1.desde === "worker", "retorno=" + JSON.stringify(r1)],
        [m === "worker", "modo=" + m],
        [t.cuenta("apps", "editarPieza") === 1 && t.cuenta("worker", "editarPieza") === 2, "la 2da llamada debe ir directo al Worker"],
        [r2 && r2.desde === "worker", "retorno2=" + JSON.stringify(r2)],
      ];
    },
  ],
  [
    "11b. Página de la raíz: modo worker persistido",
    {
      raiz: true,
      modo: "worker",
      worker: porAccion({ editarPieza: () => ({ ok: true, desde: "worker" }) }),
    },
    async (t) => {
      const r = await t.page.evaluate(() => enviarEdicionPieza("peça x", { desc: "a" }, "tok-ensayo"));
      return [
        [t.cuenta("apps", "editarPieza") === 0 && t.cuenta("worker", "editarPieza") === 1, "debe ir solo al Worker"],
        [r && r.desde === "worker", "retorno=" + JSON.stringify(r)],
      ];
    },
  ],
  [
    "12. Almacenamiento bloqueado: app.js carga (sin sesión guardada, pide entrar)",
    { sinStorage: true, apps: porAccion({ load: () => okLoad("9") }) },
    async (t) => {
      const e = await t.estado();
      return [
        [t.errores.length === 0, "errores de página: " + t.errores.join(" | ")],
        [e.entrada === true, "sin sesión guardada debe aparecer el login"],
        [t.cuenta("worker") === 0, "nada debe ir al Worker"],
      ];
    },
  ],
];

(async () => {
  const puerto = await puertoLibre();
  const srv = spawn("python3", ["-m", "http.server", String(puerto), "--bind", "127.0.0.1"], {
    cwd: RAIZ,
    stdio: "ignore",
  });
  let browser;
  let fallas = 0;
  try {
    await dormir(800);
    browser = await chromium.launch();
    const base = "http://127.0.0.1:" + puerto;
    for (const [nombre, cfg, fn] of escenarios) {
      try {
        const r = await correr(browser, base, cfg, fn);
        const malos = r.filter(([ok]) => !ok);
        if (malos.length) {
          fallas++;
          console.log("FALLA " + nombre + " -> " + malos.map((m) => m[1]).join("; "));
        } else console.log("OK    " + nombre);
      } catch (e) {
        fallas++;
        console.log("FALLA " + nombre + " -> excepción: " + e.message);
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    srv.kill();
  }
  console.log(fallas ? `\n${fallas} escenario(s) con falla` : "\nTodos OK");
  process.exit(fallas ? 1 : 0);
})();
