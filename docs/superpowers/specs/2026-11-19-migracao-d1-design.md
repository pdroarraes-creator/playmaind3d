# Migração do Sheets para o D1 (Cloudflare) — design

Data: 2026-11-19. Escrito para quem vai planejar e construir (Pedro + Claude).
Idioma do documento: português. Código e interface continuam em espanhol (es-AR).

## Intenção e porquê

Hoje o estado inteiro do app (`D`) vive como um JSON numa célula do Google Sheets, que
tem teto de 50.000 caracteres. Em 19/11/2026 estava em **34.426 (68,9%)**, a 574 do
gatilho de 70% que o documento `2026-11-18-arquitetura-publico-interno-design.md`
definiu para abrir a fase 3 (banco). Quando estourar, `guardarEstado_` falha e o app
para de salvar.

**O Pedro decidiu migrar para o D1 ("migrar sim ou sim", 19/11/2026).** Isso fecha a
pergunta "migrar ou não". O que **não** foi dito: se ele quer, além de tirar o teto,
vender online, entrar em marketplace ou crescer para 4–6 impressoras. A etapa B do
plano (tabelas por entidade) existe para atender isso; o desenho abaixo não assume
nenhum desses usos como certo.

Objetivo didático (herdado): o Pedro quer aprender a montar a própria empresa, então
cada peça nova precisa ser explicável em duas linhas em `docs/`.

## Objetivos

1. Tirar o teto de 50.000 caracteres: o estado passa a viver no D1.
2. Manter o app funcionando offline e sincronizando, como hoje (save com versão, fusão
   quando duas pessoas gravam em paralelo).
3. Cada etapa é reversível e deixa o sistema funcionando se a seguinte falhar.
4. Chegar a sincronização por item, começando por `vendas` (única lista que cresce para
   sempre), para que o banco sirva a pedidos online e marketplace no futuro.
5. Uma só fonte da verdade em cada momento (nunca Sheets e D1 divergindo).

## Não-objetivos

- Pagamento/checkout próprio (fica para a fase de pedidos online, se vier).
- Mover as fotos para o R2 (continuam no Drive; é outro projeto).
- Dividir `app.js` em módulos (fase 2 do documento de arquitetura, projeto separado).
- Redesenhar a interface ou o catálogo.
- Framework ou bundler **no app**. (O Worker já tem `package.json`; usar `wrangler`
  nele é aceitável, o app em `app/` segue sem build.)

## Anti-objetivos (fracasso mesmo "funcionando")

- Perder ou corromper uma venda ou um item de estoque na migração.
- O catálogo mostrar preço diferente do app (restrição 9 do `CLAUDE.md`).
- Mexer na produção durante o pico do Natal; ficar sem rollback.
- Complexidade que as 3 pessoas da família não conseguem manter.

## Restrições herdadas (valem aqui)

Nada de imagem em base64 dentro de `D`. Não quebrar o shape salvo (migração em
`cargar()`). Credenciais fora do código (Script Properties / `wrangler secret`). Deploy
do Apps Script exige "Versão: NUEVA". Arquivo novo em `app/` entra em `ARCHIVOS` do
`sw.js` e muda o `CACHE`. O domínio fica no GitHub Pages (Wix não deixa trocar
nameservers), então a API do D1 fica num `*.workers.dev` com CORS aberto para
`https://playmind3d.com` e `https://www.playmind3d.com`. `calc()`/`calcular_()` precisam
concordar. Comentários e textos novos em espanhol.

## O que existe hoje (verificado no código em 19/11/2026)

- `doPost` (Apps Script) expõe: `login`, `logout`, `load`, `save`, `mundo`,
  `editarPieza`, `agregarPieza`, `agregarFilamento`, `resumenNegocio`, `foto`,
  `validarSesion`. `doGet` só serve `action=catalogo`.
- `guardarEstado_` (lock de 20 s) relê a célula, compara a versão (carimbo de hora da
  coluna 3); se não bate, `fusionar_` junta as listas `LISTAS_CON_ID` por `id` (o cliente
  ganha nos itens que tem; o que só o servidor tem é preservado; baixas feitas a partir de
  cópia velha **não** se aplicam). Depois: `moverFotosADrive_` (base64 → Drive),
  zera `cfg.token`/`cfg.key`, mede o espaço, grava a célula, `invalidarCatalogo_()` e
  reescreve as abas espelho (`volcarVentas_`, `volcarPiezas_`, `volcarStock_`).
