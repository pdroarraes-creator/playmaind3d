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

  /** Nunca tira error: si no hay forma de leer la foto, devuelve null. */
  async function cargarImagen(url, pedirFoto) {
    if (!url) return null;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error("http " + r.status);
      const b = await r.blob();
      if (!/^image\//.test(b.type)) throw new Error("no es imagen");
      return await medir(await blobADataUrl(b));
    } catch (e) {
      const id = idDeDrive(url);
      if (!id || !pedirFoto) return null;
      try {
        const j = await pedirFoto(id);
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

  async function generarPdf(pr, deps) {
    deps = deps || {};
    const cargar = deps.cargar || cargarImagen;
    const { jsPDF } = raiz.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: deps.comprimir !== false });

    let titulo = "helvetica";
    if (raiz.FREDOKA_B64) {
      doc.addFileToVFS("Fredoka.ttf", raiz.FREDOKA_B64);
      doc.addFont("Fredoka.ttf", "Fredoka", "normal");
      titulo = "Fredoka";
    }
    const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
    const relleno = (c) => doc.setFillColor(c[0], c[1], c[2]);
    const fuente = (f, est, t) => {
      doc.setFont(f, est || "normal");
      doc.setFontSize(t);
    };

    const fotos = await Promise.all(pr.items.map((it) => cargar(it.foto, deps.pedirFoto)));
    const logo = deps.logo || null;

    function fondo() {
      relleno(C.fondo);
      doc.rect(0, 0, A4.w, A4.h, "F");
    }

    function encabezado() {
      fondo();
      relleno(C.teal);
      doc.rect(0, 0, A4.w, 38, "F");
      let x = M;
      if (ponerImagen(doc, logo, M, 7, 24)) x = M + 28;
      fuente(titulo, "normal", 20);
      color(C.blanco);
      doc.text(latin(pr.marca) || "PlayMind 3d", x, 18);
      fuente("helvetica", "normal", 9);
      doc.text("Juguetes y arte impresos en 3D", x, 25);
      fuente(titulo, "normal", 15);
      doc.text("PRESUPUESTO", A4.w - M, 15, { align: "right" });
      fuente("helvetica", "bold", 11);
      doc.text("N° " + pr.numero, A4.w - M, 22, { align: "right" });
      fuente("helvetica", "normal", 9);
      doc.text(pr.fecha + "  ·  Válido hasta " + pr.valido, A4.w - M, 29, { align: "right" });
      relleno(C.dorado);
      doc.rect(0, 38, A4.w, 1.2, "F");
      return 48;
    }

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

    // pie en todas las hojas
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      const yp = A4.h - 20;
      relleno(C.dorado);
      doc.rect(M, yp - 6, A4.w - 2 * M, 0.6, "F");
      fuente(titulo, "normal", 11);
      color(C.teal);
      doc.text("Se imprime a pedido · elegís el color", M, yp);
      fuente("helvetica", "normal", 9);
      color(C.gris);
      const contacto = [pr.wa ? "WhatsApp " + latin(pr.wa) : "", latin(pr.ig)].filter(Boolean).join("   ·   ");
      doc.text(contacto, M, yp + 6);
      if (n > 1) doc.text(p + "/" + n, A4.w - M, yp + 6, { align: "right" });
    }

    if (deps.salida === "doc") return doc;
    if (deps.salida === "arraybuffer") return doc.output("arraybuffer");
    return doc.output("blob");
  }

  const api = { idDeDrive, cargarImagen, generarPdf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(raiz, api);
})(typeof window !== "undefined" ? window : globalThis);
