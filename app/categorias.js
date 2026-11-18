/* ---------- categorías: reglas puras ----------
 * Lista de categorías en D.categorias (nombres, en orden) y p.cats en cada
 * pieza (fuente de verdad). p.cat queda como espejo de p.cats[0] para lo que
 * todavía lee texto. Sin DOM: la usan app.js, presupuesto-pdf.js y las pruebas.
 * server/Codigo.gs tiene una copia de estas reglas (tests/servidor-categorias).
 */
(function (raiz) {
  const CATS_INICIALES = ["Decoración", "Halloween", "Navidad", "Sensoriales", "Biología"];

  const slugCat = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const limpio = (s) => String(s || "").replace(/\s+/g, " ").trim();
  const buscar = (lista, nombre) => {
    const s = slugCat(nombre);
    return s ? lista.find((c) => slugCat(c) === s) || null : null;
  };

  function ponerCats(p, cats) {
    const out = [];
    (cats || []).forEach((c) => {
      c = limpio(c);
      if (slugCat(c) && !out.some((x) => slugCat(x) === slugCat(c))) out.push(c);
    });
    p.cats = out;
    p.cat = out[0] || "";
  }

  /** Nombre canónico de la lista; si no está, lo agrega al final. */
  function asegurar(D, nombre) {
    const n = limpio(nombre);
    if (!slugCat(n)) return null; // "🎄" o "★" solos no se pueden buscar ni enlazar
    const ya = buscar(D.categorias, n);
    if (ya) return ya;
    D.categorias.push(n);
    return n;
  }

  function migrarCategorias(D) {
    if (!D.cfg) D.cfg = {};
    if (typeof D.cfg.temaSitio !== "string") D.cfg.temaSitio = "";
    const produtos = Array.isArray(D.produtos) ? D.produtos : [];
    if (!Array.isArray(D.categorias)) {
      D.categorias = [];
      produtos.forEach((p) => p && p.cat && asegurar(D, p.cat));
      CATS_INICIALES.forEach((c) => asegurar(D, c));
    }
    produtos.forEach((p) => {
      if (!p) return;
      let cats = Array.isArray(p.cats) ? p.cats.slice() : p.cat ? [p.cat] : [];
      // app viejo en caché: sólo cambia p.cat
      if (p.cat && !cats.some((c) => slugCat(c) === slugCat(p.cat))) {
        if (cats.length) cats[0] = p.cat;
        else cats = [p.cat];
      }
      ponerCats(p, cats.map((c) => asegurar(D, c)).filter(Boolean));
    });
  }

  function catsDesdeTexto(texto, lista, op) {
    const crear = !!(op && op.crear);
    const cats = [],
      nuevas = [];
    String(texto || "")
      .split(",")
      .map(limpio)
      .filter((t) => slugCat(t))
      .forEach((t) => {
        const ya = buscar(lista, t) || buscar(nuevas, t);
        if (buscar(lista, t)) cats.push(ya);
        else {
          if (!buscar(nuevas, t)) nuevas.push(t);
          if (crear) cats.push(ya || t);
        }
      });
    return { cats, nuevas };
  }

  const agregarCategoria = (D, nombre) => asegurar(D, nombre);

  /** Lo que manda el chat: sólo cambia si alguna categoría existe; nunca borra por un nombre desconocido. */
  function catsDelChat(p, texto, lista) {
    const r = catsDesdeTexto(texto, lista, { crear: false });
    if (!r.cats.length) return { cambio: false, nuevas: r.nuevas };
    ponerCats(p, r.cats);
    return { cambio: true, nuevas: r.nuevas };
  }

  /** Deja sólo las categorías que siguen en la lista, con el nombre de la lista. */
  const depurarCats = (cats, lista) =>
    (cats || []).map((c) => buscar(lista, c)).filter((c, i, a) => c && a.indexOf(c) === i);

  function renombrarCategoria(D, viejo, nuevo) {
    const v = buscar(D.categorias, viejo);
    const n = limpio(nuevo);
    if (!v || !n) return;
    const destino = D.categorias.find((c) => c !== v && slugCat(c) === slugCat(n));
    if (destino) D.categorias = D.categorias.filter((c) => c !== v);
    else D.categorias[D.categorias.indexOf(v)] = n;
    const final = destino || n;
    (D.produtos || []).forEach((p) => {
      if (p && Array.isArray(p.cats)) ponerCats(p, p.cats.map((c) => (slugCat(c) === slugCat(v) ? final : c)));
    });
  }

  function moverCategoria(D, nombre, delta) {
    const i = D.categorias.indexOf(buscar(D.categorias, nombre));
    const j = i + delta;
    if (i < 0 || j < 0 || j >= D.categorias.length) return;
    const l = D.categorias;
    [l[i], l[j]] = [l[j], l[i]];
  }

  const tiene = (p, nombre) => Array.isArray(p.cats) && p.cats.some((c) => slugCat(c) === slugCat(nombre));
  const usoCategoria = (produtos, nombre) => (produtos || []).filter((p) => p && tiene(p, nombre)).length;

  function borrarCategoria(D, nombre) {
    const n = usoCategoria(D.produtos, nombre);
    D.categorias = D.categorias.filter((c) => slugCat(c) !== slugCat(nombre));
    (D.produtos || []).forEach((p) => {
      if (p && tiene(p, nombre)) ponerCats(p, p.cats.filter((c) => slugCat(c) !== slugCat(nombre)));
    });
    return n;
  }

  const piezasDeCategoria = (produtos, nombre) =>
    (produtos || []).filter((p) => p && (!slugCat(nombre) || tiene(p, nombre)));

  const linkCategoria = (nombre, base = "https://playmind3d.com/") => base + "?cat=" + slugCat(nombre);

  const dos = (n) => String(n).padStart(2, "0");

  /** Datos del catálogo PDF de una categoría. Nunca lleva costo, ganancia ni horas. */
  function armarCatalogo(produtos, nombre, o) {
    const nom = (o.lista && buscar(o.lista, nombre)) || limpio(nombre);
    const d = o.fecha || new Date();
    const items = piezasDeCategoria(produtos, nom)
      .filter((p) => !p.oculta)
      .map((p) => ({
        nome: p.nome || "Pieza",
        precio: Math.round(Number(o.precioDe(p)) || 0),
        foto: (Array.isArray(p.fotos) && p.fotos[0]) || p.foto || "",
        color: p.libre ? "Elegís el color" : "",
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "es"));
    return {
      titulo: "Catálogo · " + nom,
      nombre: nom,
      fecha: dos(d.getDate()) + "/" + dos(d.getMonth() + 1) + "/" + d.getFullYear(),
      link: linkCategoria(nom),
      marca: o.marca || "PlayMind 3d",
      wa: o.wa || "",
      ig: o.ig || "",
      items,
    };
  }

  const nombreArchivoCatalogo = (nombre) =>
    "Catalogo-" +
    String(nombre || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") +
    ".pdf";

  const api = {
    armarCatalogo, nombreArchivoCatalogo, catsDelChat, depurarCats,
    CATS_INICIALES, slugCat, migrarCategorias, catsDesdeTexto, ponerCats, agregarCategoria,
    renombrarCategoria, moverCategoria, borrarCategoria, usoCategoria, piezasDeCategoria, linkCategoria,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else Object.assign(raiz, api);
})(typeof window !== "undefined" ? window : globalThis);
