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

## Não confirmado

- Tamanho do estado real do Pedro (`chars`) e tempo real de `Calculo.calcular`
  sobre as peças dele: depende do estado exportado, ainda não entregue
  (Passos 4 e 5 da Task 6). Os números do plano gratuito acima são o contexto
  para comparar.
- Se a conta do Pedro está mesmo no plano Workers Free: não verificado aqui.
- A página de limites do D1 não diz qual é o limite de linhas escritas por
  *transação/lote*; só valem as cotas diárias acima.

## Decisão "catálogo pré-calculado no save"

Ainda **sem conclusão**: depende da medição do Passo 5 com o estado real. O
limite de 10 ms de CPU por requisição do plano gratuito é o número a vencer.
