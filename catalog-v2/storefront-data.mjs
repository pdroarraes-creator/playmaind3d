export const CATEGORIAS = {
  todos: "Todos",
  sensoriales: "Juegos Sensoriales",
  deco: "D3cor",
  kits: "Kits para Regalo",
};

export const PRODUCTOS = [
  { id: "infinity-cube", nombre: "Cubo Infinito Articulado", linea: "sensoriales", precio: 4999, demo: "cube-demo", tags: ["Más pedido", "Bolsillo"], rasgo: "Se pliega sin fin, entra en el bolsillo", uso: "Doblalo en distintas direcciones para mantener las manos ocupadas, sin pantallas.", medida: "5 × 5 × 5 cm", tiempo: "1 h 30 min" },
  { id: "sensorial-turtle", nombre: "Tortuga Sensorial", linea: "sensoriales", precio: 5499, tags: ["Articulada"], rasgo: "Patitas que se mueven y caparazón texturado", uso: "Mové sus patitas articuladas y sentí las texturas del caparazón.", medida: "9 × 7 × 3 cm", tiempo: "2 h 50 min" },
  { id: "spiral-cone", nombre: "Cono Espiral Fidget", linea: "sensoriales", precio: 5999, tags: ["Táctil"], rasgo: "Espiral suave para girar entre los dedos", uso: "Giralo y deslizá la espiral entre los dedos para hacer una pausa táctil.", medida: "Ø 5 × 7 cm", tiempo: "1 h 40 min" },
  { id: "fidget-star", nombre: "Estrella Fidget", linea: "sensoriales", precio: 7999, tags: ["Giratoria"], rasgo: "Gira largo y silencioso sobre la mesa", uso: "Hacé girar la estrella entre los dedos o sobre el escritorio.", medida: "7 × 7 × 2 cm", tiempo: "1 h 40 min" },
  { id: "cat-stand", nombre: "Soporte para Lentes Gato", linea: "deco", precio: 9999, tags: ["Escritorio"], rasgo: "Tus lentes siempre a mano y sin rayones", uso: "Dejá tus lentes a mano y protegé los cristales de rayones sobre la mesa.", medida: "10 × 8 × 11 cm", tiempo: "1 h 45 min" },
  { id: "geometric-pot", nombre: "Maceta Geométrica D3cor", linea: "deco", precio: 11999, tags: ["Deco"], rasgo: "Facetas modernas para tu suculenta", uso: "Usala como cubremaceta para una suculenta pequeña. Planta no incluida.", medida: "Ø 9 × 8 cm", tiempo: "3 h 10 min" },
  { id: "christmas-pack", nombre: "Llaveros Navideños Personalizados", linea: "kits", precio: 2499, navidad: true, pack: 5, tags: ["Personalizable"], rasgo: "Arbolitos con tag y el nombre que elijas", uso: "Regalá llaveros con forma de arbolito y una tag con el nombre que elijas.", medida: "5 × 4 cm por llavero", tiempo: "30 min por llavero" },
  { id: "pause-kit", nombre: "Kit Pausa Sensorial", linea: "kits", precio: 9499, tags: ["Listo para regalar"], rasgo: "Cubo + cono en caja kraft", uso: "Un cubo y un cono en una caja kraft lista para regalar.", medida: "Caja de 16 × 10 × 7 cm", tiempo: "3 h 10 min por kit" },
];

export const PACKS = [
  { unidades: 1, descuento: 0, etiqueta: "1 unidad" },
  { unidades: 3, descuento: 10, etiqueta: "Pack x3 −10%" },
  { unidades: 5, descuento: 15, etiqueta: "Pack x5 −15%" },
  { unidades: 10, descuento: 20, etiqueta: "Pack x10 −20%" },
];
