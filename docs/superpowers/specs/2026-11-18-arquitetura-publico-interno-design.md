# Arquitetura: separar o lado público do interno — design

Data: 2026-11-18. Escrito para quem vai planejar e construir (Pedro + Claude).
Idioma do documento: português. Código e interface continuam em espanhol (es-AR).

## Intenção e porquê

A PlayMind 3d nasceu como ferramenta interna para 3 pessoas. Agora o catálogo é o
vendedor principal (os pais pedem "o catálogo" pelo WhatsApp) e o negócio vai crescer
(4 a 6 impressoras até fevereiro, novas categorias: decoração, peças para eventos,
teste de 3 produtos em marketplace). O pedido do dono: **site mais fluido, edições mais
fáceis sem mexer em 5 mil linhas de uma vez, e uma base que aguente crescer sem
reescrever tudo**. Também é didático: o dono quer aprender a montar a própria empresa
(projeto de aposentadoria), então cada peça precisa ser explicável.

Princípio central: o **lado público** (catálogo: leitura pesada, tem que ser instantâneo)
e o **lado interno** (app de custo/estoque/vendas: escrita, 3 pessoas) hoje dividem a
mesma célula do Sheets e o mesmo Apps Script. Separá-los é o movimento de maior efeito.

## O que foi verificado no repositório (em 18/11/2026)

- `catalogoPublico_()` (`server/Codigo.gs`) chama `leerEstado_()`, faz parse do estado
  inteiro e roda `calcular_()` em todas as peças **a cada visita**. Não usa `CacheService`.
- As fotos são servidas como `https://lh3.googleusercontent.com/d/<id>` **sem parâmetro
  de tamanho** (`moverFotosADrive_`), ou seja, o visitante baixa o original do celular.
  Parâmetro de tamanho (`=w800` no final da URL) é provável, não testado aqui.
- Os cards do catálogo já reservam altura (`aspect-ratio` em `.p-photo`), então o "pulo"
  de tela relatado vem mais de `pintarGrid()` apagar e recriar a grade inteira a cada filtro
  ou tecla, e da espera pelo Apps Script, do que de imagem sem tamanho. (Hipótese, não
  medida no celular.)
- `app/app.js` tem 4.670 linhas e `app/index.html` 50 `onclick` inline; `Codigo.gs` tem
  1.099 linhas. Existem `cadastro-worker/` (Worker Cloudflare, Gemini, chama o Apps Script)
  e 3 testes em `tests/`. O CLAUDE.md está desatualizado nesses pontos.
- O tamanho real do estado serializado nunca foi medido; o teto é 50.000 caracteres.

## Objetivos

1. Catálogo público abrindo em menos de ~1 s em 4G e primeira foto visível em ~1,5 s
   (alvos propostos; o construtor mede e ajusta).
2. Editar uma parte do app sem ler/alterar o resto: `app.js` dividido em módulos por seção.
3. Fonte da verdade continua uma só (o Sheets). Nenhum dado de negócio é migrado de lugar
   antes de existir motivo medido.
4. Cada fase é reversível e deixa o site funcionando se a fase seguinte falhar.
5. Cada peça nova tem uma explicação de duas linhas no `docs/` (objetivo didático).

## Não-objetivos

- Não trocar o banco de dados agora. D1 só entra com gatilho medido (fase 3).
- Não construir checkout/pagamento próprio agora (o Natal não vende pelo site).
- Não redesenhar visualmente o catálogo aqui (projeto separado: "catálogo de Natal").
- Não adotar framework nem bundler.

## Anti-objetivos (seria fracasso mesmo "funcionando")

- Perder ou corromper dados de venda/estoque.
- Mexer na estrutura durante o pico do Natal de forma que o catálogo possa ficar fora do ar.
- Duas fontes da verdade divergindo (o catálogo mostrar preço diferente do app).
- Complexidade que as 3 pessoas não conseguem manter.

## Restrições herdadas (CLAUDE.md, valem aqui)

Célula de 50.000 caracteres; sem build step; não quebrar o shape do JSON (migração em
`cargar()`); nenhuma credencial no código (segredos em Script Properties / `wrangler secret`);
deploy do Apps Script exige "Versão: NUEVA"; arquivo novo em `app/` entra em `ARCHIVOS` do
`sw.js` e muda o `CACHE`; domínio fica no GitHub Pages (Wix não deixa trocar nameservers),
logo APIs na Cloudflare ficam em `*.workers.dev` com CORS; `calc()` e `calcular_()` precisam
concordar.

## Abordagens consideradas

- **A. Melhorar dentro do Google** (abas por entidade, cache, ajustes). Barato e seguro, mas
  teto de latência e cota do Apps Script e nenhum caminho bom para pagamento.