- Cliente: `subirALaNube` (`app.js`, seção `nube`) manda o estado inteiro com `v: D._v`;
  se `fusionado`, avisa e baixa de novo. Reintenta a cada 20 s se falhar; guarda cópia
  local (IndexedDB/localStorage).
- Login com hash+sal e sessões (`ses:<token>`, 90 dias) em Script Properties.
- `cadastro-worker/` (Cloudflare, Gemini) já chama o Apps Script e usa `validarSesion`
  para não reimplementar a verificação de sessão.
- `catalogoPublico_()` roda `calcular_()` em todas as peças, com cache de 15 minutos
  (`CATALOGO_TTL_S`) invalidado ao gravar.
- Conta Cloudflare: o Worker `playmind3d` já existe (staging estático) e há cartão
  cadastrado.

## Abordagens consideradas

- **A. Mesmo JSON, dentro do D1.** O protocolo continua (save do estado inteiro, versão,
  fusão por lista). App quase não muda. Tira o teto. Não dá consulta nem sync por item;
  cada save segue mandando tudo.
- **B. Tabelas por entidade com sync por item** (`updated_at` por linha, cliente manda só
  o que mudou). Resolve a concorrência de verdade e habilita pedidos online/marketplace.
  Custa reescrever a sincronização offline e o `fusionar_`; muda o shape de `D`.
- **C. A em etapas, indo para B, começando por `vendas`.** **Escolhida pelo Pedro
  (19/11/2026).** Cada etapa é reversível. Risco: B virar "depois"; por isso a etapa 2
  tem prazo (abaixo).

## O desenho

### Etapa 0 — Construir ao lado, sem tocar produção (antes do Natal)

- Criar dois bancos D1: `playmind-staging` e `playmind-prod`.
- Worker novo (`playmind-api`; nome é decisão do construtor), com CORS restrito aos
  domínios acima.
- Esquema mínimo da etapa 1: tabela `estado(clave TEXT PRIMARY KEY, json TEXT, v INTEGER,
  actualizado TEXT)` — mesma ideia da aba `datos`, sem o teto. `v` é um número que só
  cresce (não carimbo de hora), com `UPDATE ... WHERE clave=? AND v=?` para o lock otimista
  no lugar do `LockService`.
- Script de migração: lê o estado atual (via `action=load`), grava no staging, e
  compara contagens por lista e um hash do JSON canônico.
- **Calc compartilhado:** extrair `calc()` para um arquivo `calculo.js` que funciona como
  script clássico no app **e** como módulo no Worker, e **apagar `calcular_()` do
  `Codigo.gs` quando o catálogo passar para o Worker** (de duas cópias vira uma). Antes de
  mexer: testes de paridade com os casos dourados (filamento apagado, `merma` vazia,
  gramas a uma casa, preço manual zero). O `calculo.js` **entra no app já na etapa 0,
  no lugar do `calc()` atual**, provado por esses testes; assim nunca existem três
  cópias: até o cutover são duas (`calculo.js` e `calcular_()`), depois uma.
- Nada disso muda o que a família usa.

### Etapa 1 — Cutover do A (sem trava de Natal; data a decidir)

> **Revisão de 19/11/2026 (tarde).** O Pedro decidiu que **não é preciso esperar o
> Natal** e escolheu planejar e construir a Etapa 1 já, deixando a data do cutover para
> depois. A Etapa 1 se divide em dois planos: **1a** (a API do Worker e as ações novas do
> Apps Script, tudo testado e publicado só no staging, sem tocar a produção) e **1b** (o
> cutover: app e página da raiz, ensaio de rollback e roteiro do dia). Ver "Revisões da
> Etapa 1" no fim deste documento para as escolhas do redator.

- O Worker implementa o mesmo contrato do Apps Script para `load` e `save`: o cliente
  só troca `D.cfg.api` e entende o novo `v` numérico. `fusionar_` é portado para JS
  (mesma regra, mesmos testes dourados que existem no servidor).
- **Autenticação:** o Worker valida o token chamando `validarSesion` no Apps Script e
  guarda o resultado positivo em cache por poucos minutos (mesmo padrão do
  `cadastro-worker`). Usuários e hashes **não migram** nesta etapa. Se o Apps Script
  estiver fora ou sem cota, sessões já validadas seguem valendo até o cache expirar
  (~10 min) e depois o save falha com o aviso e o reintento que o app já tem; login novo
  e foto nova esperam. É uma dependência aceita na etapa 1; se virar problema na
  prática, a autenticação migra para o D1 numa etapa própria.
