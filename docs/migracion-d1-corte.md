# Roteiro do dia do corte (Apps Script/Sheets -> Worker/D1)

Documento de operação da Etapa 1b. Quem executa: o controlador (Claude ou quem estiver no terminal do repositório) com o Pedro online. O corte é "ligar a chave" `d1:migrado`; o rollback é "desligar a chave". Nenhum lançamento de app no dia: o app novo já está nos celulares.

Nomes reais usados abaixo (conferidos no código):
- Menu da planilha **"PlayMind 3d"**: "Ver cuánto espacio queda", "D1: activar modo migrado", "D1: desactivar modo migrado", "D1: dirección del catálogo en el Worker".
- Script Properties do Apps Script: `d1:migrado` (vale `1` com a chave ligada), `d1:catalogoUrl`, `d1:snapshotV`, `medida:estado`.
- Actions do Apps Script: `exportarEstado` (só lê, serve com a chave ligada ou desligada, exige sessão), `guardarSnapshot` (só grava com a chave ligada), `subirFotos`.
- Worker de produção: `playmind3d-api-prod` (`wrangler deploy --env prod`, dentro de `api-worker/`), https://playmind3d-api-prod.pdroarraes.workers.dev, banco `playmind-prod` (`database_id` `8a0a4cf3-9642-4311-a0ca-763ffbe2f96a`). Variáveis em `[env.prod.vars]` de `api-worker/wrangler.toml`: `MODO` (`escritura` | `solo-lectura`) e `SNAPSHOT` (`on` | `off`).
- `GET /salud` devolve `{"ok":true,"modo":"escritura"|"solo-lectura","snapshot":null|{"v":…,"ok":true|false,"motivo":…,"cuando":"…"}}`.
- `scripts/migracion-d1.js`: `carga <estado.json> <saida.sql> [--v-inicial N]`, `resumen <estado.json>`, `comparar <a.json> <b.json>`. Códigos de saída: 0 ok, 1 `comparar` com diferenças, 2 uso incorreto, 3 arquivo ilegível ou JSON inválido.

Convenções: os comandos `node` rodam na raiz do repositório; os `npx wrangler` rodam em `api-worker/` (por isso os arquivos ficam em `../datos-privados/`). Todos os arquivos com dados reais ficam em `datos-privados/` (ignorada pelo git, junto com `*.estado.json`, `*.carga.sql` e `salida-d1*.json`). Nada disso vai para o git, para o chat ou para a nuvem.

## Avisos que valem para o dia inteiro

1. **`MODO` com qualquer valor diferente de exatamente `solo-lectura` é tratado como escritura** (`rutas.js` só bloqueia quando `env.MODO === "solo-lectura"`; `/salud` também). Um erro de digitação (`solo-lectura ` com espaço, `solo_lectura`, maiúscula) vira escrita **sem aviso**. Depois de cada deploy que mexe em `MODO`, conferir em `/salud` que `modo` mostra o que se queria.
2. **Rollback só é prometido com o estado abaixo de ~45.000 caracteres** (célula do Sheets = 50.000). O estado hoje tem ~34.500. Acima disso o snapshot responde `excede`, a célula não é atualizada e voltar para o Apps Script perderia tudo o que o D1 recebeu desde o último snapshot gravado.
3. **O `MODO_SERVIDOR` do `cadastro-worker` deve ir para `"worker"` num redeploy depois do corte** (hoje é `"apps"`: cada pedido paga uma ida extra ao Apps Script para receber `migrado` e só então chama o Worker). Ver "Depois do corte". Antes de qualquer deploy do `cadastro-worker`, fazer o dry-run descrito na checklist (item 11).
4. Edições de `wrangler.toml` no dia (`MODO`, `SNAPSHOT`) são o jeito de trocar as variáveis: o deploy lê o arquivo. No fim do dia o arquivo tem que refletir o que está no ar, e então vai para um commit.

## Antes (dias antes do corte)

Checklist. Cada item tem que estar marcado antes de combinar o dia. Quem faz: o controlador, salvo onde disser Pedro.

