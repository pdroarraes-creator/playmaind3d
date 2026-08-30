const MODELO = "gemini-3.6-flash";

const TOOL_CADASTRAR_PECA = {
  name: "cadastrar_peca",
  description:
    "Cadastra a peça no catálogo. SÓ chamar depois que o usuário confirmar " +
    "explicitamente todos os campos na conversa (inclusive os que faltam, " +
    "como cor e preço) — nunca chamar antes de uma confirmação clara.",
  parameters: {
    type: "object",
    properties: {
      nome: { type: "string" },
      descricao: { type: "string" },
      tags: { type: "string", description: "separadas por vírgula" },
      peso_g: { type: "number" },
      tempo_min: { type: "number" },
      preco: { type: "number" },
      cor: { type: "string" },
    },
    required: ["nome", "preco"],
  },
};

const TOOL_CADASTRAR_FILAMENTO = {
  name: "cadastrar_filamento",
  description:
    "Cadastra um filamento novo (extraído da foto da caixa/rolo). SÓ chamar " +
    "depois que o usuário confirmar explicitamente todos os campos — " +
    "principalmente o preço, que quase nunca vem legível na foto.",
  parameters: {
    type: "object",
    properties: {
      marca: { type: "string" },
      tipo: { type: "string", description: "ex: PLA, PETG, ABS" },
      cor: { type: "string" },
      hex: { type: "string", description: "cor aproximada em hexadecimal, ex: #FF8040" },
      peso_rollo_g: { type: "number", description: "peso do rolo inteiro em gramas, geralmente 1000" },
      preco_kg: { type: "number" },
    },
    required: ["tipo", "preco_kg"],
  },
};

// Estas tres se ejecutan en el CLIENTE (app.js), no acá: reusan las mismas
// funciones que la app ya usa a mano (sumarStock, aplicarVenta, calc), en vez
// de duplicar esa lógica en el Apps Script. El Worker sólo las declara y
// devuelve la propuesta; app.js la ejecuta cuando el usuario confirma.
const TOOL_EDITAR_PECA = {
  name: "editar_peca",
  description:
    "Corrige os textos de uma peça que JÁ existe: descrição, detalhe, medida, " +
    "tags e categoria. Não mexe em preço, peso nem tempo. Mande só os campos " +
    "que mudam. Só chamar depois de confirmação explícita.",
  parameters: {
    type: "object",
    properties: {
      nome: { type: "string", description: "nome exato da peça que já existe" },
      descricao: { type: "string" },
      detalhe: { type: "string" },
      medida: { type: "string" },
      tags: { type: "string", description: "separadas por vírgula" },
      categoria: { type: "string" },
    },
    required: ["nome"],
  },
};

const TOOL_AJUSTAR_ESTOQUE = {
  name: "ajustar_estoque",
  description:
    "Muda quantas unidades prontas existem de uma peça. Positivo quando " +
    "imprimiu ('imprimi 5'), negativo quando quebrou ou perdeu. Ao somar, o " +
    "filamento e os insumos são descontados sozinhos. Só chamar depois de " +
    "confirmação explícita.",
  parameters: {
    type: "object",
    properties: {
      nome: { type: "string", description: "nome exato da peça" },
      quantidade: { type: "number", description: "positivo soma, negativo tira" },
    },
    required: ["nome", "quantidade"],
  },
};

const TOOL_REGISTRAR_VENDA = {
  name: "registrar_venda",
  description:
    "Registra uma venda já feita, pelos preços atuais de cada peça. O que " +
    "estava pronto sai do estoque; do que faltar, desconta o material. Só " +
    "chamar depois de confirmar as peças e as quantidades com o usuário.",
  parameters: {
    type: "object",
    properties: {
      cliente: { type: "string" },
      forma: { type: "string", description: "efectivo ou transferencia" },
      itens: {
        type: "array",
        description: "peças vendidas",
        items: {
          type: "object",
          properties: {
            nome: { type: "string", description: "nome exato da peça" },
            qtd: { type: "number" },
          },
          required: ["nome", "qtd"],
        },
      },
    },
    required: ["itens"],
  },
};

