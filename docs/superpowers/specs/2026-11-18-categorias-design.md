# Categorías múltiples, filtro y catálogos especializados — design

## Por quê
O Playmind já tem pedidos e vendas constantes e o catálogo está crescendo (decoração, Halloween, Natal,
sensoriais, biologia). Raquel e Leti precisam achar peças rápido no app e mandar a um cliente um catálogo
só do que interessa (ex.: só Natal). Mais tarde o site deve poder mudar de cara conforme a seleção
(tema de época) — isso fica para o redesign.

## Hoje
- Cada peça tem `p.cat` (texto livre, uma categoria) editado em Calcular (`#c_cat`, datalist com
  Sensoriales/Personalizados/Creaciones). Texto livre → "Navidad" e "navidad" viram duas.
- Site (`index.html` raiz) monta os chips de filtro a partir dos `cat` distintos e filtra por igualdade;
  também tem um modo de edição (`edCat`) que salva via `action:editarPieza`.
- Servidor (`server/Codigo.gs`): `agregarPieza_` e `editarPieza_` gravam `cat`; `catalogoPublico_`,
  o resumo de `mundo` e a exportação de planilha leem `cat`.
- Cadastro automático (cadastro-worker + Gemini) manda `categoria` (texto) → `p.cat`.
- Vitrina do app agrupa por `cat`.

## Objetivos
1. Lista de categorias gerenciada em Ajustes: criar, renomear, ordenar, apagar.
   Lista inicial: Decoración, Halloween, Navidad, Sensoriales, Biología + as que já existem nas peças.
2. Uma peça pode ter várias categorias (raro, mas possível) e aparece em todas.
3. Filtro por categoria no Catálogo do app.
4. Site: filtros seguem a lista e a ordem dela; peça aparece em cada categoria marcada.
5. Catálogo especializado de uma categoria: (a) link filtrado `playmind3d.com/?cat=<slug>`,
   (b) PDF com fotos e preços, compartilhado como o presupuesto.

## Não-objetivos
- Tema visual do site por época/seleção (redesign).
- Categoria privada / escondida do site (não foi pedido; todas as categorias aparecem no site).
- Subcategorias.

## Anti-objetivos
- Quebrar o cadastro automático, o modo de edição do site ou a exportação.
- Perder a categoria de alguma peça na migração.
- Estourar os 50.000 caracteres da célula.

## Restrições (do CLAUDE.md)
Sem build; código/interface em es-AR; migração em `cargar()` (os 3 pontos onde já se chama
`migrarPresupuestos`); arquivo novo em `app/` → `sw.js` (`ARCHIVOS` + versão do `CACHE`);
mudou `Codigo.gs` → lembrar "Nueva versión"; `calc()`/`calcular_()` não são tocados.

## Abordagens consideradas
- **A. Lista gerenciada + várias por peça (escolhida pelo Pedro).**
- B. Texto com vírgula no campo atual — mínimo, mas mantém erros de digitação e renomear é manual.
- C. Usar as etiquetas (`tags`) — mistura busca com organização, confunde o site.
Catálogo especializado: Pedro pediu **os dois** (link e PDF).

## Desenho
### Dados
- `D.categorias`: array de nomes em ordem (`["Decoración","Halloween",…]`). Nome é a identidade.
- `p.cats`: array de nomes (subconjunto de `D.categorias`). É a fonte da verdade.
- `p.cat` continua existindo, sempre = `p.cats[0] || ""`, só para compatibilidade com quem ainda lê
  texto (exportação, resumo `mundo`, worker). Ninguém novo deve ler `p.cat`.
- Comparação de nomes sem diferenciar maiúsculas/acentos (`slug`): "navidad" casa com "Navidad".
- Migração (app e servidor, idempotente): peça sem `cats` → `cats = cat ? [cat] : []`;
  `D.categorias` ausente → nomes distintos de `cat` existentes (na ordem em que aparecem) +
  as 5 iniciais que faltarem; nunca duplica por slug.
- Reparo (roda junto com a migração, no app e no servidor): nome em alguma `p.cats` que não está em
  `D.categorias` é adicionado no fim da lista — a peça nunca perde categoria.
- Versão antiga do app em cache ainda edita só `p.cat`: se `p.cat` não vazio e não está (por slug) em
  `p.cats`, ele vira o primeiro de `p.cats` (substitui o antigo primeiro).
