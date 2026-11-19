# Roteiro do dia do corte (Apps Script/Sheets -> Worker/D1)

Documento de operação da Etapa 1b. Quem executa: o controlador (Claude ou quem estiver no terminal do repositório) com o Pedro online. O corte é "ligar a chave" `d1:migrado`; o rollback é "desligar a chave". Nenhum lançamento de app no dia: o app novo já está nos celulares.

Nomes reais usados abaixo (conferidos no código):
- Menu da planilha **"PlayMind 3d"**: "Ver cuánto espacio queda", "D1: activar modo migrado", "D1: desactivar modo migrado", "D1: dirección del catálogo en el Worker".
- Script Properties do Apps Script: `d1:migrado` (vale `1` com a chave ligada), `d1:catalogoUrl`, `d1:snapshotV`, `medida:estado`.
- Actions do Apps Script: `exportarEstado` (só lê, serve com a chave ligada ou desligada, exige sessão), `guardarSnapshot` (só grava com a chave ligada), `subirFotos`.
- Worker de produção: `playmind3d-api-prod` (`wrangler deploy --env prod`, dentro de `api-worker/`), https://playmind3d-api-prod.pdroarraes.workers.dev, banco `playmind-prod` (`database_id` `8a0a4cf3-9642-4311-a0ca-763ffbe2f96a`). Variáveis em `[env.prod.vars]` de `api-worker/wrangler.toml`: `MODO` (`escritura` | `solo-lectura`) e `SNAPSHOT` (`on` | `off`).
- `GET /salud` devolve `{"ok":true,"modo":"escritura"|"solo-lectura","snapshot":null|{"v":…,"ok":true|false,"motivo":…,"cuando":"…"}}`.
- `scripts/migracion-d1.js`: `carga <estado.json> <saida.sql> [--v-inicial N]`, `resumen <estado.json>`, `comparar <a.json> <b.json>`. Códigos de saída: 0 ok, 1 `comparar` com diferenças, 2 uso incorreto, 3 arquivo ilegível ou JSON inválido.

Convenções: **todos os comandos rodam a partir da raiz do repositório**. Os `npx wrangler` vão entre parênteses `(cd api-worker && …)`, um subshell que volta sozinho à raiz; por isso, dentro deles, os arquivos aparecem como `../datos-privados/…`, e nos comandos `node` como `datos-privados/…`. Todos os arquivos com dados reais ficam em `datos-privados/` (ignorada pelo git, junto com `*.estado.json`, `*.carga.sql` e `salida-d1*.json`). Nada disso vai para o git, para o chat ou para a nuvem.

## Avisos que valem para o dia inteiro

1. **`MODO` com qualquer valor diferente de exatamente `solo-lectura` é tratado como escritura** (`rutas.js` só recusa as ações de estado quando `env.MODO === "solo-lectura"`; `/salud` também). Um erro de digitação (`solo-lectura ` com espaço, `solo_lectura`, maiúscula) vira escrita **sem aviso**. Depois de cada deploy que mexe em `MODO`, conferir em `/salud` que `modo` mostra o que se queria. **O mesmo vale para `SNAPSHOT`: qualquer valor diferente de exatamente `on` desliga o snapshot** (`api-worker/src/snapshot.js`: `env.SNAPSHOT !== "on"`), então `On` ou `on ` falham em silêncio e o rollback fica sem rede; conferir que o primeiro `/salud` depois de uma gravação mostra `snapshot` preenchido.
2. **Rollback só é prometido com o estado abaixo de ~45.000 caracteres** (célula do Sheets = 50.000). O estado hoje tem ~34.500. Acima disso o snapshot responde `excede`, a célula não é atualizada e voltar para o Apps Script perderia tudo o que o D1 recebeu desde o último snapshot gravado.
3. **O `MODO_SERVIDOR` do `cadastro-worker` deve ir para `"worker"` num redeploy depois do corte** (hoje é `"apps"`: cada pedido paga uma ida extra ao Apps Script para receber `migrado` e só então chama o Worker). Ver "Depois do corte". Antes de qualquer deploy do `cadastro-worker`, fazer o dry-run descrito na checklist (item 11).
4. **De hoje até o passo 4 do corte o Worker de produção fica em `MODO=solo-lectura`**, publicado com `--var MODO:solo-lectura` (o `--var` vale só para aquele deploy; o `wrangler.toml` continua dizendo `MODO = "escritura"`). **Nunca fazer um deploy de produção sem esse `--var` antes do passo 4**, nem depois de um rollback, ou o Worker volta a escritura. No passo 4 o `wrangler.toml` passa a dizer `SNAPSHOT = "on"` e o deploy sem `--var` é o que liga a escritura; a partir daí o arquivo reflete o que está no ar. Em `solo-lectura` o Worker **não lê nem grava estado para ninguém** (todas as ações de estado dão `revertido`): um app aberto cai no Apps Script ou mostra erro, nunca lê o D1.