| # | Item | Como conferir | Quem |
|---|---|---|---|
| 1 | App novo (com o protocolo de dois servidores, `CACHE` `playmind3d-v27` em `app/sw.js`) publicado há **3 dias ou mais** na `main` (GitHub Pages) | `git log origin/main -1 --format=%cd -- app/` e pedir ao Pedro que confirme que os 3 aparelhos já abriram o app depois disso | controlador + Pedro |
| 2 | Apps Script com `exportarEstado` e `guardarSnapshot` publicados | No editor do Apps Script: colar `server/Codigo.gs`, salvar, **Implementar > Administrar implementaciones > lápis > Versão: NUEVA**. Salvar não basta | Pedro |
| 3 | Banco de produção com as duas migrations | `cd api-worker && npx wrangler d1 migrations list playmind-prod --remote --env prod` deve dizer que não há migrations pendentes. Se houver: `npx wrangler d1 migrations apply playmind-prod --remote --env prod` | controlador |
| 4 | Banco de produção **vazio** | `npx wrangler d1 execute playmind-prod --remote --env prod --command "SELECT COUNT(*) AS n FROM estado"` deve dar `n = 0` | controlador |
| 5 | Worker de produção no ar com `MODO=escritura` e `SNAPSHOT=off` | `cd api-worker && npx wrangler deploy --env prod` (o `wrangler.toml` já traz `MODO = "escritura"` e `SNAPSHOT = "off"` em `[env.prod.vars]`). Depois: `curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud` deve dar `{"ok":true,"modo":"escritura","snapshot":null}` | controlador |
| 6 | `d1:catalogoUrl` definido | Menu "PlayMind 3d" > **"D1: dirección del catálogo en el Worker"** > colar `https://playmind3d-api-prod.pdroarraes.workers.dev/catalogo` (tem que começar com `https://`). Confirmar que o alerta diz "Dirección guardada." O menu "D1: activar modo migrado" avisa com "OJO" se isto faltar | Pedro |
| 7 | Catálogo do Worker responde | `curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/catalogo` deve dar `ok:true` e uma lista `piezas` **vazia** (o D1 de produção ainda está vazio): é esperado agora, e só passa a ter peças depois do passo 3 do corte | controlador |
| 8 | Fuso do projeto do Apps Script = **America/Argentina/Buenos_Aires** (o `resumenNegocio` do Worker assume UTC-3; o repositório não tem `appsscript.json`) | No editor do Apps Script: Configuración del proyecto (engrenagem) > Zona horaria | Pedro |
| 9 | Medidor de espaço **abaixo de 45.000** | Menu "PlayMind 3d" > **"Ver cuánto espacio queda"**. Anotar o valor. Se disser que ainda não há medida, esperar o próximo save do app | Pedro |
| 10 | Pedro online, no computador, e **fora do horário de venda**; os outros dois da família avisados de que o app pode piscar um erro por alguns minutos | combinado no chat | Pedro |
| 11 | Dry-run dos dois Workers (nada sobe) | `cd cadastro-worker && npx wrangler deploy --dry-run --outdir <pasta-temporária>` e `cd api-worker && npx wrangler deploy --env prod --dry-run --outdir <pasta-temporária>`. O bundle do `cadastro-worker` **não tinha sido verificado antes desta tarefa**; em 19/11/2026 o dry-run dele deu 19,35 KiB (gzip 6,59 KiB) e o do `api-worker` prod 28,03 KiB (gzip 8,68 KiB), sem erro. Repetir no dia anterior | controlador |
| 12 | Backup e Time Travel do banco de produção | `npx wrangler d1 time-travel info playmind-prod --env prod` imprime o bookmark atual (a janela é de 7 dias no plano gratuito, 30 no pago: ver `docs/migracion-d1-limites.md`). Opcional: `npx wrangler d1 export playmind-prod --remote --env prod --output ../datos-privados/prod-antes.sql` | controlador |
| 13 | Foto do catálogo de hoje | Ver passo 0 do corte | controlador |
| 14 | Testes verdes | `node --test tests/*.test.js api-worker/test/*.test.js cadastro-worker/test/*.test.js` (Node 22.13 ou mais novo) e `node scripts/ensayo-protocolo.js` | controlador |

## O corte