- **Clientes antigos e páginas públicas (o endereço está fixo no código):** `app.js`
  tem `SERVIDOR` constante (linha 42) e reescreve `D.cfg.api = SERVIDOR` a cada
  abertura; `index.html` da raiz também fixa o seu e chama `?action=catalogo` e
  `editarPieza` direto. Portanto o cutover é um **lançamento de app**, não só uma troca
  de configuração: novo `SERVIDOR` no app e na raiz, `CACHE` do `sw.js` novo. Para o
  celular que ainda roda a versão velha, o Apps Script ganha uma **chave de migração**
  (Script Properties): ligada, `save`, `load` e `editarPieza` respondem `migrado` (o app
  mostra "Actualizá la app") em vez de gravar numa célula morta, e `?action=catalogo`
  passa a repassar a resposta do Worker. Desligar a chave é parte do rollback.
  `vender/index.html` não usa o Apps Script (conferido).
- **Fotos:** continuam no Drive. Quando um save traz `data:image`, o Worker chama uma
  ação nova do Apps Script (`subirFotos`, autenticada com o **mesmo token de sessão** do
  usuário que está salvando, sem segredo compartilhado; ver "Revisões da Etapa 1") que
  devolve o estado com os links. Só acontece em save com foto nova.
- **Catálogo público:** passa a ser servido pelo Worker (`GET /catalogo`, com cache
  curto e invalidação ao gravar). `index.html` da raiz aponta para ele. **Sem fallback para
  o `?action=catalogo` do Apps Script** depois do cutover, porque ele leria uma célula
  que deixou de ser a verdade.
- **Rollback:** durante a janela de observação o Worker, depois de cada save bem-sucedido,
  tenta gravar um instantâneo na célula antiga por uma ação do Apps Script (melhor
  esforço: se passar de 50.000 caracteres, só registra e segue). Voltar atrás = apontar
  `D.cfg.api` e o catálogo de volta ao Apps Script. O espelho é desligado quando a
  janela terminar. **Limite honesto:** a volta ao Apps Script só é prometida enquanto o
  estado couber na célula (< ~45.000 caracteres). Passando disso, a saída é corrigir
  para a frente no Worker, com exportação diária do D1 (e o Time Travel do D1, a
  confirmar na documentação) como rede de segurança; durante a janela o app avisa o
  Pedro se o estado passar de 45.000.
- **Rotas que hoje gravam a célula** e precisam ir para o Worker: `editarPieza`,
  `agregarPieza`, `agregarFilamento`, `resumenNegocio`. O `cadastro-worker` passa a
  chamar o Worker novo.
- **Abas espelho** (Ventas, Piezas, Stock): **decidido pelo Pedro (19/11/2026): a
  família só usa o app, nunca a planilha.** Deixam de ser regravadas a cada save e
  viram uma exportação sob demanda no menu da planilha (opcional, baixa prioridade).
- **Janela:** **decidido pelo Pedro (19/11/2026): a data não importa; ele estará de
  férias mas online** (viagem de 27/01 a 10/02/2027 não restringe o cutover).
  **Decidido pelo Pedro (19/11/2026, tarde): não precisa esperar o Natal**; a data do
  cutover se decide quando a Etapa 1a estiver pronta e ensaiada no staging. Continuam
  valendo: observação de ≥ 2 semanas com o Pedro disponível para testar e desligar a
  chave de migração, cutover fora do horário de venda e a versão atual do Apps Script
  anotada.
- **Pré-Natal, rede de segurança:** se antes do cutover o estado passar de ~42.000
  caracteres (84%), o Pedro decide se aplica a poda barata (vendas antigas para aba
  própria) só para chegar ao cutover.

### Etapa 2 — `vendas` vira tabela (prazo: começar em até 4 semanas após o cutover)

- Tabela `vendas` (id, data, campos da venda, `updated_at`, `deleted`) no D1. Cliente passa
  a mandar **operações** (`venda.add`, `venda.update`, `venda.cancel`) com `id` gerado no
  cliente e fila local offline; o servidor aplica de forma idempotente.
- `vendas` sai do blob; migração em `cargar()`; o servidor devolve a lista por `GET`.
- Vendas são quase só inserção, então praticamente não há conflito; edição/cancelamento
  usa "vale o `updated_at` mais novo" e é registrado.
