# Migração para D1: limites da Cloudflare

Consultado em **2026-11-19** nas páginas oficiais da documentação da Cloudflare.
Os números abaixo valem para o plano gratuito (Workers Free), salvo indicação.

## D1 (https://developers.cloudflare.com/d1/platform/limits/)

| Item | Limite |
|---|---|
| Tamanho máximo de string, BLOB ou linha de tabela | 2.000.000 bytes (2 MB) |
| Tamanho máximo do banco | 500 MB (gratuito) / 10 GB (pago) |
| Armazenamento total por conta | 5 GB (gratuito) |
| Bancos por conta | 10 (gratuito) |
| Tamanho máximo de uma instrução SQL | 100.000 bytes (100 KB) |
| Parâmetros vinculados por consulta | 100 |
| Duração máxima de uma consulta | 30 segundos |
| Tamanho máximo do resultado de uma consulta | 50 MB |
| Consultas por invocação do Worker | 50 (gratuito) |
| Time Travel (recuperação a um ponto no tempo) | 7 dias (gratuito) / 30 dias (pago) |

Observação: um banco D1 processa uma consulta por vez (single-thread); o
throughput depende da duração das consultas.

## D1, preços e cota diária (https://developers.cloudflare.com/d1/platform/pricing/)

| Item | Plano gratuito |
|---|---|
| Linhas escritas | 100.000 por dia (zera às 00:00 UTC) |
| Linhas lidas | 5 milhões por dia |
| Armazenamento | 5 GB no total |

Ao estourar a cota diária, o D1 devolve erro até a virada do dia (ou até
passar ao plano pago). Consultas feitas pelo Wrangler ou pelo painel também
contam. Um índice soma uma linha escrita por escrita.

## Workers (https://developers.cloudflare.com/workers/platform/limits/)

| Item | Plano gratuito |
|---|---|
| Tempo de CPU por requisição HTTP | 10 ms |
| Tamanho do Worker (bundle, sem comprimir) | 64 MiB |
| Tempo de inicialização | 1 segundo |
| Memória por isolate | 128 MB |
| Requisições por dia | 100.000 |
| Subrequisições por invocação | 50 |
| Variáveis de ambiente | 64 por Worker, 5 KB cada |
| Workers por conta | 100 |

O tempo de CPU não conta a espera por rede nem por consultas ao D1, só a
execução do código (inclui serializar JSON e calcular preços).

## Cache API em workers.dev

Verificado em 2026-11-19 em https://developers.cloudflare.com/workers/runtime-apis/cache/ (e conferido https://developers.cloudflare.com/workers/platform/limits/, que só trata dos limites de chamadas da Cache API).

Frase exata da página do Cache: "Workers deployed to custom domains have access to functional `cache` operations. So do Pages functions, whether attached to custom domains or `*.pages.dev` domains."; logo depois: "However, any Cache API operations in the Cloudflare Workers dashboard editor and Playground previews will have no impact."

Conclusão: a documentação **não menciona `*.workers.dev`** de forma explícita. A frase "will have no impact" vale para o editor do painel e o Playground, não para workers.dev. Mas só garante `cache` funcional em Workers com domínio próprio (e em Pages, inclusive `*.pages.dev`), o que sugere por omissão que em `*.workers.dev` pode não funcionar. Ou seja: confirma só em parte, por implicação; a lembrança do revisor não está escrita assim. O cache do catálogo no Worker é inofensivo (se for um no-op, o catálogo é só recalculado a cada leitura, ~0,03 ms de CPU) e não foi alterado.

## Verificação do bundle (2026-11-19)

O `wrangler deploy --dry-run` da fase A não provava nada sobre o cálculo, porque
`src/index.js` ainda não importa `src/calculo.js`. Verificação direta:
`npx esbuild src/calculo.js --bundle --format=esm --outfile=/tmp/calculo-bundle.mjs`
(de `api-worker/`) gerou 4,6 kB sem erro. O export padrão do bundle tem
`calcular` como função e devolve o mesmo resultado que `app/calculo.js`: os 217
casos de `tests/fixtures/calculo-dorados.json` batem com o esperado. O bundle
não foi commitado e `src/index.js` não foi alterado.

