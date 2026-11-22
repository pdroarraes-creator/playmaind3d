# Modularizar `app/app.js` (Fase 2) — design

> **Estado: CONCLUÍDO e publicado na `main` em 22/11/2026** (commit `ca7060b`; site no ar com CACHE v46).
> `app/app.js` não existe mais: a lógica está em `app/js/*.js` (18 módulos; `main.js` é só a ligação).
> Desvios em relação ao que está escrito abaixo (todos decididos durante a execução, no ledger de rulings):
> `entrada.js` e `nube.js` foram extraídos por último, depois de o cutover D1 entrar na `main` e ser portado
> à mão; existe `ui.js` (toast, showTab, renderAll) que a estrutura proposta não previa; `window.PM` expõe os 42
> handlers lidos do HTML (não os 38 do plano); `window.PM_ENSAYO` existe só para `scripts/ensayo-protocolo.js`;
> o passo opcional 6 (`data-acao`) **não** foi feito. Regras vivas dos módulos: `CLAUDE.md`, "Módulos de `app/js/`".

Data: 2026-11-19. Escrito para quem vai planejar e construir (Pedro + Claude).
Idioma do documento: português. Código e interface continuam em espanhol (es-AR).

## Intenção e porquê

`app/app.js` tem 4.670 linhas, 16 seções, ~160 funções no escopo global e 50 atributos
`on*=` inline no HTML. Pedro quer a base limpa **antes** de redesenhar o catálogo
(ver `2026-11-18-arquitetura-publico-interno-design.md`, que chamava isto de "Fase 2" e
a marcava para depois do Natal; o dono decidiu puxá-la para antes, em 19/11/2026).
Motivo dito: "tudo em um script só, tudo fica mais difícil de editar". O caso concreto
de dor (achar onde mexer, uma edição que quebra outra coisa, ou o Claude se perdendo
no arquivo) não foi respondido; o construtor deve tratar os três como alvos.

## O que foi medido no repositório

Seções (linhas): almacenamiento 103, cálculo 89, stock 42, fotos 130, catálogo 198,
editor 392, pedido 298, vitrina 221, radar 892, punto de venta 239, cadastro por chat 392,
ventas 523, ajustes 630, entrada 93, nube 287, plumbing 105. Mais ~37 linhas de
cabeçalho com 10 helpers (`$`, `el`, `num`, `money`, `hoy`…).

- **Hubs** (todo mundo depende deles): `almacenamiento` (estado `D` + armazenamento local)
  e o cabeçalho de helpers. `plumbing` (`renderAll`, `toast`, `showTab` e o boot) e `nube`
  (sincronização) dependem de quase tudo **e** são chamados por quase tudo: dependência
  circular, que ES modules aceitam se o uso é só dentro de funções.
- **Estado mutável de topo**: `D` (reatribuído em 3 lugares: duas vezes em `nube`, uma no
  boot) e 16 outros `let/var` (`MODO_VENTA`, `POS`, `CHAT`, `MUNDO`, timers de sync…).
  `import` de ES module **não pode reatribuir**: `D` só pode ser trocado dentro do módulo
  que o declara.
- **Código que roda na carga do arquivo**: IIFEs `var X = (function(){…})()` (`MODO_VENTA`,
  `PIEZA_PENDIENTE`), `document.querySelectorAll(...).forEach` em `plumbing` e a IIFE de
  boot no fim. A ordem de avaliação dos módulos passa a importar.
- **Handlers inline**: 39 nomes distintos em `app/index.html`, 0 em strings de `app.js`
  (o app monta DOM com `el()` e `addEventListener`). Isso torna a migração viável.
- **Testes**: nenhum carrega `app.js` (sem `module.exports`, depende do DOM). Os 7 testes
  atuais cobrem servidor, `presupuesto*.js` e scripts. `presupuesto.js` e
  `presupuesto-pdf.js` já são arquivos separados (scripts clássicos com guarda
  `module.exports`) e **não entram** nesta mudança.
- `sw.js` lista a cache à mão em `ARCHIVOS`; arquivos novos em `app/` precisam entrar ali.

## Objetivos

1. `app.js` deixa de existir como arquivo único: cada seção vira um módulo ES nativo em
   `app/js/`, com `import`/`export` explícitos, mais `app/js/main.js` (boot).
2. **Zero mudança de comportamento** a cada commit. Cada commit deixa o app funcionando.
3. Os 39 handlers inline passam a sair de **um único objeto global** (`window.PM`), não
   de 160 globais soltas. Migração para `data-acao` + delegação de eventos fica como
   etapa final **opcional**, em commits separados das extrações.
4. Rede de segurança que hoje não existe, criada **antes** de mexer: teste de paridade
   `calc()` × `calcular_()`, teste que garante `ARCHIVOS` do `sw.js` = arquivos reais de
   `app/`, e um roteiro de fumaça no navegador (abrir `/app/`, passar por cada aba, zero
   erros no console).
5. Depois disso, editar uma seção exige abrir só o módulo dela e suas importações.

## Não-objetivos

- Não redesenhar nada visual nem tocar o catálogo público (`index.html` da raiz).
- Não mudar `server/Codigo.gs`, nem o shape de `D`, nem `cadastro-worker/`.
- Não introduzir bundler, npm, framework, TypeScript. O que está no repo é o que vai ao ar.
- Não dividir `radar` (892 linhas) em vários módulos nesta etapa; um módulo por seção.
- Não reescrever lógica "já que está aqui". Código movido é código movido.

## Anti-objetivos (seria fracasso mesmo "funcionando")

- **Parar de salvar sem ninguém perceber** (`almacenamiento`/`nube` quebrados): é o pior
  modo de falha deste app. Depois de cada commit que toque essas seções, verificar um ciclo
  completo editar → salvar → recarregar → conferir.
