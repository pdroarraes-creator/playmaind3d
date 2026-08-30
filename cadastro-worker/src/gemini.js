const MODELO = "gemini-3.6-flash";

const TOOL_CADASTRAR_PECA = {
  functionDeclarations: [
    {
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
    },
  ],
};

function promptSistema(contextoMakerWorld) {
  let base =
    "Você ajuda a cadastrar uma peça de impressão 3D no catálogo da PlayMind 3d, " +
    "conversando em português. Proponha um rascunho de nome, descrição e tags a " +
    "partir do que o usuário mandar (foto e/ou link do MakerWorld). Pergunte o " +
    "que estiver faltando — principalmente a COR usada e o PREÇO, que nunca vêm " +
    "do MakerWorld. Só chame a função cadastrar_peca depois que o usuário " +
    "confirmar explicitamente todos os campos (ex: respondeu 'sim', 'confirmar', " +
    "'pode cadastrar'). Nunca chame a função numa primeira mensagem.";
  if (contextoMakerWorld) {
    base +=
      "\n\nDados extraídos do MakerWorld para essa peça (use como base, mas " +
      "confirme com o usuário — podem estar incompletos ou errados):\n" +
      JSON.stringify(contextoMakerWorld);
  }
  return base;
}

/** historial: array de {role: 'user'|'model', texto} (sin function calls,
    el historial que guarda el cliente es sólo texto). */
export async function conversar(env, { historial, mensaje, foto, contextoMakerWorld }) {
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
    systemInstruction: { parts: [{ text: promptSistema(contextoMakerWorld) }] },
    tools: [TOOL_CADASTRAR_PECA],
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