## Antes (dias antes do corte)

Checklist. Cada item tem que estar marcado antes de combinar o dia. Quem faz: o controlador, salvo onde disser Pedro.

| # | Item | Como conferir | Quem |
|---|---|---|---|
| 1 | App novo (com o protocolo de dois servidores, `CACHE` `playmind3d-v28` em `app/sw.js`) publicado há **3 dias ou mais** na `main` (GitHub Pages) | `git log origin/main -1 --format=%cd -- app/` e pedir ao Pedro que confirme que os 3 aparelhos já abriram o app depois disso | controlador + Pedro |
| 2 | Apps Script com `exportarEstado` e `guardarSnapshot` publicados | No editor do Apps Script: colar `server/Codigo.gs`, salvar, **Implementar > Administrar implementaciones > lápis > Versão: NUEVA**. Salvar não basta | Pedro |
| 3 | Banco de produção com as duas migrations | `(cd api-worker && npx wrangler d1 migrations list playmind-prod --remote --env prod)` deve dizer que não há migrations pendentes. Se houver: `(cd api-worker && npx wrangler d1 migrations apply playmind-prod --remote --env prod)` | controlador |
| 4 | Banco de produção **vazio** | `(cd api-worker && npx wrangler d1 execute playmind-prod --remote --env prod --command "SELECT COUNT(*) AS n FROM estado")` deve dar `n = 0` | controlador |
| 5 | Worker de produção no ar em **`MODO=solo-lectura`** e `SNAPSHOT=off`. Em só leitura **só o catálogo (GET) e o `/salud` funcionam**: depois da autenticação, **todas** as ações de estado (`load`, `save`, `editarPieza`, `agregarPieza`, `agregarFilamento` e `resumenNegocio`) respondem `revertido` (`api-worker/src/rutas.js`). Isso garante que, entre a chave ligada (passo 1) e a carga (passo 3), nenhum aparelho consiga escrever no D1 vazio (um aparelho com `_sucio` pendente, ao receber `migrado`, tentaria gravar ali e criaria a linha `estado` com a cópia local dele) e que, depois de um rollback, nenhum aparelho leia a cópia congelada do D1 (ele a leria, guardaria no Apps Script com a `v` do D1 e a fusão deixaria a cópia velha ganhar, perdendo uma alteração feita no Apps Script) | `(cd api-worker && npx wrangler deploy --env prod --var MODO:solo-lectura)` (o `wrangler.toml` traz `SNAPSHOT = "off"`). Depois: `curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud` deve dar `{"ok":true,"modo":"solo-lectura","snapshot":null}` (palavra exata: aviso 1) | controlador |
| 6 | `d1:catalogoUrl` definido | Menu "PlayMind 3d" > **"D1: dirección del catálogo en el Worker"** > colar `https://playmind3d-api-prod.pdroarraes.workers.dev/catalogo` (tem que começar com `https://`). Confirmar que o alerta diz "Dirección guardada." O menu "D1: activar modo migrado" avisa com "OJO" se isto faltar | Pedro |
| 7 | Catálogo do Worker responde | `curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/catalogo` deve dar `ok:true` e uma lista `piezas` **vazia** (o D1 de produção ainda está vazio): é esperado agora, e só passa a ter peças depois do passo 3 do corte | controlador |
| 8 | Fuso do projeto do Apps Script = **America/Argentina/Buenos_Aires** (o `resumenNegocio` do Worker assume UTC-3; o repositório não tem `appsscript.json`) | No editor do Apps Script: Configuración del proyecto (engrenagem) > Zona horaria | Pedro |
| 9 | Medidor de espaço **abaixo de 45.000** | Menu "PlayMind 3d" > **"Ver cuánto espacio queda"**. Anotar o valor. Se disser que ainda não há medida, esperar o próximo save do app | Pedro |
| 10 | Pedro online, no computador, e **fora do horário de venda**; os outros dois da família avisados de que o app pode piscar um erro por alguns minutos | combinado no chat | Pedro |
| 11 | Dry-run dos dois Workers (nada sobe) | `(cd cadastro-worker && npx wrangler deploy --dry-run --outdir <pasta-temporária>)` e `(cd api-worker && npx wrangler deploy --env prod --dry-run --outdir <pasta-temporária>)`. O bundle do `cadastro-worker` **não tinha sido verificado antes desta tarefa**; em 19/11/2026 o dry-run dele deu 19,35 KiB (gzip 6,59 KiB) e o do `api-worker` prod 28,03 KiB (gzip 8,68 KiB), sem erro. Repetir no dia anterior | controlador |
| 12 | Backup e Time Travel do banco de produção | `(cd api-worker && npx wrangler d1 time-travel info playmind-prod --env prod)` imprime o bookmark atual (a janela é de 7 dias no plano gratuito, 30 no pago: ver `docs/migracion-d1-limites.md`). Opcional: `(cd api-worker && npx wrangler d1 export playmind-prod --remote --env prod --output ../datos-privados/prod-antes.sql)` | controlador |
| 13 | Foto do catálogo de hoje | Ver passo 0 do corte | controlador |
| 14 | Testes verdes | `node --test tests/*.test.js api-worker/test/*.test.js cadastro-worker/test/*.test.js` (Node 22.13 ou mais novo) e `node scripts/ensayo-protocolo.js` | controlador |