- Esta etapa tem seu próprio mini-design antes de construir.

### Etapas seguintes — uma entidade por vez, só quando fizer falta

Ordem sugerida: `insumos`/`filamentos`/`impressoras`, `produtos`, `packs`, `canais`.
`cfg`, `pedido` e `pedidoFil` ficam no blob (ajustes e listas de trabalho). Cada uma com
mini-design, migração e rollback próprios. Autenticação migra para o D1 só se o Apps Script
virar gargalo ou for desligado; não é prerrequisito.

## Como saber que deu certo

- Migração em staging: contagens por lista e hash iguais; zero venda perdida.
- Teste de rollback feito de verdade em staging antes do cutover.
- Paridade `calc()` ↔ catálogo comprovada pelos casos dourados.
- O app salva com o estado acima de 50.000 caracteres.
- Catálogo público ≤ 1 s mediano (objetivo da fase 0, medido com `scripts/medir-catalogo.js`).
- Editar uma peça aparece no catálogo em janela anônima (como na fase 0).

## Riscos

- **Sincronização offline:** é a parte difícil; por isso a etapa 1 não a muda.
- **Calc em três lugares** se o `calculo.js` compartilhado não vingar.
- **Apps Script continua no caminho** (login e fotos) e adiciona latência ao `save` quando
  há foto nova.
- **Cache do catálogo** precisa ser invalidado no Worker com a mesma regra da restrição 10.
- Limites do D1 (tamanho de linha, escritas/dia) **a verificar na documentação** antes de
  fixar o esquema; o estado de ~35 KB tende a caber com folga numa linha. [Provável]

## O que fica para o construtor

Nome do Worker e dos bancos; formato exato da resposta de `save` (manter o contrato atual
é o ponto de partida); mecanismo de cache do catálogo no Worker; formato do script de
migração; esquema detalhado da etapa 2; como o `calculo.js` carrega no app e no Worker
sem build.

## Radar (conferido no código)

`correrRadar` (gatilho semanal, segundas 7h) e `radarMundo_` escrevem só nas abas de
tendência e histórico da planilha; **não gravam a célula `estado`**. Ficam no Apps Script
sem mudança e sem risco de bifurcar a verdade. `radar` em `LISTAS_CON_ID` é uma lista do
estado mantida pelo cliente e migra junto com o blob.

## Plano da Cloudflare

Premissa: plano gratuito do Workers/D1 (o cartão cadastrado não diz qual plano é). O
catálogo é **pré-calculado no save e guardado pronto** (KV ou linha no D1), em vez de
rodar `calc()` em todas as peças a cada cache miss, para não depender do limite de CPU.
Os limites reais (tamanho de linha, escritas/dia, CPU) são conferidos na etapa 0.

## Decisões tomadas pelo redator (conferir)

Chave de migração no Apps Script e catálogo repassado ao Worker; `calculo.js` já na etapa
0 (nunca três cópias); dependência do Apps Script aceita na etapa 1 com comportamento
definido quando cair; rollback ao Apps Script só enquanto < 45.000 caracteres; catálogo
pré-calculado no save; plano gratuito como premissa. As demais:

Fotos ficam no Drive; auth fica no Apps Script na etapa 1; catálogo sem fallback para o
Apps Script; espelho de segurança temporário na célula; prazo de 4 semanas para a etapa 2;
cutover logo depois do pico do Natal. (Abas espelho e janela do cutover já são decisões do
Pedro, acima.)

## Revisões da Etapa 1 (19/11/2026, tarde)

**Decisões do Pedro:** não esperar o Natal; planejar e construir a Etapa 1 já; a data do
cutover se decide depois, com o staging ensaiado.

**Escolhas do redator (conferir):**

- **Sem segredo compartilhado.** O Worker reaproveita o token de sessão do usuário que está
  salvando (que ele já valida com `validarSesion`) para chamar `subirFotos` e
  `guardarSnapshot` no Apps Script. Assim não há segredo para guardar em dois lugares nem
  para passar pelo chat. Custo: essas ações exigem sessão válida, e sempre há uma num save.
- **Catálogo calculado na leitura, com cache chaveado pela versão `v` da linha.** A medição
  mostrou folga larga de CPU no escopo medido; com a chave do cache contendo `v`, qualquer
  gravação invalida o catálogo sozinha (restrição 10 satisfeita sem apagar nada). A decisão
  "pré-calcular no save" do desenho original continua pendente de o Pedro confirmar a troca.
