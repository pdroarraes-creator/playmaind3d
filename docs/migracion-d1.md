# Migración a Cloudflare D1

- `app/calculo.js` es el cálculo de costo y precio sacado de `app.js` a un módulo puro (sin pantalla ni estado global): recibe la pieza y los datos y devuelve costo, precio, horas y gramos.
- Existe para que la app, el servidor y el futuro Worker usen la misma cuenta; `tests/calculo-paridad.test.js` compara contra casos dorados de la app y contra `calcular_()`, así un precio nunca sale distinto en el catálogo y en la pantalla.
- `api-worker/` es el Worker `playmind3d-api` (esqueleto): responde `GET /salud`, maneja CORS para `playmind3d.com` (más `ORIGENES_EXTRA`) y devuelve 404 JSON en el resto; todavía no tiene lógica de estado ni autenticación.
- La configuración base de `wrangler.toml` es staging (`playmind-staging`) y producción va en `[env.prod]`; los `database_id` están en `PENDIENTE` hasta crear las bases (Task 6).
- O estado vive numa única linha da tabela `estado` (`api-worker/migrations/0001_estado.sql`) com um número de versão `v` que sobe de 1 em 1; `leerEstado`/`guardarEstado` ficam em `api-worker/src/estado.js`.
- O lock é "só grava se a versão ainda for a que você leu": um único `UPDATE ... WHERE v = ?` decide no próprio SQL (sem ler e gravar em JS), então duas gravações com a mesma base nunca passam as duas; quem perde recebe o estado atual para fundir. Os testes usam SQLite real (`node:sqlite`) em vez de mock.