## O corte

Só começar com a checklist inteira marcada. Meta de duração: 30 a 40 minutos. Combinar com o Pedro que os aparelhos da família ficam **com o app fechado** (e, se possível, que cada um abra o app e espere a sincronização terminar antes de fechar) do passo 1 até o passo 5. Mesmo se algum ficar aberto, o Worker em `solo-lectura` não deixa nem ler nem escrever no D1: nessa janela (passos 1 a 3) o app mostra erro e tenta de novo a cada 20 s, sem laço, o `load` não completa e por isso o `save` não é liberado (`listoParaSubir` fica falso); o `_sucio` dele fica guardado (ver tabela). Ninguém edita nada nessa janela.

**Passo 0. Foto do catálogo de antes** (controlador, 1 minuto, **antes** de ligar a chave: depois dela o Apps Script passa a encaminhar o catálogo ao Worker).

```
APPS="https://script.google.com/macros/s/AKfycbyiHVXBAnYzs_CBnIuURgBWuTQS0HFFrKExcPiyxviLDAZiLmsgZ0a-9wE8Y2c1yzDy/exec"
curl -sSL "$APPS?action=catalogo" -o datos-privados/catalogo-antes.json
```

Esperado: arquivo com `{"ok":true,"catalogo":{… "piezas":[…]}}` (43 peças na última medição). Se o cache de 15 minutos do catálogo estiver velho, não importa: o critério é a contagem de peças.

**Passo 1. Ligar a chave** (Pedro, no menu da planilha).
Menu "PlayMind 3d" > **"D1: activar modo migrado"** > responder Sí. Esperado: alerta "Modo migrado activado." A partir daqui o Apps Script responde `migrado` a `load`, `save`, `editarPieza`, `agregarPieza`, `agregarFilamento` e `resumenNegocio`: a célula `estado` está congelada e nada mais grava nela. Anotar a hora. **O relógio do rollback começa aqui.**

**Passo 2. Baixar o estado final da célula** (Pedro, no console do navegador, **sem imprimir dados**).
Abrir `https://playmind3d.com/app/` com a sessão já iniciada (o mesmo app em que ele trabalha), abrir o console (F12) e colar o trecho abaixo. Ele lê o token do `localStorage` (chave `playmind3d:v2`, `cfg.token`), chama `exportarEstado` no Apps Script, e baixa um arquivo `corte.estado.json` com **só o campo `data`** da resposta (o estado, sem o envelope `{ok, v}`): é o formato que `carga`, `resumen` e `comparar` leem sem adaptação. Não imprime o token nem os dados; só uma de duas frases fixas.

```js
(async () => {
  const URL_APPS = "https://script.google.com/macros/s/AKfycbyiHVXBAnYzs_CBnIuURgBWuTQS0HFFrKExcPiyxviLDAZiLmsgZ0a-9wE8Y2c1yzDy/exec";
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem("playmind3d:v2")).cfg; } catch (e) { cfg = null; }
  const token = cfg && cfg.token;
  if (!token) { console.log("sin sesión: abrí https://playmind3d.com/app/, entrá con tu usuario y volvé a pegar esto"); return; }
  const url = ((cfg && cfg.api) || URL_APPS).trim();
  const r = await (await fetch(url, { method: "POST", body: JSON.stringify({ action: "exportarEstado", email: (cfg && cfg.email) || "", token }) })).json();
  if (!r || r.ok !== true || !r.data || typeof r.data !== "object") { console.log("falló: el servidor no entregó el estado"); return; }
  const blob = new Blob([JSON.stringify(r.data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "corte.estado.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log("listo: se descargó corte.estado.json");
})().catch(() => console.log("falló: red o respuesta que no es JSON"));
```

Esperado: a frase `listo: se descargó corte.estado.json` e um arquivo na pasta de downloads. Se aparecer `sin sesión`, o Pedro entra de novo no app e cola outra vez (isso não depende da chave: `exportarEstado` funciona com ela ligada). O Pedro entrega o arquivo ao controlador por um canal privado; o controlador o salva como `datos-privados/corte.estado.json` (o `.gitignore` já cobre `*.estado.json`) e confere:

```
node scripts/migracion-d1.js resumen datos-privados/corte.estado.json
```