Só começar com a checklist inteira marcada. Meta de duração: 30 a 40 minutos. Ninguém edita nada no app, em nenhum aparelho, entre o passo 1 e o passo 5.

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
cd api-worker
npx wrangler d1 execute playmind-prod --remote --env prod --file ../datos-privados/corte.carga.sql -y
```

Esperado: `success`, 1 linha escrita. Ler de volta e extrair o campo `json` (o `wrangler` entrega `[{ "results": [{ "json": "…", "v": … }] }]`):

```
npx wrangler d1 execute playmind-prod --remote --env prod --command "SELECT json, v FROM estado WHERE clave='estado'" --json > ../datos-privados/salida-d1-raw.json
cd ..
node -e 'const fs=require("fs");const fila=JSON.parse(fs.readFileSync("datos-privados/salida-d1-raw.json","utf8"))[0].results[0];fs.writeFileSync("datos-privados/salida-d1.json",fila.json);console.log("v en D1:",fila.v)'
node scripts/migracion-d1.js comparar datos-privados/corte.estado.json datos-privados/salida-d1.json
```

Esperado: `v en D1:` igual ao `--v-inicial` usado, e `iguales: true` (contagens e hash). Se vier `iguales: false` (código 1) ou código 3, **parar e fazer o rollback** (ver abaixo; ainda não há nada novo no D1 que precise de snapshot porque ninguém gravou lá).

**Passo 4. Deploy do Worker de produção com `SNAPSHOT=on`** (controlador).
Editar `api-worker/wrangler.toml`, em `[env.prod.vars]`, trocar `SNAPSHOT = "off"` por `SNAPSHOT = "on"` (o `MODO` continua `"escritura"`), e:

```
cd api-worker
npx wrangler deploy --env prod
curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud
```

Esperado: `{"ok":true,"modo":"escritura","snapshot":null}` (ainda não houve gravação depois do corte, por isso `snapshot` é `null`).

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

**Passo 7. Ida e volta** (controlador e Pedro; ninguém edita nada no app durante este passo; é o ensaio do rollback, com o Pedro online e fora do horário de venda).

7.1. Colocar o Worker em só leitura. Em `api-worker/wrangler.toml`, `[env.prod.vars]`: `MODO = "solo-lectura"`, e

```
cd api-worker
npx wrangler deploy --env prod
curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud
```

Esperado: `"modo":"solo-lectura"` (conferir **a palavra exata**, ver aviso 1). Um app que esteja aberto e tente salvar recebe `revertido`, passa ao modo `apps` e repete o pedido no Apps Script, que ainda responde `migrado` porque a chave está ligada: por uns instantes pode aparecer erro e reintento, sem perder dados locais.

7.2. Conferir que o último snapshot tem a `v` igual à do D1 (esperar uns 10 segundos desde a última gravação):

```
curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud
cd api-worker
npx wrangler d1 execute playmind-prod --remote --env prod --command "SELECT v FROM estado WHERE clave='estado'" --json
```

Esperado: `snapshot.v` do `/salud` **igual** ao `v` do D1 e `snapshot.ok: true`. Se forem diferentes, **não desligar a chave** (ver tabela).

7.3. Desligar a chave: Pedro, menu "PlayMind 3d" > **"D1: desactivar modo migrado"** > Sí. Esperado: "Modo migrado desactivado." Abrir o app: ele tem que funcionar no Apps Script (dados iguais, sincronização normal).

7.4. **Antes de ligar de novo, provar que a célula não mudou** (se alguém salvou enquanto a chave estava desligada, a célula tem gravações que o D1 não tem, e ligar a chave as perderia). O Pedro cola outra vez o trecho de download do passo 2 (muda o nome do arquivo para `idavuelta.estado.json` trocando `a.download`), entrega, o controlador salva em `datos-privados/idavuelta.estado.json` e roda:

```
node scripts/migracion-d1.js comparar datos-privados/idavuelta.estado.json datos-privados/salida-d1.json
```

Esperado: `iguales: true` (a célula é o snapshot, que é o estado do D1 do passo 3 mais o `save` do passo 5, o mesmo estado). Atenção: o `salida-d1.json` do passo 3 só serve se nada mais foi gravado no D1 depois da fumaça; se o Pedro mexeu no app depois do passo 5, reler o D1 antes (repetir a leitura do passo 3, trocando o nome do arquivo de saída). Se vier `iguales: false`, **não ligar a chave**: ver "O que fazer se… a célula e o D1 divergem".

7.5. Ligar de novo: Pedro, menu "D1: activar modo migrado" > Sí.

7.6. Voltar o Worker para escritura. Em `wrangler.toml`: `MODO = "escritura"` e

```
cd api-worker
npx wrangler deploy --env prod
curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud
```

Esperado: `"modo":"escritura"`. O Pedro abre o app: recebe `migrado` do Apps Script, vai ao Worker, e os dados aparecem. Pedro faz uma venda de teste pequena **ou** uma edição inofensiva (e a desfaz), confere que salvou, e o controlador confere em `/salud` que o `snapshot.v` avançou. (Se for uma venda de teste, o Pedro a apaga depois pelo app: apagar numa cópia atualizada funciona.)

Fim do corte: o `wrangler.toml` tem que estar com `MODO = "escritura"` e `SNAPSHOT = "on"`, igual ao que está no ar. Commit dessa mudança de `SNAPSHOT` (mensagem em português, um commit só).

## Rollback a qualquer momento (alvo: até 2 minutos)

Ordem fixa. Não inverter: desligar a chave antes do `solo-lectura` deixaria os apps novos gravando no D1 enquanto os antigos gravam na célula (duas verdades).

1. `api-worker/wrangler.toml`: `MODO = "solo-lectura"` em `[env.prod.vars]`; `cd api-worker && npx wrangler deploy --env prod`. Conferir em `curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud` que mostra `"modo":"solo-lectura"` (palavra exata: aviso 1).
2. Esperar uns 10 segundos e conferir que `snapshot.v` do `/salud` é igual ao `v` do D1 (`npx wrangler d1 execute playmind-prod --remote --env prod --command "SELECT v FROM estado WHERE clave='estado'" --json`) e `snapshot.ok: true`.
3. Menu "PlayMind 3d" > "D1: desactivar modo migrado" > Sí. Conferir que o app abre e funciona no Apps Script.

Durante os passos 1 a 3 os apps podem mostrar erro e reintentar a cada 20 segundos: nenhum dado local se perde (`_sucio` fica até um save dar certo).

**O limite honesto:** a promessa vale só com o estado abaixo de ~45.000 caracteres (aviso 2). **O que pode se perder:** as gravações que o D1 recebeu depois do último snapshot gravado e antes do `solo-lectura` (o snapshot sai depois de cada gravação, então são segundos de trabalho, e só se o snapshot falhou ou estourou). Se no passo 2 as versões forem diferentes, o D1 é a verdade mais nova: não desligar a chave; esperar e repetir; se persistir, exportar o D1 (`npx wrangler d1 export playmind-prod --remote --env prod --output ../datos-privados/rollback.sql`) antes de qualquer decisão, e o Time Travel (`npx wrangler d1 time-travel info playmind-prod --env prod`) guarda 7 ou 30 dias.

Depois de um rollback **não recarregar o D1 com `--v-inicial` menor do que o `v` mais alto já emitido**: use sempre os segundos atuais e, se o `v` atual do D1 for maior, `v + 1` no mínimo. A carga só entra se a linha `estado` não existir (`INSERT` puro): para recarregar é preciso um `DELETE FROM estado` explícito, decisão do Pedro, e só com a chave desligada.

## Critérios de sucesso (do spec, "Etapa 1b")

1. Contagens e hash iguais entre a célula e o D1 depois da carga (passo 3: `iguales: true`).
2. Nenhuma venda perdida num ciclo ida e volta (passo 7: `comparar` dá `iguales: true` antes de religar, e as contagens de `vendas` são as do passo 2 depois).
3. Nenhum aparelho preso em erro depois de 5 minutos (o Pedro abre o app nos 3 aparelhos e confere que sincroniza; o celular antigo só atualiza abrindo o app com rede: o service worker é rede primeiro).
4. Catálogo público igual antes e depois (passo 6).

## O que fazer se…

| Situação | O que significa | O que fazer |
|---|---|---|
| Um app **antigo** (sem o protocolo) mostra "El servidor todavía no tiene datos" ou "Error al guardar" depois de ligar a chave | Recebeu `migrado` e não sabe o que fazer com isso. Nada se perde: o `_sucio` do aparelho continua até um app atualizado subir | Abrir o app com rede para o service worker atualizar (`CACHE` `playmind3d-v27`); se não atualizar, fechar e abrir de novo. Nunca "limpar dados do site" antes de sincronizar |
| O app mostra o erro de acesso ("o servidor de acesso não responde") | O Worker devolveu `auth_no_disponible`: o Apps Script (que valida a sessão) não respondeu | Não deslogar. O app reintenta a cada 20 s. Conferir que o Apps Script está no ar (abrir a URL `/exec?action=catalogo`). Quando voltar, tudo segue. O Worker **depende do Apps Script** para validar sessão: se ele ficar fora do ar por muito tempo, ninguém salva, e rollback também não é possível (a chave mora no Apps Script). Esperar |
| Apps Script fora do ar durante o corte (passos 1 a 3) | `exportarEstado` não responde | Parar. Se a chave já estiver ligada, nada foi carregado: quando o Apps Script voltar, repetir o passo 2. Se demorar, desligar a chave quando voltar (a célula nunca foi tocada) |
| Medidor perto de 45.000 (ou `/salud` mostra `snapshot.motivo` = `excede`) | O estado não cabe mais na célula: o snapshot não grava e o rollback deixa de ser possível sem perda | Avisar o Pedro: o rollback prometido acabou. Decidir **antes** de seguir se desliga o `SNAPSHOT` (`SNAPSHOT = "off"`, deploy) e aceita a perda da rede de segurança, ou se se antecipa a Etapa 2 (vendas como tabela). O gatilho de revisão do banco continua sendo 70% = 35.000 |
| `snapshot.ok: false` com outro `motivo` (`red`, `error: …`, `respuesta inesperada`, `vieja`) | O Apps Script não aceitou o snapshot (fora do ar, versão antiga do script sem `guardarSnapshot`, ou chega uma versão menor) | `error: no migrado`: a chave está desligada. `error: accion desconocida`: falta publicar o Apps Script (Versão: NUEVA). `red`: Apps Script fora do ar ou lento (timeout de 15 s). `vieja`: já havia snapshot de versão igual ou maior (inofensivo). Corrigir e fazer qualquer gravação no app para gerar novo snapshot; conferir `/salud` |
| Passo 3: `comparar` dá `iguales: false` ou código 3 | A carga não reflete o arquivo exportado | Não seguir. Rollback (a chave está ligada e o D1 não recebeu gravações). Para tentar de novo: com a chave desligada, `DELETE FROM estado` no D1 de produção e repetir os passos 1 a 3 com `--v-inicial` novo |
| Passo 3: a carga falha por chave primária repetida | Já existe uma linha `estado` no D1 de produção | Não sobrescrever. Descobrir quem gravou (`SELECT v, actualizado FROM estado`). Se foi um teste, o Pedro decide o `DELETE FROM estado`; se for estado real, parar |
| A célula e o D1 divergem na ida e volta (passo 7.4: `iguales: false`) | Alguém gravou no Apps Script com a chave desligada | **Não ligar a chave.** A célula é agora a verdade mais nova: com a chave desligada, `DELETE FROM estado` no D1 e refazer os passos 2, 3 e seguintes com a exportação nova e `--v-inicial` novo (segundos atuais) |
| `/salud` mostra `modo` diferente do que se queria | Erro de digitação em `MODO` (aviso 1) ou deploy que não subiu | Corrigir `wrangler.toml` e fazer deploy de novo; só seguir quando `/salud` mostrar a palavra certa |
| O cadastro por chat (`cadastro-worker`) falha depois do corte | Pode estar com o código antigo (sem o protocolo) ou o Worker de estado em `solo-lectura`/fora do ar | Conferir `/salud`; se o `cadastro-worker` publicado for anterior a esta etapa, fazer deploy dele depois do dry-run (ver "Depois") |

## Depois do corte

Observar **no mínimo 2 semanas**, com o Pedro disponível para qualquer coisa estranha.

1. **Logo depois (mesmo dia):** `cadastro-worker/wrangler.toml`: `MODO_SERVIDOR = "worker"` (para cada pedido não pagar uma ida extra ao Apps Script, que só serve para receber `migrado`). Antes: `cd cadastro-worker && npx wrangler deploy --dry-run --outdir <pasta-temporária>` (o bundle não tinha sido verificado antes da Task 7; o dry-run de 19/11/2026 passou). Depois: `npx wrangler deploy`. Se houver rollback, voltar `MODO_SERVIDOR` para `"apps"` por higiene (com `"worker"` e o Worker em `solo-lectura`, o protocolo já troca para o Apps Script e repete o pedido na mesma chamada, ao custo de uma ida extra).
2. **Todo dia (o Pedro ou o controlador, 1 minuto):** `curl -sS https://playmind3d-api-prod.pdroarraes.workers.dev/salud` com `modo: "escritura"` e `snapshot.ok: true` e `snapshot.cuando` recente (de quando alguém salvou); o menu "Ver cuánto espacio queda" com `chars` abaixo de 35.000 (70%) e sempre abaixo de 45.000; a contagem de vendas do app batendo com o que o Pedro lembra de ter vendido.
3. **Quando desligar o `SNAPSHOT`:** só depois de 2 semanas sem incidente, com o Pedro de acordo. `SNAPSHOT = "off"` em `[env.prod.vars]` e `npx wrangler deploy --env prod`. **Isso encerra a rede de segurança do rollback** (a célula deixa de ser atualizada e fica velha): é a hora de decidir, junto, se volta ou não. Antes, confirmar `d1 time-travel info` e um `d1 export` recente guardado fora do repositório.
4. **Etapa 2** (vendas como tabela) começa **em até 4 semanas depois do corte**, para o estado não encostar nos 45.000 enquanto o rollback ainda é prometido.
5. Atualizar `docs/migracion-d1.md` e o `CLAUDE.md` (Apps Script deixa de ser o dono do estado; `d1:migrado` ligada) quando o Pedro der o corte por concluído.
