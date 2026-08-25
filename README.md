# PlayMind 3d

Sistema de custos, preços, estoque, vendas e catálogo público de uma microempresa
de impressão 3D.

- App (privada): `/app/` — PWA, precisa de e-mail e clave.
- Catálogo público: `/` — aberto, sem login.
- Servidor: Google Apps Script (`server/Codigo.gs`) + Google Sheets.

## Rodar localmente

```bash
python3 -m http.server 8080
# abrir http://localhost:8080/app/
```

## Publicar

O site é estático. O GitHub Pages serve a raiz da branch `main` como está —
não há build. Faça push na `main` e no minuto seguinte já está no ar em
`playmind3d.com`.

O DNS fica no Wix (que não deixa trocar os nameservers dos domínios dele):
quatro registros A na raiz apontando para os IPs do GitHub Pages, e um CNAME
de `www` para `pdroarraes-creator.github.io`. O arquivo `CNAME` na raiz do
repositório é o que fixa o domínio — não apague.

O servidor é separado: copie `server/Codigo.gs` para o editor do Apps Script e
publique uma **nova versão** da implementação (salvar não basta).

Contexto técnico completo, restrições e dívidas conhecidas: veja `CLAUDE.md`.

## Acessos (quem pode entrar)

As claves não estão no código. Ficam com hash nas Propriedades do Script.
Gestão pelo menu **PlayMind 3d** que aparece na planilha:

- Dar acesso ou trocar clave
- Ver quem tem acesso
- Tirar o acesso de alguém
- Fechar todas as sessões

Trocar pessoa ou clave **não** exige republicar o servidor.
