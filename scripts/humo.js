#!/usr/bin/env node
/* Roteiro de humo: abre la app en un navegador real contra un servidor falso
 * y comprueba que arranca desde un estado viejo, que cada pestaña abre, que
 * guarda de verdad y que no hay errores. No toca app/ ni server/.
 *
 * Uso:  node scripts/humo.js     (exit 0 = todo bien, exit 1 = algo falló)
 *
 * OJO: Playwright NO es dependencia del repo (no hay npm acá). Viene del
 * entorno de Claude; si no está instalado, el script no corre.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const RAIZ = path.resolve(__dirname, "..");
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

/* Estado VIEJO: formato de defaults() pero sin radar, packs, opiniones,
 * cfg.leti ni cfg.merma. Las migraciones de arranque tienen que rellenarlos. */
const ESTADO_VIEJO = {
  cfg: {
    marca: "Play Mind 3d",
    logo: "/assets/logo-app.png",
    wa: "",
    email: "x@x",
    catalogo: "",
    kwh: 230,
    maoObra: 0,
    risco: 12,
    mult: 4,
    round: 500,
    api: "",
    token: "t",
  },
  canais: [{ id: "c1", nome: "Escuela", comision: 0 }],
  filamentos: [
    {
      id: "f1",
      marca: "Bambu Lab",
      nome: "PLA Basic",
      cor: "Blanco",
      hex: "#F2F0EA",
      precoKg: 24000,
      rollo: 1000,
      stock: 1000,
    },
  ],
  impressoras: [
    {
      id: "i1",
      nome: "Bambu Lab A1 mini",
      preco: 505000,
      vida: 5000,
      watts: 48,
      bico: 21000,
      bicoVida: 1000,
      mesa: 35000,
      mesaVida: 2000,
    },
  ],
  insumos: [{ id: "n1", nome: "Bolsita chica", pack: 7500, unid: 100, stock: 100 }],
  produtos: [
    {
      id: "p1",
      nome: "Pieza humo",
      ref: "",
      foto: null,
      fotos: [],
      fil: "f1",
      imp: "i1",
      peso: 20,
      h: 1,
      m: 30,
      mo: 0,
      insumos: {},
      risco: null,
      mult: null,
      cplx: 1,
      manual: null,
      mercado: null,
      cat: "",
      desc: "",
      libre: false,
    },
  ],
  vendas: [],
  pedido: {},
  pedidoFil: {},
};

