# Migración a Cloudflare D1

- `app/calculo.js` es el cálculo de costo y precio sacado de `app.js` a un módulo puro (sin pantalla ni estado global): recibe la pieza y los datos y devuelve costo, precio, horas y gramos.
- Existe para que la app, el servidor y el futuro Worker usen la misma cuenta; `tests/calculo-paridad.test.js` compara contra casos dorados de la app y contra `calcular_()`, así un precio nunca sale distinto en el catálogo y en la pantalla.
- `api-worker/` es el Worker `playmind3d-api` (esqueleto): responde `GET /salud`, maneja CORS para `playmind3d.com` (más `ORIGENES_EXTRA`) y devuelve 404 JSON en el resto; todavía no tiene lógica de estado ni autenticación.
- La configuración base de `wrangler.toml` es staging (`playmind-staging`) y producción va en `[env.prod]`; los `database_id` de ambas bases ya están completos en `api-worker/wrangler.toml` (ver "Estado real da Etapa 0" más abajo).
- O estado vive numa única linha da tabela `estado` (`api-worker/migrations/0001_estado.sql`) com um número de versão `v` que sobe de 1 em 1; `leerEstado`/`guardarEstado` ficam em `api-worker/src/estado.js`.
- O lock é "só grava se a versão ainda for a que você leu": um único `UPDATE ... WHERE v = ?` decide no próprio SQL (sem ler e gravar em JS), então duas gravações com a mesma base nunca passam as duas; quem perde recebe o estado atual para fundir. Os testes usam SQLite real (`node:sqlite`) em vez de mock.
- A migração se verifica comparando o estado de origem com o carregado no D1: contagens por lista (`produtos`, `vendas`, etc.) e um hash SHA-256 do JSON canônico (chaves ordenadas, sem `_v`, `_sucio`, `cfg.token`, `cfg.key`), com `node scripts/migracion-d1.js resumen|comparar`.
- `node scripts/migracion-d1.js carga <estado.json> <saida.sql>` gera o SQL de carga; os arquivos com dados reais (`*.estado.json`, `*.carga.sql`, `salida-d1.json`, `datos-privados/`) estão no `.gitignore` e nunca entram no git.

## Estado real da Etapa 0 (2026-11-19)

Ensaio feito com o estado real do Pedro, carregado só em `playmind-staging` (`playmind-prod` continua vazio):
- Carga (`node scripts/migracion-d1.js carga`) executada com `wrangler d1 execute --remote`; lida de volta, `comparar` deu `iguales: true`.
- O JSON guardado não tem `_sucio` nem `_v` (0 ocorrências); a coluna `v` da linha vale 1. O campo `v` dentro do estado vale 2 (versão do formato de `D`, vem do app, não é o mesmo `v`).
- Tamanho: 34.447 caracteres no estado de origem (34.412 guardados, depois de tirar `_sucio` e `_v`); 1,72% do limite de 2 MB por linha do D1.
- Medição do cálculo: ver `docs/migracion-d1-limites.md` (mediana 0,03 ms para 43 peças; 0,08 ms para 430).

### O que a Etapa 1 precisa saber

