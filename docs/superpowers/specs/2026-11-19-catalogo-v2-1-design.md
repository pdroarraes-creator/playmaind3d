# Catálogo V2.1 (página nova ao lado da atual) — design

Data: 2026-11-19. Escrito para quem vai planejar e construir (Pedro + Claude).
Idioma do documento: português. Código e interface continuam em espanhol (es-AR).
Mockup aprovado pelo dono: https://claude.ai/artifact/RFFgcEA2DCf4VjGQZqTtTg (privado; duas telas:
o catálogo no celular e a tarjeta com 3 vistas e a mensagem de WhatsApp). O mockup manda no visual.

## Intenção e porquê

O catálogo público é o vendedor principal: os pais chegam por links de grupos de WhatsApp em Pilar,
quase todos pelo celular. O gargalo não é falta de demanda, é atrito: o pai não entende o tamanho real,
para que serve a peça nem como ela fica, e manda "manda foto real" pelo WhatsApp, o que gera trabalho
manual. A V2.1 reorganiza o catálogo para responder isso na própria página e fechar o pedido com uma
mensagem de WhatsApp já escrita. A spec de origem é a de UX/UI preparada com o Gemini (3 linhas, 3 vistas
por foto, kits, WhatsApp pré-preenchido); este documento a adapta ao que o projeto tem de verdade.
Sucesso: menos pedidos de "manda foto real", e mais pedidos que chegam completos (linha, peça, vista,
tamanho, preço) sem perguntas de ida e volta.

## Decisões do dono (valem como dadas)

- **Sem cor nesta versão**: nem as cores por peça da spec, nem o seletor de cor que existe hoje. A mensagem
  de WhatsApp não leva cor. As cores voltam numa versão posterior, que o dono decide.
- **3 linhas**, nesta ordem: Juguetes & Sensartias, 3corn & Deco, Especial Navidad.
- **3 vistas por foto**: 1 Limpia, 2 En mano, 3 En uso.
- **4 informações por peça**, nesta ordem: ¿Para qué sirve?, Tamaño real, Tiempo de impresión, Material
  (curto, sem detalhe: "PLA, un bioplástico vegetal.").
- **Kits** com preço riscado e botão de pedido; **botão "Pedir este por WhatsApp"** com mensagem pronta.
- **Paleta atual do site** (não a da spec): teal `#2C7A7B`/`#1F5758`, coral `#F4A97F`/`#E8895A`, dourado
  `#C9A227`, fundo `#FAF6EE`, tinta `#3A3A38`, linha `#E4DCCB`. Para texto sobre claro usa-se um coral mais
  escuro derivado (`#A9532A`), porque `#E8895A` não passa no contraste. Fontes do mockup: Nunito (títulos) e
  Plus Jakarta Sans (texto); o catálogo atual usa Fredoka e Nunito, e o dono pode pedir para manter.
- **Entra com todas as peças cadastradas hoje** (43).
- **Abordagem B**: página nova em `/catalogo/`, ao lado da atual, que fica intocada até o dono decidir trocar.

## O que foi verificado (em 19/11/2026)

Catálogo público real (`?action=catalogo`, 43 peças) e repositório:

- 43 peças; **40 sem categoria** (`cat`), 2 "Personalizados", 1 "Sensoriales". Nenhuma é de Navidad ou
  3corn pelo nome. Só 3 parecem Deco (os dois soportes e o estojo).
- **37 têm uma foto só**, 5 têm duas e **só 1 tem três**. Os formatos variam (retrato 293×520, paisagem 520×286) e a
  resolução é baixa (~520 px). Logo o quadro da foto precisa de proporção fixa e recorte (`object-fit: cover`).
- **Estoque 0 em 36 das 43**: a maioria é "a pedido". `medida` vazia em todas. `horas` (tempo de impressão)
  existe e é calculado a partir de `h` e `m`; 7 peças estão sem tempo. `desc` preenchida em 1; `tags`, `video`,
  `detalle` e opiniões em 0.
- **Nenhum kit cadastrado** (`packs` vazio). O servidor já publica kits de dois tipos: preço fixo (`precio`,
  `sueltas`) e regra de desconto.
