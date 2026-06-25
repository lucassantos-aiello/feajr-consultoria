// Secure server-side proxy: receives the diagnosis form and creates a card in Pipefy.
// The Pipefy token NEVER reaches the browser — it lives only in Vercel env vars.
//
// Required environment variables (set in Vercel → Project → Settings → Environment Variables):
//   PIPEFY_TOKEN    Personal access token  (https://app.pipefy.com/tokens)
//   PIPEFY_PIPE_ID  Numeric id of the pipe that receives the leads
//
// Map your Pipefy start-form field ids below. Leave a value as "" to skip that field.
// Run the GraphiQL query in README.md to discover your field ids.

const FIELD_MAP = {
  nome:     "",   // Nome / Name
  email:    "",   // E-mail
  tel:      "",   // WhatsApp / Telefone
  empresa:  "",   // Empresa
  setor:    "",   // Setor
  estagio:  "",   // Estágio do negócio
  fat:      "",   // Faturamento mensal
  servicos: "",   // Soluções de interesse (checklist / multiselect field)
  col:      "",   // Número de colaboradores
  desafio:  "",   // Maior problema / desafio
  inv:      "",   // Horizonte de investimento
  origem:   "",   // Como nos encontrou
};

// Coded form values -> human-readable labels stored in Pipefy.
const LABELS = {
  estagio: {
    "nao-tenho": "Ainda não tenho empresa",
    "iniciando": "Estou iniciando",
    "operando":  "Já estou operando",
  },
  fat: {
    "nao-tenho": "Ainda não faturou",
    "ate10k":    "Até R$ 10k",
    "10-50k":    "R$ 10k–50k",
    "50-200k":   "R$ 50k–200k",
    "200-500k":  "R$ 200k–500k",
    "500k+":     "Acima de R$ 500k",
  },
  servicos: {
    "estrategia": "Planejamento Estratégico",
    "financeiro": "Planejamento Financeiro",
    "processos":  "Gestão de Processos",
    "marketing":  "Plano de Marketing",
    "pesquisa":   "Pesquisa de Mercado",
    "negocios":   "Plano de Negócios",
    "rh":         "Recursos Humanos",
    "valuation":  "Valuation / M&A",
    "diag":       "Quer um diagnóstico completo",
  },
  col: {
    "1":     "Só eu",
    "2-5":   "2–5",
    "6-15":  "6–15",
    "16-50": "16–50",
    "50+":   "50+",
  },
  inv: {
    "ate2k":   "Até R$ 2.000",
    "2-5k":    "R$ 2k – R$ 5k",
    "5-15k":   "R$ 5k – R$ 15k",
    "15k+":    "Acima de R$ 15k",
    "definir": "A definir com a proposta",
  },
};

function label(group, value) {
  return (LABELS[group] && LABELS[group][value]) || value;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { PIPEFY_TOKEN, PIPEFY_PIPE_ID } = process.env;
  if (!PIPEFY_TOKEN || !PIPEFY_PIPE_ID) {
    console.error("Missing PIPEFY_TOKEN or PIPEFY_PIPE_ID env vars.");
    return res.status(500).json({ error: "Servidor não configurado." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: real users never fill this hidden field. Pretend success for bots.
  if (body.website) return res.status(200).json({ ok: true });

  // Minimal server-side validation.
  if (!body.nome || !body.email || !body.tel) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes." });
  }

  // Normalize values to readable labels.
  const servicos = Array.isArray(body.servicos)
    ? body.servicos.map((s) => label("servicos", s))
    : [];

  const values = {
    nome:     body.nome,
    email:    body.email,
    tel:      body.tel,
    empresa:  body.empresa || "",
    setor:    body.setor || "",
    estagio:  label("estagio", body.estagio),
    fat:      label("fat", body.fat),
    servicos, // array — Pipefy checklist/multiselect accepts an array
    col:      label("col", body.col),
    desafio:  body.desafio || "",
    inv:      label("inv", body.inv),
    origem:   body.origem || "",
  };

  // Build fields_attributes only for fields that are mapped AND have a value.
  const fields_attributes = [];
  for (const key of Object.keys(FIELD_MAP)) {
    const fieldId = FIELD_MAP[key];
    if (!fieldId) continue;
    const v = values[key];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    fields_attributes.push({ field_id: fieldId, field_value: v });
  }

  const title = `${body.nome}${body.empresa ? " — " + body.empresa : ""}`;

  const query = `
    mutation CreateCard($input: CreateCardInput!) {
      createCard(input: $input) { card { id title url } }
    }`;

  const variables = {
    input: {
      pipe_id: String(PIPEFY_PIPE_ID),
      title,
      fields_attributes,
    },
  };

  try {
    const pfRes = await fetch("https://api.pipefy.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PIPEFY_TOKEN}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await pfRes.json();

    if (data.errors || !data.data || !data.data.createCard) {
      console.error("Pipefy error:", JSON.stringify(data.errors || data));
      return res.status(502).json({ error: "Falha ao registrar o lead no Pipefy." });
    }

    return res.status(200).json({ ok: true, card: data.data.createCard.card });
  } catch (err) {
    console.error("Request to Pipefy failed:", err);
    return res.status(502).json({ error: "Não foi possível contatar o Pipefy." });
  }
};
