# Migración a Cloudflare D1

- `app/calculo.js` es el cálculo de costo y precio sacado de `app.js` a un módulo puro (sin pantalla ni estado global): recibe la pieza y los datos y devuelve costo, precio, horas y gramos.
- Existe para que la app, el servidor y el futuro Worker usen la misma cuenta; `tests/calculo-paridad.test.js` compara contra casos dorados de la app y contra `calcular_()`, así un precio nunca sale distinto en el catálogo y en la pantalla.
- `api-worker/` es el Worker `playmind3d-api` (esqueleto): responde `GET /salud`, maneja CORS para `playmind3d.com` (más `ORIGENES_EXTRA`) y devuelve 404 JSON en el resto; todavía no tiene lógica de estado ni autenticación.
- La configuración base de `wrangler.toml` es staging (`playmind-staging`) y producción va en `[env.prod]`; los `database_id` están en `PENDIENTE` hasta crear las bases (Task 6).
- O estado vive numa única linha da tabela `estado` (`api-worker/migrations/0001_estado.sql`) com um número de versão `v` que sobe de 1 em 1; `leerEstado`/`guardarEstado` ficam em `api-worker/src/estado.js`.
- O lock é "só grava se a versão ainda for a que você leu": um único `UPDATE ... WHERE v = ?` decide no próprio SQL (sem ler e gravar em JS), então duas gravações com a mesma base nunca passam as duas; quem perde recebe o estado atual para fundir. Os testes usam SQLite real (`node:sqlite`) em vez de mock.
- A migração se verifica comparando o estado de origem com o carregado no D1: contagens por lista (`produtos`, `vendas`, etc.) e um hash SHA-256 do JSON canônico (chaves ordenadas, sem `_v`, `_sucio`, `cfg.token`, `cfg.key`), com `node scripts/migracion-d1.js resumen|comparar`.
- `node scripts/migracion-d1.js carga <estado.json> <saida.sql>` gera o SQL de carga; os arquivos com dados reais (`*.estado.json`, `*.carga.sql`, `salida-d1.json`, `datos-privados/`) estão no `.gitignore` e nunca entram no git.

## Estado del staging (2026-11-19)

- Bancos D1 creados con la migración `0001_estado.sql` aplicada, **sin datos**: `playmind-staging` (`3e5bd45b-1830-4633-8600-2b5baba6e2af`) y `playmind-prod` (`8a0a4cf3-9642-4311-a0ca-763ffbe2f96a`).
- Worker de staging publicado en https://playmind3d-api.pdroarraes.workers.dev (solo `/salud` y 404). El Worker `prod` todavía no fue publicado.
- Límites consultados: ver `docs/migracion-d1-limites.md`. Falta el ensayo con el estado real (Task 6, pasos 4 a 6).