Esperado: JSON com `listas` (as contagens de `produtos`, `vendas`, etc.), `chars` (tem que ser menor que 45.000) e `hash`. Anotar contagens e hash; o arquivo tem que ter o formato do estado (chaves de topo `cfg`, `produtos`, `vendas`…) e não `{ok, data}`. Se `resumen` mostrar tudo zero, o arquivo está com o envelope: não seguir.

**Passo 3. Carregar no D1 de produção e conferir** (controlador).

```
node scripts/migracion-d1.js carga datos-privados/corte.estado.json datos-privados/corte.carga.sql --v-inicial $(date +%s)
```

(`$(date +%s)` são os segundos atuais, 10 dígitos: muito acima de qualquer versão que o D1 já emitiu e diferente dos carimbos de 13 dígitos do Sheets. Anotar o número usado.) Esperado: sem saída, código 0, arquivo `corte.carga.sql` com um `INSERT` puro (sem `OR REPLACE`): se já existir a linha `estado`, a carga **falha** e não sobrescreve nada.

```
(cd api-worker && npx wrangler d1 execute playmind-prod --remote --env prod --file ../datos-privados/corte.carga.sql -y)
```

Esperado: `success`, 1 linha escrita. Se falhar por chave primária repetida, **não apagar nada**: ver a tabela. Ler de volta e extrair o campo `json` (o `wrangler` entrega `[{ "results": [{ "json": "…", "v": … }] }]`):

```
(cd api-worker && npx wrangler d1 execute playmind-prod --remote --env prod --command "SELECT json, v FROM estado WHERE clave='estado'" --json > ../datos-privados/salida-d1-raw.json)
node -e 'const fs=require("fs");const fila=JSON.parse(fs.readFileSync("datos-privados/salida-d1-raw.json","utf8"))[0].results[0];fs.writeFileSync("datos-privados/salida-d1.json",fila.json);console.log("v en D1:",fila.v)'
node scripts/migracion-d1.js comparar datos-privados/corte.estado.json datos-privados/salida-d1.json
```

Esperado: `v en D1:` igual ao `--v-inicial` usado, e `iguales: true` (contagens e hash). Se vier `iguales: false` (código 1) ou código 3, **parar**: o Worker está em `solo-lectura`, então nada novo foi gravado no D1 por esta via e a célula está congelada (ligada a chave). Ver a tabela (`iguales: false`) e o rollback abaixo.

**Passo 4. Ligar a escritura e o snapshot juntos** (controlador). Só depois do `iguales: true` do passo 3.
Editar `api-worker/wrangler.toml`, em `[env.prod.vars]`: `SNAPSHOT = "off"` passa a `SNAPSHOT = "on"` (o `MODO` do arquivo já é `"escritura"`). Fazer o deploy **sem** `--var`, para que o arquivo mande:

```
(cd api-worker && npx wrangler deploy --env prod)
curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud
```

Esperado: `{"ok":true,"modo":"escritura","snapshot":null}` (ainda não houve gravação depois do corte, por isso `snapshot` é `null`). Conferir as duas palavras exatas (avisos 1 e 4). Se for um deploy depois de um rollback, o estado anterior era `solo-lectura`: este deploy sem `--var` é o que o desfaz.

**Passo 5. Fumaça com o Pedro** (Pedro cola no console de `https://playmind3d.com/app/`; é o trecho da Etapa 1a apontando para o Worker de produção). Lê o token do `localStorage`, nunca o imprime, e imprime só contagens. O `save` regrava o mesmo estado: sobe `v` em 1 e **dispara o primeiro snapshot** (`SNAPSHOT=on`).

```js
(async () => {
  const URL_API = "https://playmind3d-api-prod.pdroarraes.workers.dev/";
  let token = null;
  try { token = JSON.parse(localStorage.getItem("playmind3d:v2")).cfg.token; } catch (e) { token = null; }
  if (!token) { console.log("sin sesión: abrí https://playmind3d.com/app/, entrá con tu usuario y volvé a pegar esto"); return; }
  const post = async (cuerpo) => (await fetch(URL_API, { method: "POST", body: JSON.stringify(cuerpo) })).json();
  const l = await post({ action: "load", token });
  const d = l.data || {};
  console.log({ ok: l.ok, error: l.error, v: l.v, produtos: (d.produtos || []).length, vendas: (d.vendas || []).length });
  if (!l.ok) return;
  const s = await post({ action: "save", token, v: l.v, data: l.data });
  console.log({ ok: s.ok, error: s.error, fusionado: s.fusionado, v: s.v });
})().catch(() => console.log({ ok: false, error: "fallo de red o respuesta que no es JSON" }));
```

Esperado: primeira linha `ok: true`, `v` igual ao `--v-inicial` (como texto) e as contagens do passo 2; segunda linha `ok: true`, `fusionado: false`, `v` = anterior + 1. (`error: undefined` é só o navegador mostrando um campo ausente.) Depois, o controlador:

