import { $, el } from "./util.js";
import { D } from "./estado.js";
import { toast } from "./ui.js";
import { save } from "./nube.js";
import { renderCalc } from "./editor.js";

export let fotosTmp = [];
export function setFotosTmp(v) {
  fotosTmp = v;
}

/* ---------- fotos ---------- */
export function leerFoto(file, cb) {
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 520,
        sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc);
      cv.height = Math.round(img.height * sc);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => toast("No se pudo leer esa imagen.");
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
}
function quitarFoto(i) {
  fotosTmp.splice(i, 1);
  pintarFoto();
  renderCalc();
}
export function pintarFoto() {
  const b = $("#fotoBox");
  b.textContent = "";
  if (!fotosTmp.length) {
    b.textContent = "📷";
    return;
  }
  b.appendChild(el("img", { src: fotosTmp[0], alt: "" }));
  const tira = $("#fotoTira");
  tira.textContent = "";
  fotosTmp.forEach((f, i) => {
    const m = el(
      "div",
      { class: "minifoto" + (i === 0 ? " tapa" : "") },
      el("img", { src: f, alt: "" }),
      el(
        "button",
        {
          class: "x",
          title: "Quitar",
          onclick: (ev) => {
            ev.stopPropagation();
            quitarFoto(i);
          },
        },
        "×",
      ),
      i === 0 ? el("span", { class: "sello" }, "portada") : null,
    );
    if (i > 0) {
      m.title = "Poner de portada";
      m.addEventListener("click", (ev) => {
        if (ev.target.tagName === "BUTTON") return;
        fotosTmp.unshift(fotosTmp.splice(i, 1)[0]);
        pintarFoto();
        renderCalc();
        toast("Ahora esta es la portada.");
      });
    }
    tira.appendChild(m);
  });
}
export function pintarMarca() {
  const lb = $("#logoBox");
  lb.textContent = "";
  if (D.cfg.logo) lb.appendChild(el("img", { src: D.cfg.logo, alt: "" }));
  else lb.appendChild(el("b", {}));
  $("#brandName").textContent = D.cfg.marca || "PlayMind 3D";
  document.title = D.cfg.marca || "PlayMind 3D";
}
export function pintarLeti() {
  const b = $("#letiFotoBox");
  if (!b) return;
  b.textContent = "";
  if (D.cfg.leti && D.cfg.leti.foto)
    b.appendChild(
      el("img", {
        src: D.cfg.leti.foto,
        alt: "",
        style: "width:100%;height:100%;object-fit:cover",
      }),
    );
  else b.textContent = "🧑‍🎨";
}
export const thumb = (p) => {
  const t = el("div", { class: "thumb" });
  if (p && p.foto) t.appendChild(el("img", { src: p.foto, alt: "", loading: "lazy" }));
  else t.textContent = "🧩";
  return t;
};
export function iniciarFotos() {
  $("#fFoto").addEventListener("change", (e) => {
    const arch = Array.from(e.target.files || []);
    arch.forEach((f) =>
      leerFoto(f, (d) => {
        if (fotosTmp.length < 8) {
          fotosTmp.push(d);
          pintarFoto();
          renderCalc();
        }
      }),
    );
    e.target.value = "";
  });
  $("#fLogo").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    leerFoto(f, (d) => {
      D.cfg.logo = d;
      save();
      pintarMarca();
      toast("Logo actualizado.");
    });
    e.target.value = "";
  });
  $("#fLetiFoto").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    leerFoto(f, (d) => {
      D.cfg.leti.foto = d;
      save();
      pintarLeti();
      toast("Foto actualizada.");
    });
    e.target.value = "";
  });
}
