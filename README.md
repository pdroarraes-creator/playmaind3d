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

O site é estático. O Cloudflare Pages serve a raiz do repositório como está —
não há build. Faça push na branch principal.

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
