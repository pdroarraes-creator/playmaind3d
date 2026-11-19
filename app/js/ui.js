import { D } from "./estado.js";
import { $ } from "./util.js";
import {
  renderCat,
  renderPed,
  renderVen,
  renderVit,
  renderRad,
  renderCalc,
  fillSel,
  filName,
  insumosInputs,
  renderAccesos,
  renderCfgLists,
  insumosSel,
} from "./main.js";

export function renderLight() {
  renderCat();
  renderPed();
  renderVen();
  renderVit();
  renderRad();
  renderCalc();
}
export function renderAll() {
  const kf = $("#c_fil").value,
    ki = $("#c_imp").value;
  fillSel(
    $("#c_fil"),
    D.filamentos.map((f) => ({ id: f.id, nome: filName(f.id) })),
    kf,
  );
  fillSel($("#c_imp"), D.impressoras, ki);
  insumosInputs(insumosSel);
  renderAccesos();
  renderCfgLists();
  renderCat();
  renderPed();
  renderVen();
  renderVit();
  renderRad();
  renderCalc();
}
let tId;
export function toast(m) {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("on");
  clearTimeout(tId);
  tId = setTimeout(() => t.classList.remove("on"), 1800);
}
export function showTab(n) {
  document
    .querySelectorAll("nav.tabs button")
    .forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === n)));
  ["cat", "calc", "ped", "vit", "rad", "ven", "cfg"].forEach((t) => {
    $("#tab-" + t).hidden = t !== n;
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}