- Bancos: `playmind-staging` = `3e5bd45b-1830-4633-8600-2b5baba6e2af`; `playmind-prod` = `8a0a4cf3-9642-4311-a0ca-763ffbe2f96a` (vazio, sem Worker publicado).
- Staging: https://playmind3d-api.pdroarraes.workers.dev (só `/salud` e 404; o Worker `prod` não foi publicado). `playmind-staging` guarda o estado real (ensaio feito); `playmind-prod` está vazio. Os `database_id` já estão em `api-worker/wrangler.toml`.
- Migrations: os comandos de prod precisam de `--env prod`; os de staging, de `--env=""` (há `[env.prod]`).
- O CLI `scripts/migracion-d1.js comparar` sai com código 1 tanto para "diferentes" quanto para arquivo ilegível; ler a saída impressa.
- O estado exportado vinha com `_sucio: true`: o navegador tinha mudanças ainda não sincronizadas; a Etapa 1 deve decidir como tratar isso no primeiro corte.
- Staging `playmind-staging` guarda o estado REAL do dono: todo endpoint de dados que se acrescente ao Worker de staging precisa de autenticação antes do deploy. Alguém tem que ser dono de limpar ou renovar essa linha (sugestão: `DELETE FROM estado` depois dos testes da Etapa 1; decide o dono).
- `sqlCarga` usa `INSERT OR REPLACE ... v=1`: no corte real sobrescreveria uma linha existente e zeraria `v`; a Etapa 1 deve recusar rodar se já existir linha (ou usar `INSERT` simples). Também emite um único statement com o JSON inteiro; o D1 limita um statement a ~100 KB (ver o doc de limites): sobra folga com 34 KB, mas fica o aviso.
- Fonte da verdade da migração real: a spec diz que o script lê o estado "via `action=load`" (célula do servidor). O ensaio usou uma exportação do navegador, com `_sucio: true` (mudanças locais sem sincronizar), que NÃO é necessariamente o que o servidor guarda. No corte, a fonte deve ser o `load` do servidor, e o plano precisa dizer o que fazer com mudanças não sincronizadas do navegador.
- Margem do rollback: a spec só promete voltar ao Apps Script abaixo de ~45.000 caracteres e o estado já tem 34.447 (~69%): os ~10.500 caracteres restantes são um prazo, não nota de rodapé.
- Pendente de decisão do dono: a spec lista "catálogo pré-calculado no save" como decisão do redator a confirmar; o doc de limites **recomenda** calcular na leitura (a CPU cabe no escopo medido). É só uma recomendação: até o dono decidir, vale a decisão da spec.
- Testes: `node:sqlite` sem flags exige Node 22.13+ (o projeto usou 22.23).
- No escopo medido (só `calcular` sobre as peças mais um `JSON.parse`, a quente, em Node), calcular na leitura cabe com folga larga. **Não confirmado:** a CPU real num Worker (inclui serializar a resposta, reescrever URLs de fotos, ler o D1 e isolate a frio) e o plano real da conta. Medir o endpoint real na Etapa 1 antes de adotar a recomendação de calcular na leitura.
- O bundle de `src/calculo.js` empacota e coincide com `app/calculo.js` (217 casos).
- Dados reais ficam só em `datos-privados/` (ignorado pelo git).
- Etapa 1a: `api-worker/src/fusionar.js` porta `fusionar_` do Apps Script (cliente vence, o que só o servidor tem é preservado, vendas da mais nova para a mais velha); não muta as entradas.
- `api-worker/test/fusionar.test.js` carrega `server/Codigo.gs` num `vm` e compara as duas versões em 100 pares gerados (semente fixa): mexeu em uma, mexa na outra.

## Etapa 1a: Worker de staging com a API completa (2026-11-19)

**O que a 1a entrega:** o Worker `playmind3d-api` (staging, banco `playmind-staging`) com `GET /salud`, catálogo público (`GET /catalogo` e `GET /?action=catalogo`, calculado na leitura com `Calculo`), e `POST` com as ações `load`, `save`, `editarPieza`, `agregarPieza`, `agregarFilamento` e `resumenNegocio`. A sessão é verificada contra o `validarSesion` do Apps Script: sem token válido nada de dados sai (sem atalho, nem em staging). O app **não** foi ligado: continua falando só com o Apps Script. A produção (`playmind-prod`, `[env.prod]`) não foi publicada.

- URL de staging: https://playmind3d-api.pdroarraes.workers.dev
- Publicado com `npx wrangler deploy --env=""` a partir de `api-worker/`. Versão: `ceafb32a-79c5-42a2-95db-bf1364f1acf8`. Pacote: 25,50 KiB (gzip 7,96 KiB), contém o código de preço; muito abaixo de 1 MiB. Início do Worker: 2 ms.

### Verificação feita (curl)

- `GET /salud` -> 200 `{"ok":true}`.
- `POST {"action":"load"}` sem token -> 200 `{"ok":false,"error":"clave"}`.
- `POST` com corpo que não é JSON -> 200 `{"ok":false,"error":"cuerpo invalido"}`.
- `OPTIONS` com `Origin: https://playmind3d.com` -> 204, `access-control-allow-origin: https://playmind3d.com`, `vary: Origin`.
- `GET /catalogo` -> 200 `{"ok":true,"catalogo":{...}}` com `access-control-allow-origin: *`.