- **O app passa a falar com dois endereços:** Apps Script (`login`, `logout`, `foto`,
  `mundo`) e Worker (`load`, `save` e as rotas que hoje gravam a célula). No plano 1b, o
  `pedir()` do app roteia por ação.
- **`v` do Worker é inteiro, devolvido como texto.** O app guarda `D._v` como string; uma
  versão desconhecida do cliente (carimbo de hora do Sheets, vazia ou lixo) é tratada como
  atrasada e cai na fusão, nunca em erro.
- **`clave` só para token inválido.** Se o Apps Script estiver fora do ar, o Worker devolve
  `auth_no_disponible`, porque o app chama `claveVencida()` para o erro `clave` e
  deslogaria a família inteira por uma indisponibilidade.
- **Etapa 1 em dois planos:** 1a (API do Worker, ações novas do Apps Script, staging) e 1b
  (cutover, app, página da raiz, rollback ensaiado). Só o 1b muda o que a família usa.
- **Clientes antigos:** um cliente antigo não tem o código para mostrar "Actualizá la app"; o que ele faz com `migrado` é mostrar uma mensagem enganosa e continuar tentando; a saída é a atualização do service worker (ver docs/migracion-d1.md).

## Etapa 1b — desenho do cutover (proposta de 19/11/2026, a aprovar pelo Pedro)

Escrito depois de a 1a estar publicada e revisada. É o único passo que muda o que a família
usa. As escolhas abaixo são do redator e estão marcadas para conferência.

### Intenção e o que NÃO pode acontecer

Passar o estado da família do Apps Script/Sheets para o Worker/D1, de forma reversível e sem
perder nenhuma venda. Anti-objetivos: perder ou duplicar uma venda; deslogar a família por uma
indisponibilidade; ficar com duas verdades gravando ao mesmo tempo; um rollback que não
funciona quando for preciso.

### Abordagem escolhida: o app se autocorrige pelo erro que recebe (proposta)

- **A (escolhida): roteamento por resposta.** O app entra no ar **dias antes** do cutover,
  inerte, sabendo falar com os dois servidores. Cada servidor responde "este não é o lugar
  certo" quando o estado não está com ele: o Apps Script responde `migrado` (chave ligada) e o
  Worker responde `revertido` (modo só leitura, usado no rollback). O app guarda em memória e no
  `localStorage` em qual servidor está, e ao receber um desses erros troca de servidor e repete
  a mesma requisição. O cutover vira "ligar a chave" e o rollback "desligar a chave", sem
  lançamento de app no dia, e os celulares já estão com o código novo.
- B (descartada): app com o Worker fixo no código, lançado no dia do corte. Obriga a coincidir
  o lançamento com a migração, deixa muitos aparelhos com a versão antiga na hora H e o
  rollback exige outro lançamento.
- C (descartada): endereço lido de um arquivo de configuração. É A com uma peça a mais para
  manter, sem ganho.

### O protocolo no app (mudanças em `app/app.js` e `app/sw.js`)

- Dois endereços: `SERVIDOR` (Apps Script: `login`, `logout`, `foto`, `mundo`, e `load`/`save`
  enquanto o modo for `apps`) e `SERVIDOR_ESTADO` (Worker, para `load`/`save` no modo
  `worker`). `pedir()` escolhe pelo modo e pela ação.
- Tabela de reações: `migrado` (Apps Script) → modo `worker` e repete; `revertido` (Worker) →
  modo `apps` e repete; `clave` → `claveVencida()` como hoje; `auth_no_disponible` → estado de
  erro "o servidor de acesso não responde", **sem deslogar**, reintento a cada 20 s;
  `conflicto` ou `fotos: …` → aviso e reintento; falha de rede → como hoje (`_sucio` fica e
  reenvia). `fusionado` continua baixando de novo.
- O texto "El servidor todavía no tiene datos" não pode aparecer por qualquer erro que não seja
  "sem dados de verdade": o app passa a distinguir.
- `sw.js`: `CACHE` sobe; é isso que atualiza os celulares antigos (rede primeiro).

### Outros chamadores (mesma regra: erro `migrado` → tenta no Worker)

- Página da raiz (`index.html`): `editarPieza` tenta o Apps Script e, se vier `migrado`, o
  Worker. O catálogo continua lendo o Apps Script, que encaminha ao Worker com a chave
  ligada (nenhuma mudança na leitura).
