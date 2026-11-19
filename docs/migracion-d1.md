# Migración a Cloudflare D1

- `app/calculo.js` es el cálculo de costo y precio sacado de `app.js` a un módulo puro (sin pantalla ni estado global): recibe la pieza y los datos y devuelve costo, precio, horas y gramos.
- Existe para que la app, el servidor y el futuro Worker usen la misma cuenta; `tests/calculo-paridad.test.js` compara contra casos dorados de la app y contra `calcular_()`, así un precio nunca sale distinto en el catálogo y en la pantalla.