### Catálogo comparado (só contagens)

Staging `/catalogo` contra `?action=catalogo` do Apps Script de produção (mesmo `GET`), peça a peça por `nome`:

| Item | Staging | Apps Script |
|---|---|---|
| Peças | 43 | 43 |
| Só de um lado | 0 | 0 |
| Preço diferente | 0 | |
| Outros campos diferentes | 0 | |

`opiniones`, `marca`, `wa`, `colores`, `packs` e `leti` também idênticos. Era esperado poder haver diferenças de preço vindas das divergências do `calcular_` antigo (o Apps Script de produção ainda não foi republicado); com o estado de hoje nenhuma peça cai nesses casos, então o resultado não prova nada sobre eles (isso fica coberto por `tests/calculo-paridad.test.js`).

Tempos (do sandbox, via proxy): staging 0,26 s na 1a chamada e 0,22 s na 2a; Apps Script 4,26 s. A resposta de staging não traz `cf-cache-status`, então **não deu para confirmar** que a 2a veio de cache (a diferença de tempo é pequena demais para concluir; o Worker calcula em ~0,03 ms de qualquer forma).

### Fumaça com o Pedro (Passo 4: **ainda não feito**, precisa do token dele)

Colar no console do navegador **em `https://playmind3d.com/app/`** (origem permitida). O token é lido do `localStorage` e nunca é impresso; os dados também não. O Pedro cola de volta só as duas linhas impressas.

```js
(async () => {
  const URL_API = "https://playmind3d-api.pdroarraes.workers.dev/";
  const token = JSON.parse(localStorage.getItem("playmind3d:v2")).cfg.token;
  const post = async (cuerpo) => (await fetch(URL_API, { method: "POST", body: JSON.stringify(cuerpo) })).json();
  const l = await post({ action: "load", token });
  const d = l.data || {};
  console.log({ ok: l.ok, error: l.error, v: l.v, produtos: (d.produtos || []).length, vendas: (d.vendas || []).length });
  if (!l.ok) return;
  const s = await post({ action: "save", token, v: l.v, data: l.data });
  console.log({ ok: s.ok, error: s.error, fusionado: s.fusionado, v: s.v });
})().catch((e) => console.log({ ok: false, error: String(e && e.message || e) }));
```

Como ler a saída:
1. Primeira linha: `{ ok: true, error: undefined, v: "1", produtos: 43, vendas: 9 }`. As contagens têm que ser as do estado de staging (43 peças, 9 vendas); `v` vem como texto. Se vier `ok: false, error: "clave"`, o token da sessão não foi aceito (sessão vencida: entrar de novo no app).
2. Segunda linha: `{ ok: true, error: undefined, fusionado: false, v: "2" }`: o `save` deu certo sem fusão e a versão subiu uma.

O `save` regrava no staging o mesmo estado que veio do `load` (só sobe `v`). Verificado só o que dá sem token: a sintaxe (`node --check`) e uma rodada em Node contra a URL real com token falso e `localStorage` simulado, que imprimiu `{ ok: false, error: 'clave', v: undefined, produtos: 0, vendas: 0 }` e parou sem lançar erro.

### O que o 1b precisa saber

- O Worker **não** faz login, logout, foto nem "mundo": o app terá que falar com dois servidores (Worker para estado e catálogo, Apps Script para o resto).
- `SNAPSHOT` está `"off"`; a ação `guardarSnapshot` do Apps Script só grava quando o dono ligar `d1:migrado`.
- O Apps Script precisa ser republicado (Implementar > Administrar implementaciones > lápis > Versão: NUEVA) com as ações novas `subirFotos` e `guardarSnapshot` antes de `subirFotos` funcionar; não foram exercitadas aqui.
- CORS: a rota do catálogo responde `*` (pública); o `POST` só aceita a lista de origens (`playmind3d.com`, `www`, mais `ORIGENES_EXTRA`).
- `v` volta como texto (`"1"`), e o app deve devolvê-lo como veio no `save`.
- O staging guarda o estado real do dono: o `save` do teste de fumaça muda `v` lá. Quem decide limpar a linha é o dono.
