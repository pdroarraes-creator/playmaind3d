export const CATEGORIAS = {
  todos: "Todos",
  sensoriales: "Juegos Sensoriales",
  deco: "D3cor",
  kits: "Kits para Regalo",
};

const TERRACOTA = { nombre: "Terracota", hex: "#C86D51" };
const PETROLEO = { nombre: "Petróleo", hex: "#0F4C45" };
const CREMA = { nombre: "Crema", hex: "#EAE0CB" };
const SALVIA = { nombre: "Salvia", hex: "#839582" };
const MOSTAZA = { nombre: "Mostaza", hex: "#C59743" };

export const PRODUCTOS = [
  { id: "infinity-cube", nombre: "Cubo Infinito Articulado", linea: "sensoriales", precio: 4999, colores: [TERRACOTA, PETROLEO, CREMA], demo: "cube-demo", uso: "Doblalo en distintas direcciones para mantener las manos ocupadas, sin pantallas.", medida: "5 × 5 × 5 cm", tiempo: "1 h 30 min" },
  { id: "sensorial-turtle", nombre: "Tortuga Sensorial", linea: "sensoriales", precio: 5499, colores: [SALVIA, CREMA, TERRACOTA], uso: "Mové sus patitas articuladas y sentí las texturas del caparazón.", medida: "9 × 7 × 3 cm", tiempo: "2 h 50 min" },
  { id: "spiral-cone", nombre: "Cono Espiral Fidget", linea: "sensoriales", precio: 5999, colores: [PETROLEO, TERRACOTA, MOSTAZA], uso: "Giralo y deslizá la espiral entre los dedos para hacer una pausa táctil.", medida: "Ø 5 × 7 cm", tiempo: "1 h 40 min" },
  { id: "fidget-star", nombre: "Estrella Fidget", linea: "sensoriales", precio: 7999, colores: [MOSTAZA, PETROLEO, CREMA], uso: "Hacé girar la estrella entre los dedos o sobre el escritorio.", medida: "7 × 7 × 2 cm", tiempo: "1 h 40 min" },
  { id: "cat-stand", nombre: "Soporte para Lentes Gato", linea: "deco", precio: 9999, colores: [CREMA, PETROLEO, TERRACOTA], uso: "Dejá tus lentes a mano y protegé los cristales de rayones sobre la mesa.", medida: "10 × 8 × 11 cm", tiempo: "1 h 45 min" },
  { id: "geometric-pot", nombre: "Maceta Geométrica D3cor", linea: "deco", precio: 11999, colores: [TERRACOTA, CREMA, SALVIA], uso: "Usala como cubremaceta para una suculenta pequeña. Planta no incluida.", medida: "Ø 9 × 8 cm", tiempo: "3 h 10 min" },
  { id: "christmas-pack", nombre: "Llaveros Navideños Personalizados", linea: "kits", precio: 2499, colores: [PETROLEO, TERRACOTA, CREMA], navidad: true, pack: 5, uso: "Regalá llaveros con forma de arbolito y una tag con el nombre que elijas.", medida: "5 × 4 cm por llavero", tiempo: "30 min por llavero" },
  { id: "pause-kit", nombre: "Kit Pausa Sensorial", linea: "kits", precio: 9499, colores: [TERRACOTA, PETROLEO, CREMA], uso: "Un cubo y un cono en una caja kraft lista para regalar. El color elegido corresponde al cono.", medida: "Caja de 16 × 10 × 7 cm", tiempo: "3 h 10 min por kit" },
];

export const PACKS = [
  { unidades: 1, descuento: 0, etiqueta: "1 unidad" },
  { unidades: 3, descuento: 10, etiqueta: "Pack x3 −10%" },
  { unidades: 5, descuento: 15, etiqueta: "Pack x5 −15%" },
  { unidades: 10, descuento: 20, etiqueta: "Pack x10 −20%" },
];