- **12 de 43 nomes estão em português** ("Chaveiro", "Dragão", "Clicker do Ceifador"…) e aparecem para
  compradores argentinos. É tarefa do dono, não de código; ver Pendências.
- O catálogo atual é um arquivo só (`index.html` da raiz, ~1.190 linhas, CSS e JS inline) com vitrina,
  kits, busca e filtros por etiqueta, grade, opiniões, seção "Leti", barra de pedido (carrinho com + e −),
  folha de detalhe, botão flutuante de WhatsApp e edição no próprio site para admin.
- O editor da app (`app/js/editor.js`) já tem `c_cat` (Categoría), `c_medida` (Tamaño) e `c_desc` ("Cómo se
  la contás a un amigo", 140 caracteres). `desc` serve de "¿Para qué sirve?" sem campo novo.
- Outra conversa de trabalho (migração para D1) vai editar o `index.html` da raiz (`editarPieza`), o
  `server/Codigo.gs` e partes da app. Por isso a abordagem B.
- Sobre a célula de 50.000 caracteres: a outra conversa informou ~69% de uso (não verificado aqui). A V2.1 só
  acrescenta `linea` (poucos bytes, e só nas peças com atribuição manual) e as fotos extras que o dono
  cadastrar (até ~6 KB no pior caso de 2 fotos a mais por peça).

## Objetivos

1. Uma página `/catalogo/` mobile-first que mostra, por peça, 3 vistas de foto, 4 informações e um botão de
   pedido por WhatsApp com a mensagem pronta; organizada em 3 linhas com navegação rápida.
2. Funcionar com os dados de hoje (uma foto, sem `medida`, sem kits) sem mostrar buracos: o que não existe
   some, não aparece vazio.
3. Não tocar o catálogo atual nem o fluxo de venda. Trocar de página é uma decisão do dono, num passo
   separado e reversível.
4. Cumprir o checklist de SEO e compartilhamento do 2brain (`2026-11-19 - Pratica: checklist de SEO e
   compartilhamento para paginas publicas`), principalmente a **imagem de pré-visualização do WhatsApp**.
5. Lógica pura testável em Node (sem DOM) e um roteiro de fumaça no navegador, como no resto do projeto.

## Não-objetivos

- Cores por peça, foto por cor, estoque por cor (versão posterior).
- Páginas por produto com URL própria (só âncoras na mesma página), pagamento ou checkout.
- Mudar `calc()`/`calcular_()`, o formato do estado, o app interno além do que está em "Desenho".
- Framework, bundler, npm. Sem build.
- Trocar a página atual pela nova. Corrigir nomes em português (é do dono).

## Anti-objetivos (seria fracasso mesmo "funcionando")

- Perder a capacidade de pedir **várias peças numa mensagem só** sem o dono ter escolhido isso (ver Pendências).
- Cards com buracos: aba de vista sem foto, bloco "Tamaño real" vazio, preço errado ou diferente do que a app
  mostra.
- Derrubar ou degradar o catálogo atual, que é o que vende hoje.
- Uma página lenta no celular (fotos pesadas, salto de layout).
- Texto de venda que o dono não pode editar sem mexer em código.

## Restrições herdadas (CLAUDE.md, valem aqui)

Sem build step; célula de 50.000 caracteres; não quebrar o formato do JSON salvo (campo ausente tem de
valer como vazio); nunca credencial no código; se alterar `server/Codigo.gs`, lembrar do deploy do Apps
Script com "Versão: NUEVA"; qualquer arquivo novo em `app/` entra em `ARCHIVOS` de `sw.js` e `CACHE` sobe de
versão (só vale se tocar `app/`); `catalogoPublico_` é servido de um cache de 15 minutos; domínio no GitHub
Pages (push na `main` publica); `calc()` e `calcular_()` concordam. O preço mostrado vem do servidor
(`precio`) e a página não o recalcula.

## Abordagens consideradas

- **A. Reescrever o `index.html` da raiz no lugar.** Mais direto; colide com as edições do cutover no mesmo
  arquivo e, se quebrar, derruba o catálogo que vende. Descartada.
- **B. Página nova em `/catalogo/`, ao lado da atual.** Escolhida pelo dono. Mesma fonte de dados
  (`?action=catalogo`) com um campo novo; teste com a família por link; rollback é manter a atual. Custo:
  duas páginas por algumas semanas.
- **C. Dividir o catálogo atual em módulos e só depois redesenhar.** Mais limpo, mais lento, exagero para uma
  página. Descartada.

## Desenho

### Arquivos novos (sem build)

```
catalogo/index.html     meta tags e esqueleto estático (título, descrição, OG, canonical) + <script>
catalogo/estilo.css     tokens da paleta, tipografia, componentes
catalogo/logica.js      funções puras (script clássico, dual-mode: module.exports em Node, como app/calculo.js)
catalogo/pagina.js      DOM: busca dos dados, render, eventos
assets/og-catalogo.png  1200×630, para a pré-visualização do WhatsApp
sitemap.xml, robots.txt na raiz (robots bloqueia /app/ e aponta o sitemap)
scripts/humo-catalogo.js, tests/catalogo-logica.test.js
```

### Dados

- **Um campo novo por peça: `linea`** (`'sensartias' | '3corn' | 'navidad' | ''`). Vazio = a página decide
  por regra de palavras do nome (função pura `lineaDe(p)` em `logica.js`): nome com "soporte", "estojo",
  "porta", "maceta", "organiz" → 3corn & Deco; "navidad", "navideñ", "esfera", "arbol", "pino", "campana"
  → Navidad; o resto → Sensartias. O dono corrige peça a peça no editor da app (select "Línea"); a escolha
  manual vence a regra. Nenhuma migração: ausente vale vazio.
- Servidor: `catalogoPublico_` passa a incluir `linea: p.linea || ''` por peça (mudança de uma linha).
  Todo o resto já é publicado: `nome`, `precio`, `fotos`, `desc`, `medida`, `horas`, `stock`, `packs`, `wa`.
- App: `app/index.html` e `app/js/editor.js` ganham o select "Línea" (`c_linea`), gravado como `cat`/`desc`
  são hoje, e o gestor de fotos passa a mostrar o nome da posição de cada foto ("1 Limpia", "2 En mano",
  "3 En uso"), porque as vistas são posições da lista `fotos`.

### A tarjeta (ver mockup)

- **Foto**: quadro quadrado, `object-fit: cover`, `loading="lazy"`; `alt` = nome da peça + vista. Abas
  sobre a imagem **só para as vistas que têm foto** (posição 1, 2, 3 de `fotos`); com uma foto só, sem abas.
  A etiqueta de tamanho aparece na vista 2 apenas se `medida` existe.
- **Selo**: `stock > 0` → "N disponibles"; senão "Se imprime a pedido".
- **Informações**, cada uma só se houver dado: ¿Para qué sirve? = `desc` da peça, ou um texto padrão da linha
  (editável num único lugar do código); Tamaño real = `medida`; Tiempo de impresión = `horas` formatado
  ("~1 h 30 min", mesmo formato da página atual, "~40 min" abaixo de 1 hora); Material = texto fixo
  "PLA, un bioplástico vegetal." (o claim "no tóxico" saiu a pedido do dono; só voltar se for verdade).
- **Preço** = `precio` do servidor.
- **Botão "Pedir este por WhatsApp"** abre `https://wa.me/<wa>?text=<mensagem>` com: saudação, Línea, Pieza,
  Vista (nome da aba ativa), Tamaño (se houver), Precio, e a pergunta "¿Coordinamos la entrega en Pilar?".
  Sem cor. Se `wa` vier vazio, o botão não aparece (como hoje).
- **Kits**: seção alimentada por `packs`; mostra `sueltas` riscado, `precio` e o desconto em % (calculado, só
  se `sueltas > precio`); oculta se não houver kit. Hoje não há nenhum: criar "Kit Foco Escolar" e "Kit Regalo
  & Deco" é tarefa do dono na aba de kits da app (os do mockup são exemplos).
- **Navidad**: sem peças = teaser "Próximamente" (como no mockup); com peças vira prateleira normal.
- **Navegação**: botões de salto no hero e barra fixa de abas por linha (âncoras), âncora por peça
  (`#p-<slug>`) para compartilhar um link a uma peça.
- **Rodapé e assinatura**: "Curado por Leti (10 años) · Diseñado en Pilar".

### SEO e compartilhamento (do checklist do 2brain)

`<title>` e `meta description` estáticos em espanhol, `og:title/description/image`, `canonical` apontando
para `https://playmind3d.com/catalogo/`, `alt` em toda imagem, um único `<h1>`, `sitemap.xml` e `robots.txt`
(`/app/` bloqueado), `noindex` em `app/index.html`, JSON-LD `Product`/`Offer` gerado pela página (limitação
conhecida: o Google lê melhor HTML pronto do que conteúdo montado por JS; gerar HTML estático fica para
depois). Conferir a pré-visualização colando o link no WhatsApp.

### Acessibilidade e desempenho

Alvos de toque ≥ 44 px; `button` e `a` reais; `aria-pressed` nas abas de vista; `aria-label` em ícones;
contraste ≥ 4,5:1 no texto; quadro de foto com proporção fixa (sem salto de layout); uma foto por card na
carga, as outras vistas só ao tocar a aba; fotos já saem a 800 px (`fotoChica_`).

### Testes

- `tests/catalogo-logica.test.js` (`node:test`): `lineaDe`, `vistasDe(fotos)`, `horasTxt`, `mensajeWA`,
  `descuentoPct`, com os casos reais (peça de 3 fotos, de 1 foto, sem horas, sem `wa`).
- `scripts/humo-catalogo.js` (Playwright, ambiente cloud, como `scripts/humo.js`): serve a raiz, responde
  `?action=catalogo` com um fixture de dados reais, em viewport 390; exige as 3 linhas, abas só onde há foto,
  link do WhatsApp com a peça e o preço, zero erros de console.

### Entrega, reversão e conflitos

`/catalogo/` fica público mas sem link (e já em `playmind3d.pdroarraes.workers.dev/catalogo/`, staging).
Trocar a página atual pela nova é um passo à parte, depois que a família testar. Mudança no servidor: uma
linha em `catalogoPublico_` (cache de 15 minutos; antes do deploy o fallback por regra cobre a falta do campo).
Possíveis conflitos com o cutover: `server/Codigo.gs` (hunk pequeno), `app/index.html`, `app/js/editor.js`,
`app/sw.js` (CACHE).

## Pendências do dono (resolver antes do plano)

1. **Carrinho**: hoje a família monta um pedido com várias peças (barra "Ver pedido", + e −). O mockup tem só
   "Pedir este". Recomendação do redator: manter o carrinho atual como segundo caminho (um "+" discreto no
   card e a barra de pedido), reaproveitando o código que existe. *A confirmar com o dono.*
2. Nomes em português (12 de 43): renomear no editor antes de ir ao ar.
3. Go-live: quando e como trocar a página atual pela nova (cópia, redirecionamento).

## Decisões tomadas pelo redator (conferir)

`linea` como único campo novo e regra por palavras como padrão; `desc` reaproveitada como "¿Para qué sirve?";
vistas como posições da lista de fotos; `catalogo/` com `logica.js` dual-mode; busca por texto mantida (as
etiquetas, vídeos, opiniões e a folha de detalhe não são usados hoje e ficam fora); links "Admin" e "Vender"
só quando logado (como hoje) e edição no próprio site fora; seção "Leti" mínima (assinatura, mais a história
se existir); âncora por peça em vez de página por produto; fontes do mockup; OG 1200×630.

## O que fica para o construtor

Texto padrão de "¿Para qué sirve?" por linha (revisão do dono); lista final de palavras de `lineaDe`;
slug das âncoras; detalhes de layout em telas largas (o mockup é celular); estrutura interna de
`pagina.js`; texto exato da meta description; criação da imagem OG.

## Apêndice: atribuição inicial proposta (regra de palavras sobre as 43 peças reais)

- **3corn & Deco (3)**: Soporte para Lentes Gato, Soporte de colitas, Estojo para Protetor Labia.
- **Navidad (0)**: nenhuma.
- **Juguetes & Sensartias (40)**: todas as outras (fidgets, clickers, chaveiros, articulados, esqueletos,
  Halloween, "Personalizados" e "Kit sensorial"). As duas "Personalizados" podem merecer tratamento próprio.
