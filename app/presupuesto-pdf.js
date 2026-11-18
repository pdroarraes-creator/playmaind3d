/* ---------- presupuesto: dibujo del PDF ----------
 * Arma el PDF del presupuesto con jsPDF (app/vendor). Recibe un Presu de
 * presupuesto.js. Fredoka sólo en títulos; el resto en Helvetica.
 */
(function (raiz) {
  const C = {
    teal: [44, 122, 123],
    cielo: [127, 184, 211],
    coral: [244, 169, 127],
    dorado: [201, 162, 39],
    fondo: [250, 246, 238],
    tinta: [58, 58, 56],
    tealOscuro: [31, 87, 88],
    gris: [110, 110, 106],
    blanco: [255, 255, 255],
  };
  const A4 = { w: 210, h: 297 };
  const M = 15; // margen
  const FOTO = 22; // lado de la foto en mm
  const PIE = 32; // alto reservado para el pie

  const dinero = (v) => "$" + Math.round(v).toLocaleString("es-AR");
  // Helvetica sólo sabe latin-1: lo demás (emojis, etc.) se cae para no ensuciar el PDF
  const latin = (s) => String(s || "").replace(/[^\u0000-ÿ]/g, "").replace(/\s+/g, " ").trim();

  function idDeDrive(url) {
    const m = /^https:\/\/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/.exec(url || "");
    return m ? m[1] : null;
  }

  function medir(data) {
    if (typeof Image === "undefined") return Promise.resolve({ data, w: 1, h: 1 });
    return new Promise((ok) => {
      const i = new Image();
      i.onload = () => ok({ data, w: i.naturalWidth || 1, h: i.naturalHeight || 1 });
      i.onerror = () => ok(null);
      i.src = data;
    });
  }

  function blobADataUrl(b) {
    return new Promise((ok, mal) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = mal;
      r.readAsDataURL(b);
    });
  }

  /** Corta una promesa que tarda demasiado: devuelve null en vez de colgarse. */
  function conTiempo(promesa, ms) {
    let t;
    return Promise.race([promesa, new Promise((ok) => (t = setTimeout(() => ok(null), ms)))]).finally(() =>
      clearTimeout(t),
    );
  }

  async function leerDirecto(url, ms) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), ms);
    try {
      const r = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
      if (!r.ok) throw new Error("http " + r.status);
      const b = await r.blob();
      if (!/^image\//.test(b.type)) throw new Error("no es imagen");
      return await medir(await blobADataUrl(b));
    } finally {
      clearTimeout(t);
    }
  }

  /** Nunca tira error ni se cuelga: si no hay forma de leer la foto a tiempo, devuelve null. */
  async function cargarImagen(url, pedirFoto, op) {
    const ms = (op && op.ms) || 4000;
    if (!url) return null;
    try {
      return await leerDirecto(url, ms);
    } catch (e) {
      const id = idDeDrive(url);
      if (!id || !pedirFoto) return null;
      try {
        const j = await conTiempo(pedirFoto(id), ms);
        if (!j || !j.ok || !j.b64) return null;
        return await medir("data:" + j.mime + ";base64," + j.b64);
      } catch (e2) {
        return null;
      }
    }
  }

  function formato(data) {
    const m = /^data:image\/(png|jpe?g|webp)/i.exec(data);
    if (!m) return null;
    const f = m[1].toLowerCase();
    return f === "jpg" || f === "jpeg" ? "JPEG" : f.toUpperCase();
  }

  function ponerImagen(doc, img, x, y, lado) {
    const f = img && formato(img.data);
    if (!f) return false;
    const k = Math.min(lado / img.w, lado / img.h);
    const w = img.w * k,
      h = img.h * k;
    try {
      doc.addImage(img.data, f, x + (lado - w) / 2, y + (lado - h) / 2, w, h);
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Documento A4 con las fuentes y atajos de color que usan los dos PDF. */
  function nuevoDoc(deps) {
    const { jsPDF } = raiz.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: deps.comprimir !== false });
    let titulo = "helvetica";
    if (raiz.FREDOKA_B64) {
      doc.addFileToVFS("Fredoka.ttf", raiz.FREDOKA_B64);
      doc.addFont("Fredoka.ttf", "Fredoka", "normal");
      titulo = "Fredoka";
    }
    return {
      doc,
      titulo,
      color: (c) => doc.setTextColor(c[0], c[1], c[2]),
      relleno: (c) => doc.setFillColor(c[0], c[1], c[2]),
      fuente: (f, est, t) => {
        doc.setFont(f, est || "normal");
        doc.setFontSize(t);
      },
    };
  }

  /** Fondo + faja teal con logo y marca; a la derecha, etiqueta y dos líneas. Devuelve la y libre. */
  function dibujarEncabezado(k, o) {
    const { doc, fuente, color, relleno } = k;
    relleno(C.fondo);
    doc.rect(0, 0, A4.w, A4.h, "F");
    relleno(C.teal);
    doc.rect(0, 0, A4.w, 38, "F");
    let x = M;
    if (ponerImagen(doc, o.logo, M, 7, 24)) x = M + 28;
    fuente(k.titulo, "normal", 20);
    color(C.blanco);
    doc.text(latin(o.marca) || "PlayMind 3d", x, 18);
    fuente("helvetica", "normal", 9);
    doc.text("Juguetes y arte impresos en 3D", x, 25);
    fuente(k.titulo, "normal", 15);
    doc.text(o.etiqueta, A4.w - M, 15, { align: "right" });
    fuente("helvetica", "bold", 11);
    doc.text(latin(o.linea1), A4.w - M, 22, { align: "right" });
    fuente("helvetica", "normal", 9);
    doc.text(latin(o.linea2), A4.w - M, 29, { align: "right" });
    relleno(C.dorado);
    doc.rect(0, 38, A4.w, 1.2, "F");
    return 48;
  }

  /** Pie en todas las hojas: frase, contacto y, si hay, una línea extra (el link). */
  function dibujarPie(k, o) {
    const { doc, fuente, color, relleno } = k;
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      const yp = A4.h - 20;
      relleno(C.dorado);
      doc.rect(M, yp - 6, A4.w - 2 * M, 0.6, "F");
      fuente(k.titulo, "normal", 11);
      color(C.teal);
      doc.text("Se imprime a pedido \u00B7 eleg\u00EDs el color", M, yp);
      fuente("helvetica", "normal", 9);
      color(C.gris);
      const contacto = [o.wa ? "WhatsApp " + latin(o.wa) : "", latin(o.ig), latin(o.extra)]
        .filter(Boolean)
        .join("   \u00B7   ");
      doc.text(contacto, M, yp + 6);
      if (n > 1) doc.text(p + "/" + n, A4.w - M, yp + 6, { align: "right" });
    }
  }

  function salida(doc, deps) {
    if (deps.salida === "doc") return doc;
    if (deps.salida === "arraybuffer") return doc.output("arraybuffer");
    return doc.output("blob");
  }

  async function generarPdf(pr, deps) {
    deps = deps || {};
    const cargar = deps.cargar || cargarImagen;
    const k = nuevoDoc(deps);
    const { doc, titulo, color, relleno, fuente } = k;

    const fotos = await Promise.all(pr.items.map((it) => cargar(it.foto, deps.pedirFoto)));
    const logo = deps.logo || null;

    const encabezado = () =>
      dibujarEncabezado(k, {
        logo,
        marca: pr.marca,
        etiqueta: "PRESUPUESTO",
        linea1: "N\u00B0 " + pr.numero,
        linea2: pr.fecha + "  \u00B7  V\u00E1lido hasta " + pr.valido,
      });

    function cabezaTabla(y) {
      fuente("helvetica", "bold", 8.5);
      color(C.gris);
      doc.text("PIEZA", M + FOTO + 4, y);
      doc.text("CANT.", 130, y, { align: "center" });
      doc.text("UNITARIO", 160, y, { align: "right" });
      doc.text("SUBTOTAL", A4.w - M, y, { align: "right" });
      doc.setDrawColor(C.cielo[0], C.cielo[1], C.cielo[2]);
      doc.setLineWidth(0.4);
      doc.line(M, y + 2.5, A4.w - M, y + 2.5);
      return y + 7;
    }

    function nuevaHoja() {
      doc.addPage();
      return cabezaTabla(encabezado());
    }

    let y = encabezado();
    const cli = latin(pr.cliente);
    if (cli) {
      fuente("helvetica", "normal", 10);
      color(C.gris);
      doc.text("Para:", M, y);
      fuente("helvetica", "bold", 12);
      color(C.tinta);
      doc.text(cli, M + 11, y);
      y += 9;
    }
    y = cabezaTabla(y);

    const anchoNombre = 120 - (M + FOTO + 4) - 6;
    pr.items.forEach((it, i) => {
      fuente("helvetica", "bold", 10.5);
      const lineas = doc.splitTextToSize(latin(it.nome) || "Pieza", anchoNombre);
      const alto = Math.max(FOTO, lineas.length * 4.6 + 7) + 4;
      if (y + alto > A4.h - PIE) y = nuevaHoja();

      if (!ponerImagen(doc, fotos[i], M, y, FOTO)) {
        relleno(C.cielo);
        doc.roundedRect(M, y, FOTO, FOTO, 3, 3, "F");
      }
      color(C.tinta);
      doc.text(lineas, M + FOTO + 4, y + 5);
      fuente("helvetica", "normal", 8.5);
      color(C.gris);
      if (it.color) doc.text("Color: " + latin(it.color), M + FOTO + 4, y + 5 + lineas.length * 4.6);
      fuente("helvetica", "normal", 10.5);
      color(C.tinta);
      doc.text(String(it.q), 130, y + 5, { align: "center" });
      doc.text(dinero(it.unit), 160, y + 5, { align: "right" });
      fuente("helvetica", "bold", 10.5);
      doc.text(dinero(it.sub), A4.w - M, y + 5, { align: "right" });
      y += alto;
      doc.setDrawColor(230, 224, 212);
      doc.setLineWidth(0.2);
      doc.line(M, y - 2, A4.w - M, y - 2);
    });

    // totales
    const filas = [["Subtotal", dinero(pr.bruto)]];
    if (pr.descMonto > 0) filas.push(["Descuento (-" + Math.round(pr.descPct * 100) + "%)", "-" + dinero(pr.descMonto)]);
    if (pr.envio > 0) filas.push(["Envío", dinero(pr.envio)]);
    const altoTot = filas.length * 6 + 18;
    if (y + altoTot > A4.h - PIE) {
      doc.addPage();
      y = encabezado();
    }
    y += 4;
    fuente("helvetica", "normal", 10);
    filas.forEach(([k, v]) => {
      color(C.gris);
      doc.text(k, 150, y, { align: "right" });
      color(C.tinta);
      doc.text(v, A4.w - M, y, { align: "right" });
      y += 6;
    });
    relleno(C.coral);
    doc.roundedRect(118, y - 1, A4.w - M - 118, 12, 3, 3, "F");
    fuente("helvetica", "bold", 12);
    color(C.tealOscuro);
    doc.text("Total", 123, y + 6.8);
    doc.text(dinero(pr.total), A4.w - M - 4, y + 6.8, { align: "right" });

    dibujarPie(k, { wa: pr.wa, ig: pr.ig });
    return salida(doc, deps);
  }

  async function generarCatalogoPdf(cat, deps) {
    deps = deps || {};
    const cargar = deps.cargar || cargarImagen;
    const k = nuevoDoc(deps);
    const { doc, titulo, color, relleno, fuente } = k;
    const fotos = await Promise.all(cat.items.map((it) => cargar(it.foto, deps.pedirFoto)));
    const encabezado = () =>
      dibujarEncabezado(k, {
        logo: deps.logo || null,
        marca: cat.marca,
        etiqueta: "CAT\u00C1LOGO",
        linea1: cat.nombre,
        linea2: cat.fecha,
      });

    let y = encabezado();
    fuente(titulo, "normal", 18);
    color(C.tealOscuro);
    doc.text(latin(cat.titulo), M, y + 2);
    y += 10;

    const COLS = 3,
      GAP = 6;
    const ancho = (A4.w - 2 * M - GAP * (COLS - 1)) / COLS;
    cat.items.forEach((it, i) => {
      const col = i % COLS;
      fuente("helvetica", "bold", 10);
      const lineas = doc.splitTextToSize(latin(it.nome) || "Pieza", ancho).slice(0, 3);
      // la fila entera se mide al empezar: así ninguna tarjeta queda cortada
      if (col === 0) {
        let alto = 0;
        for (let j = i; j < Math.min(i + COLS, cat.items.length); j++) {
          const l = doc.splitTextToSize(latin(cat.items[j].nome) || "Pieza", ancho).slice(0, 3);
          alto = Math.max(alto, ancho + 4 + l.length * 4.4 + 12);
        }
        if (y + alto > A4.h - PIE) {
          doc.addPage();
          y = encabezado();
        }
        cat._alto = alto;
      }
      const x = M + col * (ancho + GAP);
      relleno(C.blanco);
      doc.roundedRect(x, y, ancho, cat._alto - 4, 3, 3, "F");
      if (!ponerImagen(doc, fotos[i], x + 3, y + 3, ancho - 6)) {
        relleno(C.cielo);
        doc.roundedRect(x + 3, y + 3, ancho - 6, ancho - 6, 3, 3, "F");
      }
      let yt = y + ancho + 3;
      color(C.tinta);
      doc.text(lineas, x + 3, yt);
      yt += lineas.length * 4.4;
      fuente("helvetica", "bold", 12);
      color(C.tealOscuro);
      doc.text(dinero(it.precio), x + 3, yt + 2);
      if (it.color) {
        fuente("helvetica", "normal", 8);
        color(C.gris);
        doc.text(latin(it.color), x + 3, yt + 7);
      }
      if (col === COLS - 1 || i === cat.items.length - 1) y += cat._alto;
    });
    delete cat._alto;

    dibujarPie(k, { wa: cat.wa, ig: cat.ig, extra: String(cat.link || "").replace(/^https?:\/\//, "") });
    return salida(doc, deps);
  }

  const api = { idDeDrive, cargarImagen, generarPdf, generarCatalogoPdf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(raiz, api);
})(typeof window !== "undefined" ? window : globalThis);