## Medição com o estado real (2026-11-19)

Estado real: 34.447 caracteres, 43 peças. Medido em Node 22 com
`Calculo.calcular(pieza, D)` sobre todas as peças por "passada de catálogo":
50 passadas de aquecimento e 300 medidas.

| Catálogo | Peças | Mediana | p95 |
|---|---|---|---|
| Real | 43 | 0,029 ms | 0,073 ms |
| 10x maior | 430 | 0,077 ms | 0,168 ms |

Além disso, `JSON.parse` do estado inteiro: mediana 0,073 ms, p95 0,144 ms.

Comparação:
- Limite de CPU do plano gratuito: 10 ms por requisição. Calcular o catálogo
  inteiro na leitura usa menos de 1% disso (mesmo com 10x peças e o parse,
  fica abaixo de 0,5 ms em Node).
- Limite de linha do D1: 2.000.000 bytes. O estado ocupa 1,72% (34.447 caracteres).
- Os 34.447 caracteres já são 69% da célula de 50.000 do Sheets (gatilho de
  70% próximo); no D1 esse teto deixa de existir.

Aviso: os tempos são de Node, só uma **estimativa** da CPU num Worker (outro
motor de execução, outro hardware, e sem o custo de inicialização do isolate
nem de montar a resposta HTTP).

### Recomendação sobre o catálogo pré-calculado no save

**Escopo medido:** apenas `calcular` sobre todas as peças mais um `JSON.parse`
do estado, com o código já aquecido (50 passadas de aquecimento, depois
medianas), em Node. **Não está incluído:** serializar a resposta, reescrever as
URLs das fotos (`fotoChica_`, `=w800`), ler o D1 ou o KV, nem um isolate a frio
(onde a primeira chamada roda sem otimização do JIT, mais lenta que a mediana).

Nesse escopo, o cálculo na leitura cabe **com folga larga** (duas ordens de
grandeza abaixo de 10 ms), e o pré-cálculo no save não seria necessário por CPU.
Como o escopo é parcial, a conclusão é provisória: **medir o endpoint real na
Etapa 1 antes de dispensar o pré-cálculo.** O pré-cálculo tem ainda um
argumento que não é de CPU: permite cachear a resposta pública. Mas guardar o
preço calculado no momento do save **não evita** divergência: se a fórmula
mudar, o catálogo serve preços velhos até o próximo save de cada peça. Por isso
a **recomendação** é calcular na leitura (uma única fonte da fórmula,
`app/calculo.js`) e só pré-calcular se a medição no Worker real mostrar CPU
perto do limite. É uma recomendação, não uma decisão: a decisão é do dono, e até
ele decidir vale o que diz a spec (catálogo pré-calculado no save).

## Staging raiz e .assetsignore

- Fonte: https://developers.cloudflare.com/workers/static-assets/binding/ (seção "Ignoring assets", lida em 2026-11-19): o Wrangler não sobe os arquivos que casam com o `.assetsignore` da raiz do diretório de assets, que usa o formato do `.gitignore`. A página não diz que o Wrangler leia o `.gitignore` nem que ignore `node_modules` por padrão; por isso o `.assetsignore` da raiz exclui `datos-privados`, `node_modules`, `.superpowers`, `api-worker` e os arquivos `*.estado.json`, `*.carga.sql`, `salida-d1*.json`.
- Verificação local (guardando só contagens): percorrendo os 11.223 arquivos do repositório (sem `.git`) com a semântica do `.gitignore`, sobram 57 e nenhum é dado privado, `node_modules` ou `.superpowers`.

## Não confirmado

- Tempo real de CPU num Worker (só há estimativa em Node); medir com o Worker
  de staging quando houver endpoint de catálogo.
- Se a conta do Pedro está mesmo no plano Workers Free: não verificado aqui.
- A página de limites do D1 não diz qual é o limite de linhas escritas por
  *transação/lote*; só valem as cotas diárias acima.
