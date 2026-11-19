import { $, el, money } from "./util.js";
import { D } from "./estado.js";
import { toast } from "./ui.js";
import { calc } from "./calculo.js";
import { verPost } from "./main.js";

/* ---------- vitrina ---------- */
function agrupado() {
  const g = {};
  D.produtos.forEach((p) => {
    if (p.oculta) return;
    const c = (p.cat || "Otras creaciones").trim() || "Otras creaciones";
    (g[c] = g[c] || []).push(p);
  });
  return g;
}
export function renderVit() {
  $("#vitTitulo").textContent = D.cfg.marca || "PlayMind 3d";
  const lg = $("#vitLogo");
  if (D.cfg.logo) lg.src = D.cfg.logo;
  else lg.removeAttribute("src");
  const box = $("#vitList");
  box.textContent = "";
  const g = agrupado(),
    cats = Object.keys(g);
  if (!cats.length) {
    box.appendChild(
      el("div", { class: "empty" }, "Cargá piezas con foto y descripción para armar la vitrina."),
    );
    return;
  }
  cats.forEach((c) => {
    box.appendChild(el("div", { class: "vitcat" }, c));
    const grid = el("div", { class: "vitgrid" });
    g[c].forEach((p) => {
      const r = calc(p);
      grid.appendChild(
        el(
          "div",
          { class: "vitem" },
          (() => {
            const fotos = p.fotos && p.fotos.length ? p.fotos : p.foto ? [p.foto] : [];
            const ph = el("div", { class: "ph" });
            if (!fotos.length) ph.textContent = "🧩";
            fotos.forEach((f, i) =>
              ph.appendChild(
                el("img", { src: f, alt: p.nome, loading: "lazy", class: i === 0 ? "on" : "" }),
              ),
            );
            if (fotos.length > 1) {
              let act = 0;
              const ver = (n) => {
                act = (n + fotos.length) % fotos.length;
                ph.querySelectorAll("img").forEach((im, k) => im.classList.toggle("on", k === act));
                cnt.textContent = act + 1 + "/" + fotos.length;
              };
              const cnt = el("span", { class: "cnt" }, "1/" + fotos.length);
              ph.appendChild(
                el(
                  "button",
                  {
                    class: "nav prev",
                    onclick: (ev) => {
                      ev.stopPropagation();
                      ver(act - 1);
                    },
                  },
                  "‹",
                ),
              );
              ph.appendChild(
                el(
                  "button",
                  {
                    class: "nav next",
                    onclick: (ev) => {
                      ev.stopPropagation();
                      ver(act + 1);
                    },
                  },
                  "›",
                ),
              );
              ph.appendChild(cnt);
            }
            if (p.video)
              ph.appendChild(
                el(
                  "button",
                  {
                    class: "playbtn",
                    title: "Ver video",
                    onclick: (ev) => {
                      ev.stopPropagation();
                      window.open(p.video, "_blank", "noopener");
                    },
                  },
                  "▶",
                ),
              );
            return ph;
          })(),
          el(
            "div",
            { class: "txt" },
            el("b", {}, p.nome || "Sin nombre"),
            el(
              "p",
              {},
              (p.desc || "Contame si querés saber más de esta.") +
                (p.libre ? " Elegís el color." : ""),
            ),
            el("u", {}, money(r.preco)),
            el(
              "button",
              {
                class: "btn ghost mini",
                style: "margin-top:8px;width:100%",
                onclick: (ev) => {
                  ev.stopPropagation();
                  verPost(p);
                },
              },
              "Post",
            ),
          ),
        ),
      );
    });
    box.appendChild(grid);
  });
}

