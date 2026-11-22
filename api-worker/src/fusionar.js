// Reproduce `fusionar_` de server/Codigo.gs. El test de paridad
// (test/fusionar.test.js) corre las dos versiones con los mismos datos y las
// mantiene juntas: si se toca una, hay que tocar la otra.

// Listas donde cada elemento tiene id propio y se fusionan elemento por
// elemento. cfg, pedido y pedidoFil no están a propósito: ahí gana el cliente.
export const LISTAS_CON_ID = ['produtos', 'filamentos', 'impressoras', 'insumos',
  'vendas', 'canais', 'packs', 'opiniones', 'radar'];

// Junta lo que manda un cliente desactualizado con lo ya guardado: lo del
// cliente se respeta tal cual y lo que solo está en el servidor se conserva.
// Una baja hecha desde una copia vieja no se aplica (el ítem reaparece).
// No muta las entradas: trabaja sobre copias y devuelve la fusionada.
export function fusionar(servidor, cliente) {
  if (!servidor || !cliente) {
    const uno = cliente || servidor;
    return uno ? structuredClone(uno) : uno;
  }
  const s0 = structuredClone(servidor);
  const salida = structuredClone(cliente);
  for (const k of LISTAS_CON_ID) {
    const s = s0[k], c = salida[k];
    if (!Array.isArray(s) || !Array.isArray(c)) continue;

    const tieneElCliente = new Set();
    for (const it of c) if (it && it.id) tieneElCliente.add(it.id);

    const lista = c.slice();
    for (const it of s) {
      if (it && it.id && !tieneElCliente.has(it.id)) lista.push(it);
    }

    // las ventas se leen de la más nueva a la más vieja
    if (k === 'vendas') {
      lista.sort((a, b) =>
        String((b && b.data) || '').localeCompare(String((a && a.data) || '')));
    }
    salida[k] = lista;
  }
  return salida;
}