- `cadastro-worker`: chama o Apps Script e, se vier `migrado`, o Worker (nova variável
  `API_WORKER_URL`).

### Segurança dos dados na virada

- **Congelar antes de copiar.** No cutover, a primeira coisa é ligar a chave (todas as
  gravações no Apps Script passam a ser recusadas). Só então se lê o estado final da célula por
  uma ação nova do Apps Script, `exportarEstado` (exige sessão, funciona com a chave ligada ou
  desligada, só lê), e se carrega no D1. Assim não há janela em que alguém grava numa célula que
  já foi copiada.
- **Versão do D1 nunca repete.** A carga define `v` inicial a partir do relógio (segundos,
  10 dígitos), muito acima de qualquer versão já emitida pelo D1 (contam de 1) e distinta dos
  carimbos do Sheets (13 dígitos), e usa um insert que **recusa** sobrescrever uma linha
  existente (`scripts/migracion-d1.js` troca `INSERT OR REPLACE … v=1`). A fonte é a ação do
  servidor, não uma exportação do navegador.
- **Snapshot confiável antes de ligar `SNAPSHOT`:** cada snapshot leva `v` e o Apps Script
  ignora os de versão menor ou igual à última gravada (`d1:snapshotV`); todas as rotas que
  gravam (`save`, `editarPieza`, `agregarPieza`, `agregarFilamento`) mandam snapshot; `excede` e
  falhas ficam registradas e visíveis; `guardarSnapshot_` atualiza `medida:estado` (o "Ver
  cuánto espacio queda" é o medidor do limite de 45.000); timeout no envio.
- **Rollback.** O Worker ganha `MODO` (`escritura` ou `solo-lectura`; em `solo-lectura` as
  rotas que gravam respondem `revertido`). Roteiro: (1) `MODO=solo-lectura` (os apps passam ao
  Apps Script); (2) conferir que o último snapshot é de uma versão igual à do D1; (3) desligar a
  chave. O que o D1 recebeu depois do último snapshot e antes do passo 1 é o único risco, e o
  snapshot por gravação o reduz a segundos. Prazo de validade honesto: o rollback só é prometido
  enquanto o estado couber na célula (< ~45.000 caracteres; hoje ~34.500).

### Verificação e ensaio

- Ensaio automatizado do protocolo no navegador (Playwright, estilo `scripts/humo.js` da outra
  sessão): `fetch` simulado dos dois servidores, cobrindo `migrado`, `revertido`, `clave`,
  `auth_no_disponible`, falha de rede, `fusionado` e a troca de modo em sessão aberta.
- Ensaio de ida e volta **no dia**, com o Pedro online, fora do horário de venda: ligar, conferir,
  desligar, ligar de novo. Não há como ensaiar a chave de verdade antes sem uma cópia da planilha
  e do Apps Script (a chave é global); o ensaio simulado e o roteiro reversível cobrem isso.
- Critérios de sucesso: contagens e hash iguais entre a célula e o D1 depois da carga; nenhuma
  venda perdida num ciclo ida e volta; nenhum aparelho preso em erro depois de 5 minutos;
  catálogo público igual antes e depois.

### O que muda de arquivo (resumo)

`app/app.js` e `app/sw.js` (protocolo), `index.html` da raiz, `cadastro-worker/`,
`api-worker/` (`MODO`, snapshots por rota), `server/Codigo.gs` (`exportarEstado`,
`d1:snapshotV`, `medida:estado`), `scripts/migracion-d1.js` (insert recusando sobrescrita, `v`
inicial), documentos. Duas implantações do Apps Script (**Versão: NUEVA**): a nova ação junto
com tudo o que ainda não foi publicado, e nenhuma no dia do corte (o dia só liga a chave).

### Coordenação e decisões do Pedro

- As edições de `app/` entram na `main` sobre o `app.js` monolítico (decisão de ordem do
  Pedro: o cutover vem primeiro); a outra sessão, que modulariza `app/`, faz `git merge
  origin/main` e porta as linhas tocadas (`SERVIDOR`, `pedir`, `subirALaNube`,
  `bajarDeLaNube`, boot e login). Aviso antes de tocar em `app/`.
- Decisões do Pedro necessárias: (1) a abordagem A; (2) uma ação nova no Apps Script
  (`exportarEstado`) e a publicação dela; (3) o dia e a hora do corte, com ele online; (4) o
  período de observação (≥ 2 semanas) antes de desligar o espelho de segurança.