function promptSistema(contextoMakerWorld, contextoNegocio) {
  let base =
    "Você é a Mind, a assistente da PlayMind 3d — uma microempresa familiar de " +
    "impressão 3D, três pessoas, na Argentina.\n" +
    "IDIOMA: responda sempre no idioma da última mensagem de quem escreveu. Se " +
    "escreverem em espanhol, responda em espanhol argentino, com voseo (tenés, " +
    "podés, mirá, fijate). Se escreverem em português, responda em português.\n" +
    "Seja curta e direta: quem te usa está no celular, muitas vezes de pé no " +
    "meio de uma feira. O app já cumprimentou quando abriu a conversa, então " +
    "não cumprimente de novo — vá direto ao ponto.\n\n" +
    "O QUE VOCÊ FAZ\n" +
    "· Cadastrar peça (cadastrar_peca): a partir de foto da peça impressa e/ou " +
    "link do MakerWorld. Proponha nome, descrição e tags; pergunte a COR e o " +
    "PREÇO, que nunca vêm do MakerWorld.\n" +
    "· Cadastrar filamento (cadastrar_filamento): a partir da foto da caixa ou " +
    "do rolo. Leia marca, tipo e cor na foto; pergunte o preço por kg (quase " +
    "nunca está legível) e o peso do rolo (1000g é o normal, mas confirme). A " +
    "foto da caixa não fica guardada: ela só serve pra você ler os dados agora. " +
    "Cada rolo recebe um NÚMERO automático ao ser cadastrado — depois de " +
    "cadastrar, lembre a pessoa de escrever esse número no rolo com marcador.\n" +
    "· Corrigir peça já cadastrada (editar_peca): só textos — descrição, " +
    "detalhe, medida, tags, categoria. Preço, peso e tempo se mudam no editor, " +
    "não por aqui; se pedirem isso, diga onde fica.\n" +
    "· Ajustar estoque (ajustar_estoque): quando imprimiu unidades novas ou " +
    "perdeu alguma.\n" +
    "· Registrar venda (registrar_venda): pelos preços atuais das peças.\n" +
    "· Responder perguntas sobre peças, estoque, filamento e vendas, usando o " +
    "resumo abaixo. Aí NÃO chame função nenhuma, só responda.\n\n" +
    "REGRAS DA CASA\n" +
    "· Nunca chame uma função na primeira mensagem. Primeiro mostre os campos " +
    "que vai gravar e espere um 'sim', 'confirma', 'pode salvar'.\n" +
    "· Para editar, ajustar estoque ou registrar venda, use o nome EXATO de uma " +
    "peça que está na lista do resumo. Se não achar, diga que não achou e " +
    "mostre os nomes parecidos — nunca invente uma peça.\n" +
    "· Filamento é o insumo crítico. Se sobrar menos de 15% do rolo (stock_g " +
    "dividido por rollo_g), avise mesmo sem ser perguntada.\n" +
    "· Cada filamento tem um `num`, que é o número escrito no rolo físico. Ao " +
    "falar de um filamento, diga o número junto com o nome (ex: «o 3, PLA " +
    "branco»): é assim que eles acham o rolo na estante.\n" +
    "· Valores em pesos argentinos, escritos como $1.234. Estoque de filamento " +
    "em gramas, tempo de impressão em minutos.\n" +
    "· margem_pct é quanto sobra em cada peça, já descontado o custo.\n" +
    "· Ao falar de dinheiro, dê o número. Nunca mande consultar a planilha.\n" +
    "· Se o dado não estiver no resumo, diga que não tem. Não invente número.";
  if (contextoMakerWorld) {
    base +=
      "\n\nDados extraídos do MakerWorld para a peça sendo cadastrada agora " +
      "(use como base, mas confirme com o usuário — podem estar incompletos):\n" +
      JSON.stringify(contextoMakerWorld);
  }
  if (contextoNegocio) {
    base += "\n\nRESUMO ATUAL DO NEGÓCIO\n" + JSON.stringify(contextoNegocio);
  }
  return base;
}

/** La API espera turnos alternados que arranquen por el usuario, y el
    historial del cliente no siempre queda así: cuando se confirma una acción
    (registrar venta, ajustar stock) el resultado se suma como otro turno del
    modelo, quedando dos seguidos. Se juntan en un turno con varias partes. */
function armarContents(historial) {
  const out = [];
  (historial || []).forEach((h) => {
    if (!h || !h.texto) return;
    const role = h.role === "user" ? "user" : "model";
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.role === role) ultimo.parts.push({ text: h.texto });
    else out.push({ role, parts: [{ text: h.texto }] });
  });
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

/** historial: array de {role: 'user'|'model', texto} (sin function calls,
    el historial que guarda el cliente es sólo texto). */
export async function conversar(env, { historial, mensaje, foto, contextoMakerWorld, contextoNegocio }) {
  const contents = armarContents(historial);

  const partesUsuario = [{ text: mensaje || "" }];
  if (foto) {
    partesUsuario.push({
      inlineData: { mimeType: foto.mimeType || "image/jpeg", data: foto.base64 },
    });
  }
  contents.push({ role: "user", parts: partesUsuario });

  const body = {
    contents,
    systemInstruction: { parts: [{ text: promptSistema(contextoMakerWorld, contextoNegocio) }] },
    tools: [
      {
        functionDeclarations: [
          TOOL_CADASTRAR_PECA,
          TOOL_CADASTRAR_FILAMENTO,
          TOOL_EDITAR_PECA,
          TOOL_AJUSTAR_ESTOQUE,
          TOOL_REGISTRAR_VENDA,
        ],
      },
    ],
  };

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const j = await r.json();
  if (!r.ok) {
    throw new Error("gemini_error: " + JSON.stringify(j).slice(0, 500));
  }

  const partes = j.candidates?.[0]?.content?.parts || [];
  const texto = partes
    .filter((p) => p.text)
    .map((p) => p.text)
    .join("\n");
  const chamada = partes.find((p) => p.functionCall)?.functionCall || null;

  return { texto, chamada };
}