- **B. Separar: público na Cloudflare, interno no Google por ora.** Escolhida pelo dono.
  O Sheets segue como fonte da verdade; a Cloudflare guarda uma **cópia de leitura** do
  catálogo (e, se necessário, das fotos). Banco só com gatilho.
- **C. Plataforma pronta** (Tiendanube etc.) para vitrine e pagamento. Mais rápido para
  vender online, mas ensina menos e cobra por mês/comissão. Fica como plano B se a demanda
  online chegar antes da fase 3.

Escolha: **B**, com uma fase 0 de medição porque parte da lentidão parece corrigível
dentro do Google em poucas linhas. Se a fase 0 resolver, a fase 1 encolhe.

## O desenho, por fases

### Fase 0 — medir e ganhos baratos (sem risco, antes do Natal se o dono quiser)

- Medir: tempo de `?action=catalogo` a frio e a quente; peso das fotos no catálogo; tamanho
  do estado serializado (logar em `guardarEstado_`, registrar % do teto de 50.000).
- `catalogoPublico_()` passa a adicionar `=w800` (a confirmar) nas URLs de foto **na saída**;
  o estado guardado e os originais no Drive não mudam.
- `CacheService` (script cache) no resultado de `catalogoPublico_()`; `guardarEstado_` limpa
  a chave ao salvar. Atenção ao limite por entrada do cache (~100 KB).
- Resultado esperado: dizer, com números, se a fase 1 é necessária.

### Fase 1 — publicar cópia de leitura na Cloudflare (só se a fase 0 não bastar)

- No fim de um `guardarEstado_` bem-sucedido, o Apps Script gera `catalogoPublico_()` e envia
  para um Worker (`POST /publicar`) com segredo compartilhado guardado em Script Properties
  e `wrangler secret`. O Worker grava em KV e serve `GET /catalogo.json` com CORS e cache.
- O catálogo público (`index.html` da raiz) lê do Worker; se falhar ou passar de um tempo
  limite, **cai de volta para `?action=catalogo`**. O Apps Script nunca deixa de servir.
- Fotos: manter Drive + parâmetro de tamanho se a medição aceitar; senão, gerar variantes
  redimensionadas no upload (canvas no navegador, grátis) e guardar no R2, servidas por
  Worker com cabeçalhos de cache. Decisão do construtor com base na medição.
- A cópia nunca é editada diretamente: só o app escreve, e o Sheets continua a verdade.

### Fase 2 — dividir `app.js` em módulos ES nativos (depois do Natal)

- Uma seção por vez, começando pelas mais independentes (`cálculo`, `almacenamiento`,
  `stock`), cada uma em seu commit, sem mudança de comportamento.
- `type="module"` não exige build. Cada arquivo novo vai em `ARCHIVOS` e o `CACHE` do `sw.js`
  muda.
- Os 50 `onclick` migram aos poucos para `data-acao` + delegação de eventos; enquanto isso,
  funções ainda chamadas por `onclick` ficam expostas num objeto global único.
- Teste de paridade entre `calc()` e `calcular_()` (casos dourados: filamento apagado, merma
  vazia, gramas arredondados, preço manual zero) antes de mexer em `cálculo`.
- Depois de cada extração: `node --check`, testes, abrir `/app/` e clicar as abas afetadas.

### Fase 3 — banco e pagamento (somente com gatilho)

Gatilhos propostos (o dono pode ajustar): estado serializado acima de 35.000 caracteres
(70% do teto), ou pedidos online reais passando de um volume que a família não consegue
processar a mão, ou um marketplace/vitrine exigindo API própria. Aí avaliar D1 (Worker já
existe na conta) contra a plataforma pronta (C), e escolher gateway (Mercado Pago é o
candidato natural na Argentina; não decidido).

## Riscos e reversão

- Duas plataformas para manter: mitigado por publicar automático ao salvar e por fallback.
- Catálogo velho se a publicação falhar: o app mostra aviso e o Worker devolve a data da
  última publicação.
- Cada fase é um conjunto de commits revertível; Apps Script exige "Versão: NUEVA" e o dono
  precisa ser lembrado em cada mudança de `Codigo.gs`.

## O que fica para o construtor

Valores exatos dos limites de desempenho, nome das chaves de KV, formato do segredo, estrutura
interna dos módulos, estratégia de cache no navegador, e a decisão Drive-com-parâmetro versus R2
(com base na fase 0).

## Fora deste documento

Catálogo de Natal (fotos reais, vídeos, visual, navegação sem "pulos"), teste de 3 produtos no
marketplace e organização da operação (quem faz o quê, fila de produção) são projetos próprios.