/** Arma un HTML suelto con SOLO el catálogo: nada de costos ni ventas. */
function vitrinaHTML() {
  const g = agrupado(),
    marca = D.cfg.marca || "PlayMind 3d";
  let cuerpo = "";
  Object.keys(g).forEach((c) => {
    cuerpo += "<h2>" + esc(c) + '</h2><div class="grid">';
    g[c].forEach((p) => {
      const r = calc(p);
      cuerpo +=
        '<div class="it">' +
        (p.foto
          ? '<img src="' + p.foto + '" alt="' + esc(p.nome) + '">'
          : '<div class="ph">🧩</div>') +
        '<div class="tx"><b>' +
        esc(p.nome || "") +
        "</b><p>" +
        esc(p.desc || "") +
        "</p><u>" +
        money(r.preco) +
        "</u></div></div>";
    });
    cuerpo += "</div>";
  });
  const wa = (D.cfg.wa || "").replace(/[^0-9]/g, "");
  return (
    '<!DOCTYPE html><html lang="es-AR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    esc(marca) +
    "</title>" +
    '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&family=Nunito:wght@400;600;800&display=swap" rel="stylesheet">' +
    "<style>body{margin:0;background:#FAF6EE;color:#3A3A38;font:15px/1.5 Nunito,sans-serif}" +
    ".w{max-width:820px;margin:0 auto;padding:22px 16px 50px}" +
    "header{display:flex;gap:13px;align-items:center;margin-bottom:22px}" +
    "header img{width:60px;height:60px;border-radius:50%;border:1.5px solid #E6DCC9;object-fit:cover}" +
    "h1{font:600 22px Fredoka,sans-serif;margin:0;color:#2C7A7B}" +
    "header p{margin:3px 0 0;font-size:13px;color:#6E6E6A}" +
    "h2{font:600 15px Fredoka,sans-serif;color:#E8895A;margin:26px 0 11px;display:flex;align-items:center;gap:9px}" +
    'h2:after{content:"";flex:1;height:1px;background:#E4DCCB}' +
    ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(152px,1fr));gap:13px}" +
    ".it{background:#fff;border:1.5px solid #E6DCC9;border-radius:15px;overflow:hidden}" +
    ".it img,.it .ph{width:100%;aspect-ratio:1;object-fit:cover;display:block}" +
    ".it .ph{background:#E3EFEC;display:grid;place-items:center;font-size:32px}" +
    ".tx{padding:10px 11px 13px}.tx b{font:600 14px Fredoka,sans-serif;display:block}" +
    ".tx p{margin:4px 0 8px;font-size:12px;color:#6E6E6A;line-height:1.45}" +
    ".tx u{text-decoration:none;font:700 15px Nunito,sans-serif;color:#2C7A7B}" +
    "footer{margin-top:34px;text-align:center;font-size:13px;color:#6E6E6A}" +
    "a.b{display:inline-block;margin-top:10px;background:#2C7A7B;color:#fff;text-decoration:none;" +
    'font:500 15px Fredoka,sans-serif;padding:11px 22px;border-radius:12px}</style></head><body><div class="w">' +
    "<header>" +
    (D.cfg.logo ? '<img src="' + D.cfg.logo + '" alt="">' : "") +
    "<div><h1>" +
    esc(marca) +
    "</h1><p>Juguetes sensoriales y creaciones en 3D, hechos a pedido.</p></div></header>" +
    cuerpo +
    "<footer>Se imprimen a pedido y elegís el color." +
    (wa ? '<br><a class="b" href="https://wa.me/' + wa + '">Hacer un pedido</a>' : "") +
    "</footer></div></body></html>"
  );
}
const esc = (t) =>
  String(t || "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
export function bajarVitrina() {
  if (!D.produtos.length) {
    toast("Primero cargá alguna pieza.");
    return;
  }
  const b = new Blob([vitrinaHTML()], { type: "text/html" });
  const a = el("a", { href: URL.createObjectURL(b), download: "catalogo-playmind3d.html" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Catálogo bajado. Podés mandarlo o publicarlo.");
}
export function compartirVitrina() {
  const g = agrupado();
  if (!D.produtos.length) {
    toast("Primero cargá alguna pieza.");
    return;
  }
  let t = (D.cfg.marca || "PlayMind 3d") + " — catálogo\n";
  Object.keys(g).forEach((c) => {
    t += "\n" + c + "\n";
    g[c].forEach((p) => {
      t += "• " + p.nome + " — " + money(calc(p).preco) + (p.desc ? "\n   " + p.desc : "") + "\n";
    });
  });
  t += "\nSe imprimen a pedido y elegís el color 🎨";
  window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank", "noopener");
}
