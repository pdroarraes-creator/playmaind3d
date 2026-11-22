const plantilla = document.querySelector("#shelf-carousel-template");

export function crearCarrusel(seccion, tipo, crearTarjeta) {
  const carrusel = plantilla.content.firstElementChild.cloneNode(true);
  const controles = carrusel.querySelector("[data-carousel-toolbar]");
  const selector = carrusel.querySelector("[data-carousel-picker]");
  const estado = carrusel.querySelector("[data-carousel-count]");
  const anterior = carrusel.querySelector("[data-carousel-prev]");
  const siguiente = carrusel.querySelector("[data-carousel-next]");
  const pista = carrusel.querySelector("[data-carousel-track]");
  const titulo = seccion.querySelector("h2");
  const tarjetaPorArticulo = new WeakMap();
  let articulos = [];
  let posiciones = [];
  let montadas = new Set();
  let activa = 0;
  let cuadro;

  carrusel.setAttribute("aria-labelledby", titulo.id);
  pista.id = `${seccion.id}-carrusel`;
  pista.setAttribute("aria-label", `Tarjetas de ${titulo.textContent}`);
  pista.setAttribute("aria-description", "Usá las flechas, Inicio o Fin para navegar.");
  selector.setAttribute("aria-label", `Ir a una opción de ${titulo.textContent}`);
  anterior.setAttribute("aria-label", `${tipo} anterior`);
  siguiente.setAttribute("aria-label", `${tipo} siguiente`);
  for (const control of [selector, anterior, siguiente]) control.setAttribute("aria-controls", pista.id);
  seccion.querySelector("[data-carousel]").append(carrusel);

  function activar(indice) {
    if (activa !== indice && posiciones[activa]?.contains(document.activeElement)) pista.focus({ preventScroll: true });
    const visibles = new Set();
    for (let i = indice - 1; i <= indice + 1; i++) {
      const posicion = posiciones[i];
      if (!posicion) continue;
      posicion.inert = i !== indice;
      visibles.add(posicion);
      if (!posicion.firstElementChild) {
        const articulo = articulos[i];
        if (!tarjetaPorArticulo.has(articulo)) tarjetaPorArticulo.set(articulo, crearTarjeta(articulo));
        posicion.append(tarjetaPorArticulo.get(articulo));
      }
    }
    for (const posicion of montadas) {
      if (!visibles.has(posicion)) {
        posicion.inert = true;
        posicion.replaceChildren();
      }
    }
    montadas = visibles;
    activa = indice;
    selector.selectedIndex = indice;
    estado.textContent = `${indice + 1} de ${articulos.length} ${tipo.toLocaleLowerCase("es-AR")}s`;
    anterior.setAttribute("aria-disabled", String(indice === 0));
    siguiente.setAttribute("aria-disabled", String(indice === articulos.length - 1));
  }

  function irA(indice) {
    if (indice < 0 || indice >= articulos.length || indice === activa) return;
    activar(indice);
    pista.scrollLeft = pista.getBoundingClientRect().width * indice;
  }

  anterior.addEventListener("click", () => irA(activa - 1));
  siguiente.addEventListener("click", () => irA(activa + 1));
  selector.addEventListener("change", () => irA(selector.selectedIndex));
  pista.addEventListener("keydown", (evento) => {
    if (evento.target !== pista || evento.altKey || evento.metaKey || evento.ctrlKey || evento.shiftKey) return;
    const destinos = { ArrowLeft: activa - 1, ArrowRight: activa + 1, Home: 0, End: articulos.length - 1 };
    if (!Object.hasOwn(destinos, evento.key)) return;
    evento.preventDefault();
    irA(destinos[evento.key]);
  });
  pista.addEventListener("scroll", () => {
    if (cuadro !== undefined) return;
    cuadro = requestAnimationFrame(() => {
      cuadro = undefined;
      const ancho = pista.getBoundingClientRect().width;
      if (!ancho || !articulos.length) return;
      const indice = Math.max(0, Math.min(articulos.length - 1, Math.round(pista.scrollLeft / ancho)));
      if (indice !== activa) activar(indice);
    });
  }, { passive: true });

  return function mostrar(nuevos) {
    if (nuevos.length === articulos.length && nuevos.every((articulo, indice) => articulo === articulos[indice])) return;
    const indice = Math.max(0, nuevos.indexOf(articulos[activa]));
    articulos = nuevos;
    carrusel.hidden = !nuevos.length;
    controles.hidden = nuevos.length < 2;
    pista.tabIndex = nuevos.length > 1 ? 0 : -1;
    montadas.clear();
    posiciones = nuevos.map((_, i) => {
      const posicion = document.createElement("div");
      posicion.className = "carousel-slide";
      posicion.setAttribute("role", "group");
      posicion.setAttribute("aria-roledescription", "diapositiva");
      posicion.setAttribute("aria-label", `${i + 1} de ${nuevos.length}`);
      posicion.inert = true;
      return posicion;
    });
    pista.replaceChildren(...posiciones);
    selector.replaceChildren(...nuevos.map(({ nombre }, i) => new Option(`${i + 1}. ${nombre}`)));
    if (nuevos.length) {
      activar(indice);
      pista.scrollLeft = pista.getBoundingClientRect().width * indice;
    }
  };
}