- Usuários presos numa versão mista (HTML novo + módulos velhos, ou o contrário) por causa
  do service worker.
- `calc()` e `calcular_()` divergirem de novo (restrição 9 do CLAUDE.md).
- Uma arquitetura de módulos que as 3 pessoas (e o Claude delas) não conseguem seguir.

## Restrições herdadas (CLAUDE.md, valem aqui)

Sem build step; célula de 50.000 caracteres e formato do JSON inalterados; `sw.js`:
arquivo novo em `app/` entra em `ARCHIVOS` e o `CACHE` muda de versão; `calc()` e
`calcular_()` concordam; um commit por mudança, mensagem em português; depois de mexer
em JS, `node --check` (em módulos: `node --check --input-type=module` ou renomear
temporariamente, o construtor resolve); testes com `node --test tests/*.test.js`.

## Abordagens consideradas

- **A. Fase 2 completa** (escolhida pelo dono). Todas as seções viram módulos.
  Troca: maior esforço, zero ganho visível, e atrasa o redesenho; sem testes de UI, cada
  extração pode quebrar uma aba. Mitigado pela rede de segurança do objetivo 4 e pela
  ordem abaixo.
- **B. Cirúrgico** (recomendada pelo redator, não escolhida): só catálogo da raiz +
  `cálculo`, `almacenamiento`, `stock`, `fotos`, `editor`, que são o que o redesenho toca.
  Entrega a base do redesenho em bem menos tempo.
- **C. Redesenhar já em arquivos novos**, `app.js` intacto. Única que garante a linha
  Navidad no prazo; deixa a dor de edição como está.

O dono escolheu A em 19/11/2026, ciente de que B resolvia o que o redesenho precisa em
menos tempo e de que a linha Navidad (sazonal) corre risco de perder a data.
**Registrado como risco aceito.**

## Desenho

### Estrutura de arquivos (proposta do redator)

```
app/index.html        <script type="module" src="js/main.js">
app/js/util.js        helpers do cabeçalho ($, el, num, money, hoy…)
app/js/estado.js      almacenamiento: D, local, defaults, cargar/guardar local
app/js/calculo.js     cálculo
app/js/stock.js       fotos.js  catalogo.js  editor.js  pedido.js  vitrina.js
app/js/radar.js       pos.js  chat.js  ventas.js  ajustes.js  entrada.js
app/js/nube.js        sincronización
app/js/main.js        plumbing (renderAll, toast, showTab) + boot + window.PM
```

### Regras de módulo

- `D` vive em `estado.js` como `export let D`; importadores leem com *live binding*;
  só `estado.js` reatribui, via `export function reemplazarEstado(x)`. As 3 reatribuições
  atuais passam a chamá-la.
- Estado de topo de cada seção (`POS`, `CHAT`, `MUNDO`…) fica **dentro** do módulo dono;
  se outro módulo precisa mutá-lo, o dono exporta funções, não a variável.
- Dependências circulares permitidas **apenas** quando o uso é dentro de funções. Nada
  que rode na avaliação do módulo (IIFEs, `querySelectorAll`) pode depender de outro
  módulo ainda não avaliado: esse código vai para uma função `iniciar…()` chamada pelo
  `main.js` em ordem explícita.
- Importações com extensão `.js` explícita.

### Ordem de execução (cada item = commits próprios, app funcionando entre eles)

0. **Rede de segurança** (sem refactor): testes de paridade de cálculo com casos dourados
   (filamento apagado, `merma` vazia, gramas a uma casa, preço manual zero), guarda de
   `ARCHIVOS`, roteiro de fumaça no navegador.
1. **Virar módulo sem cortar**: `app.js` → `js/main.js` inteiro, `type="module"`, `window.PM`
   para os 39 handlers, `sw.js` atualizado. Prova a troca (strict, defer, handlers, SW)
   antes de qualquer corte.
2. Extrair, da folha para o centro: `util` → `estado` → `calculo` → `stock` → `fotos` →
   `catalogo` → `editor`.
3. `pedido`, `vitrina`, `pos`, `ventas`, `entrada`.
4. `radar`, `chat`, `ajustes`.
5. `nube`; o que sobrar em `main.js` é o plumbing e o boot.
6. (Opcional, depois) `onclick` → `data-acao` + delegação, uma aba por vez.

## Riscos e reversão

- Cada commit é revertível; o `CACHE` do `sw.js` sobe de versão a cada deploy.
- Deploy em horário de baixa; testar em janela anônima e no celular instalado como PWA
  (é onde o cache velho aparece).
- Se ao fim do passo 2 o prazo da Navidad estiver comprometido, o dono pode parar e seguir
  para o redesenho: o passo 2 já cobre tudo que o redesenho toca (`catalogo`, `editor`,
  `fotos`, `calculo`, `estado`).

## Decisões do dono

- Abordagem A (Fase 2 completa), antes do redesenho (19/11/2026).
- Código e interface em espanhol; o resto em português.

## Decisões tomadas pelo redator (conferir)

Pasta `app/js/` e os nomes dos módulos; `window.PM` como objeto único de handlers;
`data-acao` como etapa opcional final; ordem de extração; `radar` fica inteiro; usar
Playwright (já instalado no ambiente do Claude, **não** vira dependência do repo) só para o
roteiro de fumaça; o teste da lista `ARCHIVOS`.

## O que fica para o construtor

Onde exatamente cada função de `plumbing` vai; como validar sintaxe de módulos com
`node --check`; formato dos casos dourados; se o roteiro de fumaça vira script em
`scripts/` ou só roteiro manual; nomes finais dos módulos.