```
curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud
```

Esperado (esperar uns 10 segundos para o snapshot assíncrono): `"modo":"escritura"` e `"snapshot":{"v":<v da segunda linha>,"ok":true,"motivo":null,"cuando":"…"}`. Se `snapshot.ok` for `false`, ler `motivo` na tabela "O que fazer se…".

Depois, o Pedro abre o app normalmente (sem console) em cada aparelho: o app recebe `migrado` do Apps Script, troca para o modo `worker` sozinho e mostra os dados. Conferir que o indicador de sincronização fica normal e que não aparece "El servidor todavía no tiene datos".

**Passo 6. Conferir catálogo e medidor** (controlador e Pedro).

```
curl -sSL "$APPS?action=catalogo" -o datos-privados/catalogo-despues.json
curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/catalogo -o datos-privados/catalogo-worker.json
node -e 'const fs=require("fs");const f=p=>JSON.parse(fs.readFileSync(p,"utf8")).catalogo;const a=f("datos-privados/catalogo-antes.json"),b=f("datos-privados/catalogo-despues.json"),c=f("datos-privados/catalogo-worker.json");const nom=x=>x.piezas.map(p=>p.nome||p.nombre);const dif=[];const m=new Map(b.piezas.map(p=>[p.nome||p.nombre,JSON.stringify(p)]));for(const p of a.piezas){const k=p.nome||p.nombre;if(m.get(k)!==JSON.stringify(p))dif.push(k)}console.log({antes:a.piezas.length,despues:b.piezas.length,worker:c.piezas.length,piezasDistintas:dif.length,nombresDistintos:dif})'
```

(Define `APPS` como no passo 0 se for outro terminal.) Esperado: `antes`, `despues` e `worker` com a **mesma contagem**; `piezasDistintas: 0` (na Etapa 1a estavam idênticas). Se alguma peça diferir, só pode ser por preço de peça com os casos de divergência antigos do `calcular_` (filamento apagado, etc.): investigar peça a peça antes de seguir. Depois, no menu "PlayMind 3d" > **"Ver cuánto espacio queda"**: tem que mostrar uma "Última medida" **nova** (agora) e `chars` perto do `chars` do `resumen` do passo 2 (o medidor passa a ser atualizado pelo snapshot, `medida:estado`). Se continuar com a medida antiga, o snapshot não gravou: ver `/salud`.

**Passo 7. Ida e volta** (controlador e Pedro; os aparelhos da família ficam **com o app fechado** durante todo este passo, só o do Pedro abre quando o roteiro mandar, e ninguém edita nada; é o ensaio do rollback, com o Pedro online e fora do horário de venda).

7.1. Colocar o Worker em só leitura:

```
(cd api-worker && npx wrangler deploy --env prod --var MODO:solo-lectura)
curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud
```

Esperado: `"modo":"solo-lectura"` (conferir **a palavra exata**, ver aviso 1). Um app aberto que peça `load` ou `save` recebe `revertido` do Worker (em `solo-lectura` o Worker **não serve nem o `load`**), passa ao modo `apps` e repete o pedido no Apps Script, que ainda responde `migrado` porque a chave está ligada: o protocolo repete uma vez só e termina em erro, então aparece erro e reintento a cada 20 s, sem perder dados locais e sem ler o D1.

7.2. Conferir que o último snapshot tem a `v` igual à do D1 (esperar uns 10 segundos desde a última gravação):

```
curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud
(cd api-worker && npx wrangler d1 execute playmind-prod --remote --env prod --command "SELECT v FROM estado WHERE clave='estado'" --json)
```

Esperado: `snapshot.v` do `/salud` **igual** ao `v` do D1 e `snapshot.ok: true`. Se forem diferentes, **não desligar a chave** (ver tabela).

7.3. Desligar a chave: Pedro, menu "PlayMind 3d" > **"D1: desactivar modo migrado"** > Sí. Esperado: "Modo migrado desactivado." Abrir o app: o `load` vai ao Worker (se o aparelho ainda estava em modo `worker`), recebe `revertido`, o app passa ao modo `apps` e lê do Apps Script (dados iguais, sincronização normal). **Em nenhum caso o app lê o D1 em `solo-lectura`.**

7.4. **Antes de ligar de novo, provar que a célula não mudou** (se alguém salvou enquanto a chave estava desligada, a célula tem gravações que o D1 não tem, e ligar a chave as perderia; e uma gravação na célula entre este passo e o 7.5 também se perderia, por isso os aparelhos continuam **fechados**, menos o do Pedro, que só baixa o arquivo). O Pedro cola outra vez o trecho de download do passo 2 (muda o nome do arquivo para `idavuelta.estado.json` trocando `a.download`), entrega, o controlador salva em `datos-privados/idavuelta.estado.json`, **relê sempre o D1** (está congelado em `solo-lectura`; nunca reusar o `salida-d1.json` do passo 3, que é anterior à fumaça) e compara:

