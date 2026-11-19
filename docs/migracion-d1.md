# Migración a Cloudflare D1

- `app/calculo.js` es el cálculo de costo y precio sacado de `app.js` a un módulo puro (sin pantalla ni estado global): recibe la pieza y los datos y devuelve costo, precio, horas y gramos.
- Existe para que la app, el servidor y el futuro Worker usen la misma cuenta; `tests/calculo-paridad.test.js` compara contra casos dorados de la app y contra `calcular_()`, así un precio nunca sale distinto en el catálogo y en la pantalla.
- `api-worker/` es el Worker `playmind3d-api` (esqueleto): responde `GET /salud`, maneja CORS para `playmind3d.com` (más `ORIGENES_EXTRA`) y devuelve 404 JSON en el resto; todavía no tiene lógica de estado ni autenticación.
- La configuración base de `wrangler.toml` es staging (`playmind-staging`) y producción va en `[env.prod]`; los `database_id` están en `PENDIENTE` hasta crear las bases (Task 6).
