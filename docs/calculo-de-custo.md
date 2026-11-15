# Lógica de cálculo de custo e preço

Explicação em português da fórmula implementada em `app/app.js` (`calc()`, a partir da
linha com `/* ---------- cálculo ---------- */`) e replicada em `server/Codigo.gs`
(`calcular_()`). As duas implementações precisam sempre bater — ver seção 9 do `CLAUDE.md`.

Este documento existe para uso humano fora do código: a Raquel usa uma cópia dele para
pedir cálculos ao Claude sem abrir o app. Está em português por pedido explícito do
Pedro (exceção à convenção geral de es-AR deste repositório, que vale para código e
interface, não para este explicador).

## A fórmula, passo a passo

1. **Gramas realmente gastas** (peça + desperdício de suportes/purga):
   `gramas = peso_da_peça × (1 + merma/100)`

2. **Material:**
   `material = (preço_do_kg_do_filamento / 1000) × gramas`

3. **Luz:**
   `luz = (watts_da_impressora / 1000) × horas_de_impressão × preço_do_kWh`

4. **Desgaste** (depreciação da impressora, do bico e da mesa, rateada pelas horas desta peça):
   `desgaste = (preço_impressora/vida_útil + preço_bico/vida_útil_bico + preço_mesa/vida_útil_mesa) × horas`

5. **Trabalho manual:**
   `trabalho = valor_hora_mão_de_obra × (minutos_de_trabalho / 60)`

6. **Insumos:** soma do custo unitário de cada um × quantidade usada.

7. **Custo total:**
   `custo = (material + luz + desgaste) × (1 + risco/100) + trabalho + insumos`

8. **Preço final** (quando não há preço manual definido para a peça):
   `preço = arredondar_para_cima(custo × multiplicador × complexidade, múltiplo_de_arredondamento)`

Complexidade é 1 por padrão.

## Fallbacks que precisam concordar nas duas implementações

- Filamento ou impressora apagados (id não existe mais): cai no primeiro item da lista
  respectiva, nunca em custo zero.
- `merma` ausente: assume 12.
- Gramas arredondadas a uma casa decimal.
- Preço manual só vale se for maior que zero.

## Valores de configuração (vivem em `D.cfg`, mudam com o tempo)

`kwh`, `maoObra`, `risco`, `mult`, `round`, `merma` — não hardcode esses valores em
lugar nenhum além da planilha. Uma cópia com os valores de uma data específica está no
Drive, pasta `2brain-compartilhado-Pedro&Raquel/Playmind`, para consulta rápida da
Raquel; se divergir do que a planilha mostra, a planilha é que está certa.

## Onde isso vive

- Implementação: `app/app.js` (`calc`) e `server/Codigo.gs` (`calcular_`) — a fonte da verdade.
- Explicação para humanos, igual a esta: pasta compartilhada do Drive
  `2brain-compartilhado-Pedro&Raquel/Playmind`, para a Raquel usar com o Claude dela
  sem precisar abrir o app.