```
(cd api-worker && npx wrangler d1 execute playmind-prod --remote --env prod --command "SELECT json, v FROM estado WHERE clave='estado'" --json > ../datos-privados/salida-d1-raw.json)
node -e 'const fs=require("fs");const fila=JSON.parse(fs.readFileSync("datos-privados/salida-d1-raw.json","utf8"))[0].results[0];fs.writeFileSync("datos-privados/salida-d1-idavuelta.json",fila.json);console.log("v en D1:",fila.v)'
node scripts/migracion-d1.js comparar datos-privados/idavuelta.estado.json datos-privados/salida-d1-idavuelta.json
```

Esperado: `iguales: true` (a célula é o snapshot, o mesmo estado do D1). Se vier `iguales: false`, **não ligar a chave**: ver "O que fazer se… a célula e o D1 divergem".

7.5. Ligar de novo: Pedro, menu "D1: activar modo migrado" > Sí.

7.6. Voltar o Worker para escritura (deploy **sem** `--var`: o `wrangler.toml` tem `MODO = "escritura"` e `SNAPSHOT = "on"`):

```
(cd api-worker && npx wrangler deploy --env prod)
curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud
```

Esperado: `"modo":"escritura"`. O Pedro abre o app: recebe `migrado` do Apps Script, vai ao Worker, e os dados aparecem. Pedro faz uma venda de teste pequena **ou** uma edição inofensiva (e a desfaz), confere que salvou, e o controlador confere em `/salud` que o `snapshot.v` avançou. (Se for uma venda de teste, o Pedro a apaga depois pelo app: apagar numa cópia atualizada funciona.)

Fim do corte: o `wrangler.toml` tem `MODO = "escritura"` e `SNAPSHOT = "on"`, igual ao que está no ar. Commit da mudança de `SNAPSHOT` (mensagem em português, um commit só).

## Rollback a qualquer momento (alvo: até 2 minutos)

Ordem fixa. Não inverter: desligar a chave antes do `solo-lectura` deixaria os apps novos gravando no D1 enquanto os antigos gravam na célula (duas verdades).

1. `(cd api-worker && npx wrangler deploy --env prod --var MODO:solo-lectura)`. Conferir em `curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud` que mostra `"modo":"solo-lectura"` (palavra exata: aviso 1).
2. Esperar uns 10 segundos e conferir que `snapshot.v` do `/salud` é igual ao `v` do D1 (`(cd api-worker && npx wrangler d1 execute playmind-prod --remote --env prod --command "SELECT v FROM estado WHERE clave='estado'" --json)`) e `snapshot.ok: true`.
3. Menu "PlayMind 3d" > "D1: desactivar modo migrado" > Sí. Conferir que o app abre e funciona no Apps Script (o `load` ao Worker dá `revertido` e o app cai no Apps Script; o Worker em `solo-lectura` não serve estado a ninguém).

**Rollback antes do passo 4** (a carga ainda não existe, ou o Worker nunca saiu de `solo-lectura`): o `/salud` mostra `snapshot: null` e o D1 não tem linha `estado` (ou só a da carga, sem gravação nenhuma). Nesse caso os passos 1 e 2 não mudam nada: o Worker já está em `solo-lectura` e não há gravação a conferir. A regra "se as versões forem diferentes, não desligar a chave" **não se aplica**; ir direto ao passo 3 (desligar a chave).

**Estado resultante de `MODO`:** depois do rollback o Worker de produção **continua em `solo-lectura`** (foi publicado com `--var`; o `wrangler.toml` segue dizendo `escritura`). É o estado seguro: o app aberto cai no Apps Script. **Não fazer deploy de produção sem `--var MODO:solo-lectura` enquanto a chave estiver desligada**; só o passo 4 (ou o 7.6) volta a escritura, depois de religar a chave.

Durante os passos 1 a 3 os apps podem mostrar erro e reintentar a cada 20 segundos: nenhum dado local se perde (`_sucio` fica até um save dar certo).

**O limite honesto:** a promessa vale só com o estado abaixo de ~45.000 caracteres (aviso 2). **O que pode se perder:** as gravações que o D1 recebeu depois do último snapshot gravado e antes do `solo-lectura` (o snapshot sai depois de cada gravação, então são segundos de trabalho, e só se o snapshot falhou ou estourou). Se no passo 2 as versões forem diferentes (e o Worker já tinha recebido gravações, ou seja, o rollback é depois do passo 4), o D1 é a verdade mais nova: não desligar a chave; esperar e repetir; se persistir, exportar o D1 (`(cd api-worker && npx wrangler d1 export playmind-prod --remote --env prod --output ../datos-privados/rollback.sql)`) antes de qualquer decisão, e o Time Travel (`(cd api-worker && npx wrangler d1 time-travel info playmind-prod --env prod)`) guarda 7 ou 30 dias.

