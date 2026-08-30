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

function promptSistema(contextoMakerWorld, contextoNegocio) {
  let base =
    "Você é o Mind, o assistente da PlayMind 3d (microempresa de impressão 3D), " +
    "conversando em português. Você faz três coisas:\n" +
    "1) Cadastrar peça nova: usuário manda foto da peça impressa e/ou link do " +
    "MakerWorld. Proponha nome/descrição/tags a partir disso, pergunte o que " +
    "falta (principalmente COR e PREÇO, que nunca vêm do MakerWorld), e só " +
    "chame cadastrar_peca depois de confirmação explícita do usuário.\n" +
    "2) Cadastrar filamento novo: usuário manda foto da caixa/rolo. Leia marca, " +
    "tipo (PLA/PETG/etc) e cor na foto, pergunte o preço por kg (quase nunca " +
    "está legível) e o peso do rolo (assuma 1000g se não disser nada mas " +
    "confirme), e só chame cadastrar_filamento depois de confirmação explícita.\n" +
    "3) Responder perguntas sobre o negócio (peças, estoque, filamentos, " +
    "vendas, financeiro) usando os dados fornecidos abaixo — nesse caso NÃO " +
    "chame nenhuma função, só responda em texto.\n" +
    "Nunca chame uma função de cadastro numa primeira mensagem, sem ter " +
    "mostrado os campos e recebido uma confirmação clara (ex: 'sim', " +
    "'confirmar', 'pode cadastrar').";
  if (contextoMakerWorld) {
    base +=
      "\n\nDados extraídos do MakerWorld para a peça sendo cadastrada agora " +
      "(use como base, mas confirme com o usuário — podem estar incompletos):\n" +
      JSON.stringify(contextoMakerWorld);
  }
  if (contextoNegocio) {
    base +=
      "\n\nResumo atual do negócio (para responder perguntas — números em R$ " +
      "e gramas):\n" +
      JSON.stringify(contextoNegocio);
  }
  return base;
}

/** historial: array de {role: 'user'|'model', texto} (sin function calls,
    el historial que guarda el cliente es sólo texto). */
export async function conversar(env, { historial, mensaje, foto, contextoMakerWorld, contextoNegocio }) {
  const contents = historial.map((h) => ({
    role: h.role,
    parts: [{ text: h.texto }],
  }));

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
    tools: [{ functionDeclarations: [TOOL_CADASTRAR_PECA, TOOL_CADASTRAR_FILAMENTO] }],
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
