/* ---------- almacenamiento ---------- */
export const LOGO_FULL = "/assets/logo-app-full.png";
export const LOGO = "/assets/logo-app.png";
/* Dirección del servidor (Apps Script). Es la misma para todos los que entren. */
export const SERVIDOR =
  "https://script.google.com/macros/s/AKfycbyiHVXBAnYzs_CBnIuURgBWuTQS0HFFrKExcPiyxviLDAZiLmsgZ0a-9wE8Y2c1yzDy/exec";
export const WORKER_CADASTRO = "https://playmind3d-cadastro.pdroarraes.workers.dev";
export const KEY = "playmind3d:v2";
export const local = {
  async get() {
    try {
      if (window.storage && window.storage.get) {
        const r = await window.storage.get(KEY);
        return r && r.value ? JSON.parse(r.value) : null;
      }
      const v = window.localStorage.getItem(KEY);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  },
  async set(d) {
    const s = JSON.stringify(d);
    try {
      if (window.storage && window.storage.set) {
        await window.storage.set(KEY, s);
        return;
      }
      window.localStorage.setItem(KEY, s);
    } catch (e) {
      console.warn(e);
    }
  },
};

export const defaults = () => ({
  cfg: {
    marca: "Play Mind 3d",
    logo: LOGO,
    wa: "",
    email: "",
    catalogo: "",
    kwh: 230,
    maoObra: 0,
    risco: 12,
    mult: 4,
    round: 500,
    merma: 12,
    api: "",
    token: "",
    leti: { cita: "", historia: "", foto: "" },
  },
  canais: [
    { id: "c1", nome: "Escuela", comision: 0 },
    { id: "c2", nome: "WhatsApp", comision: 0 },
    { id: "c3", nome: "Marketplace", comision: 13 },
  ],
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
  insumos: [
    { id: "n1", nome: "Bolsita chica", pack: 7500, unid: 100, stock: 100 },
    { id: "n2", nome: "Bolsita grande", pack: 35000, unid: 25, stock: 25 },
    { id: "n3", nome: "Etiqueta", pack: 10000, unid: 50, stock: 50 },
    { id: "n4", nome: "Argolla de llavero", pack: 5800, unid: 100, stock: 100 },
  ],
  produtos: [],
  vendas: [],
  pedido: {},
  pedidoFil: {},
  radar: [],
  packs: [],
  opiniones: [],
  v: 2,
  _sucio: false,
});
export let D = defaults();

/** Único lugar que reasigna D: los importadores la leen por live binding. */
export function reemplazarEstado(x) {
  D = x;
}