- `fusionar_` (servidor) junta `D.categorias` como união por slug (ordem de quem salvou + as que faltam
  no fim), em vez de deixar a última cópia vencer. Consequência aceita: apagar/renomear feito numa cópia
  desatualizada pode "voltar", igual ao comportamento atual dos itens (ver CLAUDE.md).
- Renomear em Ajustes troca o nome em todas as `p.cats`. Apagar pede confirmação, mostra quantas
  peças usam, e tira a categoria delas (a peça fica sem categoria se era a única).

### App
- Ajustes: card "Categorías" com lista (subir/baixar, renomear, apagar) e campo "Nueva categoría".
- Calcular (editor da peça): o input `#c_cat` vira chips marcáveis da lista; um link
  "+ nueva" cria a categoria ali mesmo.
- Catálogo: fila de chips "Todas · Decoración · Halloween · …" no topo; filtra junto com a busca.
  Com uma categoria ativa aparecem dois botões: "Copiar link" e "Catálogo PDF".
- Vitrina: agrupa por `p.cats` (peça em várias categorias aparece em cada grupo), na ordem da lista.

### Catálogo PDF
- Mesmo estilo do presupuesto (faixa teal com logo, Fredoka nos títulos, paleta da marca).
- Título "Catálogo · <Categoría>", data. Grade de peças (foto, nome, preço, "Elegís el color" quando
  aplicável). Não inclui peças com `oculta`. Nunca mostra custo/lucro/horas.
- Rodapé com WhatsApp, @playmind3d e o link filtrado.
- Entrega igual ao presupuesto: compartilhar/caixa "PDF listo"/descarga. Não usa número nem histórico.
- Nome do arquivo: `Catalogo-<Categoria>.pdf`.

### Servidor
- Migração ao ler o estado (mesma regra do app).
- `catalogoPublico_`: cada peça leva `cats`; resposta leva `categorias` (lista em ordem, só as que
  têm peça visível).
- `agregarPieza_` e `editarPieza_` aceitam `cats` (array) e também `cat` (texto, separado por vírgula)
  — texto é convertido casando por slug com a lista; nome novo entra no fim da lista. Mantêm `p.cat`.
- Exportação e resumo `mundo`: `cat` = categorias unidas por ", ".

### Cadastro automático (Gemini / chat "Mind")
- Hoje só `editar_peca` manda `categoria`, e quem aplica é o app (`accionEditarPieza`, `p.cat = …`);
  `cadastrar_peca` não manda categoria nenhuma.
- `resumenNegocio_` passa a incluir `categorias` (a lista), para o Gemini saber quais existem.
- `cadastrar_peca` ganha `categorias` (texto opcional) e `editar_peca` mantém `categoria`; as duas
  descrições pedem "uma ou mais das categorias existentes, exatamente como na lista, separadas por vírgula".
- Conversão texto → `cats` numa função única (`catsDesdeTexto(texto, lista)`), usada pelo app
  (`accionEditarPieza`) e espelhada no servidor (`agregarPieza_`, `editarPieza_`). **Pelo chat, nome que
  não casa com a lista é ignorado — o chat nunca cria categoria** (evita "Natal" virar categoria nova
  ao lado de "Navidad"). Só Ajustes, o editor da peça e o modo de edição do site criam categorias.

### Site
- Chips de filtro na ordem de `categorias`; filtro por `p.cats` contém.
- `?cat=<slug>` abre já filtrado, com o título da seção "Las piezas · <Categoría>"; slug desconhecido
  = sem filtro.
- Modo de edição do site: o campo Categoría vira caixinhas com a lista; salva `cats`.

## Decisões minhas
- Nomes iniciais em es-AR: "Decoración", "Halloween", "Navidad", "Sensoriales", "Biología".
- Nome como identidade (sem id) — dados legíveis e servidor simples; custo: renomear percorre peças.
- `p.cat` mantido como espelho de `cats[0]`.
- Link usa slug sem acento: `?cat=biologia`.
- União por slug em `fusionar_` + reparo de órfãos (revisor apontou perda de categorias entre cópias).
- O chat de cadastro escolhe só categorias existentes e nunca cria novas.
- Regra de compatibilidade com o app antigo em cache (`p.cat` fora de `cats` vira o primeiro).

## Fica para quem constrói
Diagramação da grade do PDF; aparência dos chips; onde exatamente ficam os botões no Catálogo.
