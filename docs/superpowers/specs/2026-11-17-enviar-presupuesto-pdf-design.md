# Botão "Enviar presupuesto" em PDF — design curto

## Por quê
Raquel e Leti montam pedidos na aba "Pedido" do app (admin). Hoje `mandarWA()` só manda texto.
O negócio já tem vendas constantes e quer passar mais profissionalismo: orçamento em PDF, com fotos e valores.

## Objetivos / não-objetivos
- Objetivo: 1 toque gera PDF com a marca e abre o compartilhar do celular → WhatsApp com o arquivo anexado.
- Não-objetivo: redesign do site público e o "3D na marca" (próxima conversa); cliente montar orçamento sozinho no site.
- Anti-objetivo: estourar a célula de 50 mil caracteres do Sheets; quebrar o botão de texto que já existe.

## Abordagens consideradas
- A. Página imprimível → "Guardar como PDF": sem biblioteca, mas ~5 toques e anexo manual.
- **B. PDF gerado no app + Web Share (escolhida pelo Pedro).**
- C. PDF no Apps Script salvo no Drive: arquivado, mas o cliente recebe link, não arquivo; mais lento.

## Como funciona (B)
- Aba Pedido ganha o botão principal "Enviar presupuesto (PDF)". O botão de texto atual continua como secundário.
- O PDF (A4, es-AR) traz: logo e cores da marca; "Presupuesto N° 042", data e "válido 7 días";
  nome do cliente (campo `p_cli`); por peça: foto, nome, cor escolhida, quantidade, preço unitário e subtotal;
  desconto, envio, total; rodapé com "Se imprime a pedido", WhatsApp e @playmind3d.
  Nunca aparecem custo, lucro, comissão ou horas.
- Celular: `navigator.share({files:[pdf], text})` abre o compartilhar. Se o aparelho não suportar,
  o PDF é baixado e abre o WhatsApp com o texto atual.
- Nome do arquivo: `Presupuesto-042-<cliente>.pdf`.

## Decisões minhas (podem ser corrigidas)
- Biblioteca jsPDF guardada em `app/vendor/` (sem build, funciona offline). Entra no `ARCHIVOS` do `sw.js`, com versão nova do `CACHE`.
- Numeração em `D.cfg.presupNum`. Histórico enxuto em `D.presupuestos`
  (só número, data, cliente e total; guarda os últimos 30), com migração em `cargar()`. O PDF em si não é salvo no estado.
- Validade padrão de 7 dias, ajustável em Ajustes.
- Títulos em Fredoka embutida no PDF, texto em Helvetica (evita pesar o arquivo).
- Fotos: o app tenta ler direto do Google (lh3). Se o Google bloquear, uma ação nova no Apps Script
  (`action=foto`) devolve a imagem. Nesse caso precisa de "Nueva versión" no deploy do script.
  Peça sem foto sai com um quadro na cor da marca.

## Fica para quem constrói
Diagramação fina do PDF dentro da paleta (teal #2C7A7B, azul-céu #7FB8D3, coral #F4A97F,
dourado #C9A227, fundo #FAF6EE).