Depois de um rollback **não recarregar o D1 com `--v-inicial` menor do que o `v` mais alto já emitido**: use sempre os segundos atuais e, se o `v` atual do D1 for maior, `v + 1` no mínimo. O `--v-inicial` também tem que ser **maior que o `d1:snapshotV`** guardado no Apps Script (a última versão de snapshot gravada, visível em Propriedades do script): com um valor menor ou igual, todos os snapshots são descartados como `vieja` sem aviso. A carga só entra se a linha `estado` não existir (`INSERT` puro): para recarregar é preciso um `DELETE FROM estado` explícito, decisão do Pedro, e só com a chave desligada.

## Critérios de sucesso (do spec, "Etapa 1b")

1. Contagens e hash iguais entre a célula e o D1 depois da carga (passo 3: `iguales: true`).
2. Nenhuma venda perdida num ciclo ida e volta (passo 7: `comparar` dá `iguales: true` antes de religar, e as contagens de `vendas` são as do passo 2 depois).
3. Nenhum aparelho preso em erro depois de 5 minutos (o Pedro abre o app nos 3 aparelhos e confere que sincroniza; o celular antigo só atualiza abrindo o app com rede: o service worker é rede primeiro).
4. Catálogo público igual antes e depois (passo 6).

## O que fazer se…

| Situação | O que significa | O que fazer |
|---|---|---|
| Um app **antigo** (sem o protocolo) mostra "El servidor todavía no tiene datos" ou "Error al guardar" depois de ligar a chave | Recebeu `migrado` e não sabe o que fazer com isso. Nada se perde: o `_sucio` do aparelho continua até um app atualizado subir | Abrir o app com rede para o service worker atualizar (`CACHE` `playmind3d-v28`); se não atualizar, fechar e abrir de novo. Nunca "limpar dados do site" antes de sincronizar |
| Entre o passo 1 e o passo 4 um app novo mostra erro ao salvar (ou "sin datos" ao carregar) | Esperado: o Apps Script diz `migrado`, o Worker em `solo-lectura` diz `revertido` a **todas** as ações de estado (`load` incluído; ele não serve o D1) e o protocolo termina em erro sem lazo, alternando entre os dois servidores a cada reintento. Nada é gravado, o `save` não é liberado (o `load` nunca completa) e o `_sucio` do aparelho fica guardado | Fechar o app e só abrir depois do passo 4; não editar nada. Se o app ficar preso em erro 5 minutos depois do passo 4, ver o critério 3 |
| O app mostra o erro de acesso ("o servidor de acesso não responde") | O Worker devolveu `auth_no_disponible`: o Apps Script (que valida a sessão) não respondeu | Não deslogar. O app reintenta a cada 20 s. Conferir que o Apps Script está no ar (abrir a URL `/exec?action=catalogo`). Quando voltar, tudo segue. O Worker **depende do Apps Script** para validar sessão: se ele ficar fora do ar por muito tempo, ninguém salva, e rollback também não é possível (a chave mora no Apps Script). Esperar |
| Apps Script fora do ar durante o corte (passos 1 a 3) | `exportarEstado` não responde | Parar. Se a chave já estiver ligada, nada foi carregado: quando o Apps Script voltar, repetir o passo 2. Se demorar, desligar a chave quando voltar (a célula nunca foi tocada) |
| Medidor perto de 45.000 (ou `/salud` mostra `snapshot.motivo` = `excede`) | O estado não cabe mais na célula: o snapshot não grava e o rollback deixa de ser possível sem perda | Avisar o Pedro: o rollback prometido acabou. Decidir **antes** de seguir se desliga o `SNAPSHOT` (`SNAPSHOT = "off"`, deploy) e aceita a perda da rede de segurança, ou se se antecipa a Etapa 2 (vendas como tabela). O gatilho de revisão do banco continua sendo 70% = 35.000 |
| `snapshot.ok: false` com outro `motivo` (`red`, `error: …`, `respuesta inesperada`, `vieja`) | O Apps Script não aceitou o snapshot (fora do ar, versão antiga do script sem `guardarSnapshot`, ou chega uma versão menor) | `error: no migrado`: a chave está desligada. `error: accion desconocida`: falta publicar o Apps Script (Versão: NUEVA). `red`: Apps Script fora do ar ou lento (timeout de 15 s). `vieja`: já havia snapshot de versão igual ou maior. É inofensivo só no caso normal (um snapshot atrasado); mas depois de uma recarga do D1 com `--v-inicial` menor que o `d1:snapshotV` do Apps Script, **todos** os snapshots ficam `vieja` em silêncio e a célula deixa de ser atualizada: ver a regra de `--v-inicial` no fim da seção "Rollback". Corrigir e fazer qualquer gravação no app para gerar novo snapshot; conferir `/salud` |
| Passo 3: `comparar` dá `iguales: false` ou código 3 | A carga não reflete o arquivo exportado | Não seguir. O Worker está em `solo-lectura` desde a checklist, então o D1 não deve ter recebido gravações por esta via, mas **conferir**, não presumir: `SELECT v, actualizado FROM estado` e a leitura do passo 3. Se a linha reflete a exportação (carga parcial ou hash que não bate), exportar a linha para um arquivo, comparar com `corte.estado.json` e decidir com o Pedro; só então, com ele de acordo, a chave desligada e a célula ainda íntegra, repetir os passos 1 a 3 com `--v-inicial` novo. Rollback conforme a seção acima |
| Passo 3: a carga falha por chave primária repetida | Já existe uma linha `estado` no D1 de produção | **Não apagar.** Pode ser a única cópia de uma edição pendente de um aparelho (a célula está congelada). Exportar a linha (`SELECT json, v, actualizado FROM estado`, como no passo 3), `comparar` com `corte.estado.json` e decidir com o Pedro entre fundir (o que só existe na linha e não na célula entra na exportação nova) e descartar; qualquer `DELETE FROM estado` só depois dessa decisão e com a cópia guardada |
| A célula e o D1 divergem na ida e volta (passo 7.4: `iguales: false`) | Alguém gravou no Apps Script com a chave desligada | **Não ligar a chave.** A célula é agora a verdade mais nova: com a chave desligada, exportar e conferir a linha do D1 (ela está congelada em `solo-lectura`), decidir com o Pedro, e só então `DELETE FROM estado` e refazer **os passos 1, 2, 3 e seguintes** (o passo 1 religa a chave e congela a célula **antes** da exportação nova; sem isso, uma gravação feita depois do export seria sobrescrita pelo primeiro snapshot) com `--v-inicial` novo (segundos atuais) |
| `/salud` mostra `modo` diferente do que se queria | Erro de digitação em `MODO` (aviso 1) ou deploy que não subiu | Antes do passo 4 (ou depois de um rollback) o certo é `solo-lectura`: fazer de novo `(cd api-worker && npx wrangler deploy --env prod --var MODO:solo-lectura)`, **sem** mexer no `wrangler.toml`. Só a partir do passo 4 o arquivo manda (deploy sem `--var`). Só seguir quando `/salud` mostrar a palavra certa |
| O cadastro por chat (`cadastro-worker`) falha depois do corte | Pode estar com o código antigo (sem o protocolo) ou o Worker de estado em `solo-lectura`/fora do ar | Conferir `/salud`; se o `cadastro-worker` publicado for anterior a esta etapa, fazer deploy dele depois do dry-run (ver "Depois") |