function servidorEstatico() {
  return http.createServer((req, res) => {
    let ruta = decodeURIComponent(req.url.split("?")[0]);
    if (ruta.endsWith("/")) ruta += "index.html";
    const archivo = path.join(RAIZ, ruta);
    if (!archivo.startsWith(RAIZ + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(archivo, (err, buf) => {
      if (err) {
        res.writeHead(404).end("no existe");
        return;
      }
      res.writeHead(200, {
        "content-type": TIPOS[path.extname(archivo)] || "application/octet-stream",
      });
      res.end(buf);
    });
  });
}

const resultados = []; // { nombre, ok, detalle }
function chequeo(nombre, ok, detalle) {
  resultados.push({ nombre, ok, detalle });
  console.log((ok ? "OK   " : "FAIL ") + nombre + (detalle ? " - " + detalle : ""));
}

async function main() {
  const srv = servidorEstatico();
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  let browser;
  try {
    browser = await chromium.launch();
    const ctx = await browser.newContext({ serviceWorkers: "block" });
    const page = await ctx.newPage();

    const errores = [];
    page.on("pageerror", (e) => errores.push("pageerror: " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push("console.error: " + m.text());
    });

    const saves = [];
    await page.route("**/script.google.com/**", async (route) => {
      const req = route.request();
      const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
      if (req.method() === "OPTIONS") {
        return route.fulfill({
          status: 204,
          headers: { ...cors, "access-control-allow-headers": "*" },
        });
      }
      let cuerpo = {};
      try {
        cuerpo = JSON.parse(req.postData() || "{}");
      } catch (e) {}
      let resp = { ok: true };
      if (cuerpo.action === "load") resp = { ok: true, data: ESTADO_VIEJO, v: "1" };
      else if (cuerpo.action === "save") {
        saves.push(cuerpo);
        resp = { ok: true, v: "2" };
      }
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(resp) });
    });

    await page.addInitScript((estado) => {
      try {
        localStorage.setItem("playmind3d:v2", JSON.stringify(estado));
      } catch (e) {}
    }, ESTADO_VIEJO);

    // (a) abrir /app/ y esperar la pantalla principal (carga desde la "nube")
    try {
      await page.goto(base + "/app/", { waitUntil: "load" });
      await page.waitForSelector('[role=tab][data-tab="cat"][aria-selected="true"]', {
        timeout: 10000,
      });
      await page.waitForFunction(
        () => /nube/i.test(document.querySelector("#syncTxt")?.textContent || ""),
        null,
        { timeout: 10000 },
      );
      chequeo("(a) arranca desde estado viejo y sincroniza", true);
    } catch (e) {
      chequeo("(a) arranca desde estado viejo y sincroniza", false, e.message.split("\n")[0]);
    }

    // (b) cada pestaña visible se abre
    try {
      const tabs = await page.$$eval("[role=tab][data-tab]", (bs) =>
        bs.filter((b) => !b.hidden && b.offsetParent !== null).map((b) => b.dataset.tab),
      );
      if (!tabs.length) throw new Error("no se encontró ninguna pestaña visible");
      // "cat" viene seleccionada desde el HTML: se visita al final, así el clic prueba algo
      tabs.sort((x, y) => (x === "cat") - (y === "cat"));
      const fallas = [];
      for (const t of tabs) {
        try {
          await page.click(`[role=tab][data-tab="${t}"]`, { timeout: 5000 });
          await page.waitForSelector(`[role=tab][data-tab="${t}"][aria-selected="true"]`, {
            timeout: 5000,
          });
          await page.waitForFunction(
            (nombre) => {
              const paneles = [...document.querySelectorAll("[id^='tab-']")];
              const mio = document.getElementById("tab-" + nombre);
              if (!mio || mio.hidden || mio.offsetParent === null) return false;
              if (!mio.children.length || !mio.innerText.trim()) return false;
              return paneles.every((p) => p === mio || p.hidden);
            },
            t,
            { timeout: 5000 },
          );
        } catch (e) {
          fallas.push(t);
        }
      }
      chequeo(
        "(b) pestañas (" + tabs.join(",") + ")",
        !fallas.length,
        fallas.length ? "no abrieron: " + fallas.join(",") : "",
      );
    } catch (e) {
      chequeo("(b) pestañas", false, e.message.split("\n")[0]);
    }

    // (c) un cambio en Ajustes se guarda en el "servidor"
    try {
      const valor = "+54 9 11 humo" + Date.now();
      await page.click('[role=tab][data-tab="cfg"]');
      await page.fill("#s_wa", valor);
      await page.dispatchEvent("#s_wa", "change");
      await page.waitForTimeout(2500);
      const bueno = saves.find((s) => s.data && s.data.cfg && s.data.cfg.wa === valor);
      if (!saves.length) throw new Error("el servidor no recibió ningún save");
      if (!bueno) throw new Error("ningún save trae el valor escrito (saves: " + saves.length + ")");
      const largo = JSON.stringify(bueno.data).length;
      if (largo >= 50000) throw new Error("el estado mide " + largo + " (>= 50000)");
      chequeo("(c) save con el valor nuevo", true, saves.length + " save(s), estado de " + largo + " chars");
    } catch (e) {
      chequeo("(c) save con el valor nuevo", false, e.message.split("\n")[0]);
    }

    // (c2) todo handler inline del HTML existe como función en window.PM
    try {
      const html = fs.readFileSync(path.join(RAIZ, "app/index.html"), "utf8");
      const nombres = new Set();
      for (const m of html.matchAll(/\bon[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        const js = (m[1] !== undefined ? m[1] : m[2]).replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");
        for (const c of js.matchAll(/(?<![\w$.])PM\.([A-Za-z_$][\w$]*)\s*\(/g)) nombres.add(c[1]);
      }
      if (!nombres.size) throw new Error("no se encontró ningún PM.x() en el HTML");
      const faltan = await page.evaluate(
        (ns) => ns.filter((n) => !window.PM || typeof window.PM[n] !== "function"),
        [...nombres],
      );
      chequeo("(c2) window.PM tiene los " + nombres.size + " handlers del HTML", !faltan.length, faltan.length ? "faltan: " + faltan.join(",") : "");
    } catch (e) {
      chequeo("(c2) window.PM tiene los handlers del HTML", false, e.message.split("\n")[0]);
    }

    // (e) la pieza sembrada aparece en el catálogo
    try {
      await page.click('[role=tab][data-tab="cat"]');
      await page.waitForFunction(
        () => /Pieza humo/.test(document.querySelector("#tab-cat #catList")?.innerText || ""),
        null,
        { timeout: 5000 },
      );
      chequeo("(e) catálogo muestra 'Pieza humo'", true);
    } catch (e) {
      chequeo("(e) catálogo muestra 'Pieza humo'", false, e.message.split("\n")[0]);
    }

    // (f) editar la pieza en la pestaña Calcular y guardar llega al servidor
    try {
      const nombre = "Pieza humo editada " + Date.now();
      await page.click("#tab-cat #catList .item .info");
      await page.waitForFunction(
        () =>
          !document.querySelector("#tab-calc").hidden &&
          document.querySelector("#c_nome").value === "Pieza humo",
        null,
        { timeout: 5000 },
      );
      await page.fill("#tab-calc #c_nome", nombre);
      await page.fill("#tab-calc #c_peso", "37");
      await page.click("#tab-calc #bSave");
      const t0 = Date.now();
      let bueno;
      while (!bueno && Date.now() - t0 < 8000) {
        bueno = saves.find(
          (s) =>
            s.data &&
            (s.data.produtos || []).some((p) => p.nome === nombre && Number(p.peso) === 37),
        );
        if (!bueno) await page.waitForTimeout(100);
      }
      if (!bueno) throw new Error("ningún save trae la pieza editada (saves: " + saves.length + ")");
      const largo = JSON.stringify(bueno.data).length;
      if (largo >= 50000) throw new Error("el estado mide " + largo + " (>= 50000)");
      chequeo("(f) editar pieza guarda en el servidor", true, "estado de " + largo + " chars");
    } catch (e) {
      chequeo("(f) editar pieza guarda en el servidor", false, e.message.split("\n")[0]);
    }

    // (d) cero errores durante todo el recorrido
    chequeo("(d) cero errores de página/consola", !errores.length, errores.join(" | "));
  } catch (e) {
    chequeo("roteiro", false, e.message.split("\n")[0]);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((r) => srv.close(r));
  }
  const malos = resultados.filter((r) => !r.ok);
  console.log(malos.length ? "\nFALLÓ: " + malos.length + " chequeo(s)" : "\nTodo bien.");
  process.exit(malos.length ? 1 : 0);
}
main();
