# PlayMind 3d — contexto do projeto

App de gestão de uma microempresa de impressão 3D (custos, preços, estoque, vendas
e catálogo público). Usuários reais: 3 pessoas da família. Volume: dezenas de peças
e vendas, não milhares.

**Idioma do código e da interface: espanhol (es-AR).** Comentários e textos novos
devem seguir em espanhol. Conversas com o dono do projeto são em português.

## Arquitetura em uma frase

PWA estático (HTML+JS puro, sem framework, sem build) hospedado no GitHub Pages,
que fala com um Google Apps Script publicado como Web App, que guarda **todo o estado
da aplicação como um único JSON dentro de uma célula do Google Sheets**.

```
navegador ──fetch──> Apps Script (/exec) ──> Google Sheets (aba `datos`, chave `estado`)
                                        └──> Google Drive (fotos das peças)
```

## Mapa de arquivos

| Caminho | O que é |
|---|---|
| `app/index.html` | Shell da app: markup das abas. Sem CSS e sem JS inline. |
| `app/app.css` | Todo o estilo. Design tokens em `:root`. |
| `app/app.js` | Toda a lógica (~3.600 linhas, dividida em seções comentadas). |
| `app/sw.js` | Service worker. **Subir a versão do `CACHE` a cada deploy.** |
| `app/manifest.json` | PWA. `scope` e `start_url` = `/app/`. |
| `index.html` (raiz) | Catálogo público. Consome `?action=catalogo`, não faz login. |
| `vender/index.html` | Página curta de venda. |
| `assets/` | Imagens. `logo-app.png` e `logo-app-full.png` são usados pela app. |
| `server/Codigo.gs` | O Apps Script. **Não roda daqui** — é copiado e colado no editor. |
| `CNAME` | Domínio do site: `playmind3d.com`. Não apagar, o GitHub Pages lê daí. |
| `.nojekyll` | Desliga o Jekyll, que pularia arquivos e pastas começados com `_`. |

## Seções de `app/app.js`

Cada seção começa com `/* ---------- nome ---------- */`. Use `grep -n` para achar,
não leia o arquivo inteiro.

`almacenamiento` · `cálculo` · `stock` · `fotos` · `catálogo` · `editor` · `pedido` ·
`vitrina` · `radar` · `punto de venta` · `ventas` · `ajustes` · `entrada` · `nube` · `plumbing`

## O estado (`D`)

Objeto global único. Chaves de topo:

`cfg` (config e credenciais) · `canais` · `filamentos` · `impressoras` · `insumos` ·
`produtos` · `vendas` · `pedido` · `pedidoFil` · `radar` · `packs` · `opiniones` · `v`

Persistência: `local` (IndexedDB/localStorage) no cliente + sync com o servidor via
`action=save` / `action=load`. **Todo save envia o estado completo.**

## Restrições que não são negociáveis

1. **Célula de Sheets = 50.000 caracteres.** O estado inteiro serializado tem que
   caber. Nunca guarde imagem em base64 dentro de `D`. Fotos vão para o Drive
   (`moverFotosADrive_` no servidor); logos são arquivos em `/assets/`.
2. **Sem build step.** Nada de npm, bundler ou framework. O que está no repo é
   exatamente o que vai pro ar. Prettier é a única ferramenta, e é opcional.
3. **Não quebrar o formato do JSON salvo.** Mudou o shape de `D`? Escreva migração
   em `cargar()`, como a que trata logo base64 legado.
4. **Nunca voltar a colocar credencial no código.** Usuário novo ou troca de clave
   se faz pelo menu da planilha, sem redeploy.
5. **Deploy do Apps Script:** salvar não basta. `Implementar > Administrar
   implementaciones > lápis > Versão: NUEVA`. Se alterou `server/Codigo.gs`, lembre
   o usuário disso.
6. **`sw.js`:** qualquer arquivo novo em `app/` precisa entrar em `ARCHIVOS` e o
   `CACHE` precisa mudar de versão, senão os usuários ficam com a versão antiga.
7. **Hospedagem = GitHub Pages, servindo a branch `main` na raiz.** Push na `main`
   já publica. O domínio é do Wix, que **não deixa trocar os nameservers** dos
   próprios domínios — por isso não dá para usar Cloudflare Workers nem o apex do
   Cloudflare Pages, que exigem nameservers da Cloudflare. O DNS fica no Wix:
   quatro registros A para os IPs do GitHub e um CNAME de `www`.

## Dívidas conhecidas (não corrigir sem combinar)

- ~~Senhas em texto plano no código~~ — resolvido: hash SHA-256 com sal por pessoa,
  guardado em Script Properties. Gestão pelo menu "PlayMind 3d" da planilha.
- ~~Segredo na query string~~ — resolvido: tudo privado vai por POST. `doGet` só
  responde `action=catalogo`, que é público de propósito.
- Sessões duram 90 dias (`SESION_DIAS`) e vivem em Script Properties (`ses:<token>`).
  Não há rate limiting no login: tentativa de força bruta só esbarra na cota do
  Apps Script. Aceitável para 3 pessoas; revisar se abrir para mais gente.
- Sem controle de concorrência de verdade: dois saves quase simultâneos e um
  sobrescreve o outro. O `LockService` protege a escrita, não o conflito lógico.
- Zero testes automatizados.
- `app.js` é um arquivo só. Dividir em módulos é possível, mas exigiria `type="module"`
  e mexer nos 35 `onclick=` inline do HTML.

## Como trabalhar aqui

- Antes de editar, `grep -n` a seção. Não abra `app.js` inteiro sem necessidade.
- Um commit por mudança, mensagem em português.
- Depois de mexer em `app.js`: `node --check app/app.js`.
- Teste abrindo `python3 -m http.server` na raiz e acessando `/app/`.