## Depois do corte

Observar **no mínimo 2 semanas**, com o Pedro disponível para qualquer coisa estranha.

1. **Logo depois (mesmo dia):** `cadastro-worker/wrangler.toml`: `MODO_SERVIDOR = "worker"` (para cada pedido não pagar uma ida extra ao Apps Script, que só serve para receber `migrado`). Antes: `(cd cadastro-worker && npx wrangler deploy --dry-run --outdir <pasta-temporária>)` (o bundle não tinha sido verificado antes da Task 7; o dry-run de 19/11/2026 passou). Depois: `(cd cadastro-worker && npx wrangler deploy)`. Se houver rollback, voltar `MODO_SERVIDOR` para `"apps"` por higiene (com `"worker"` e o Worker em `solo-lectura`, o protocolo já troca para o Apps Script e repete o pedido na mesma chamada, ao custo de uma ida extra).
2. **Todo dia (o Pedro ou o controlador, 1 minuto):** `curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud` com `modo: "escritura"` e `snapshot.ok: true` e `snapshot.cuando` recente (de quando alguém salvou); o menu "Ver cuánto espacio queda" com `chars` abaixo de 35.000 (70%) e sempre abaixo de 45.000; a contagem de vendas do app batendo com o que o Pedro lembra de ter vendido.
3. **Quando desligar o `SNAPSHOT`:** só depois de 2 semanas sem incidente, com o Pedro de acordo. `SNAPSHOT = "off"` em `[env.prod.vars]` e `(cd api-worker && npx wrangler deploy --env prod)`. **Isso encerra a rede de segurança do rollback** (a célula deixa de ser atualizada e fica velha): é a hora de decidir, junto, se volta ou não. Antes, confirmar `d1 time-travel info` e um `d1 export` recente guardado fora do repositório.
4. **Etapa 2** (vendas como tabela) começa **em até 4 semanas depois do corte**, para o estado não encostar nos 45.000 enquanto o rollback ainda é prometido.
5. Atualizar `docs/migracion-d1.md` e o `CLAUDE.md` (Apps Script deixa de ser o dono do estado; `d1:migrado` ligada) quando o Pedro der o corte por concluído.
