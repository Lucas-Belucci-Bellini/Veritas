import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Action = "analyze" | "optimize";
type CircuitNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  label?: string;
  options?: { value?: boolean; initial?: boolean };
};
type Connection = {
  source: { node: string; port?: number };
  target: { node: string; port: number };
};
type CircuitDocument = {
  format: "veritas-circuit";
  version: 1;
  name: string;
  nodes: CircuitNode[];
  connections: Connection[];
};
type CircuitContext = {
  circuitName: string;
  summary: string;
  payload: { document: CircuitDocument };
};

type AiResult = {
  action: Action;
  provider: "llm" | "heuristic";
  summary: string;
  suggestions: string[];
  optimizedDocument: CircuitDocument | null;
  confidence: number;
};

const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    suggestions: { type: "array", items: { type: "string" } },
    optimizedDocumentJson: { anyOf: [{ type: "string" }, { type: "null" }] },
    confidence: { type: "number" },
  },
  required: ["summary", "suggestions", "optimizedDocumentJson", "confidence"],
  additionalProperties: false,
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const body = await request.json() as { action?: Action; context?: CircuitContext };
    if (body.action !== "analyze" && body.action !== "optimize") {
      return json({ error: "Ação inválida." }, 400);
    }
    if (!isContext(body.context)) return json({ error: "Contexto de circuito inválido." }, 400);
    if (JSON.stringify(body.context).length > 200_000) {
      return json({ error: "O contexto do circuito excede o limite permitido." }, 413);
    }

    const llmResult = await tryLlm(body.action, body.context);
    return json(llmResult ?? heuristic(body.action, body.context));
  } catch (error) {
    console.error(error);
    return json({ error: "Não foi possível analisar o circuito." }, 500);
  }
});

async function tryLlm(action: Action, context: CircuitContext): Promise<AiResult | null> {
  const providerUrl = Deno.env.get("AI_PROVIDER_URL");
  const providerKey = Deno.env.get("AI_PROVIDER_KEY");
  if (!providerUrl || !providerKey) return null;

  const model = Deno.env.get("AI_MODEL") || "gpt-5-mini";
  const prompt = action === "optimize"
    ? "Analise o circuito e proponha uma versão otimizada. Só remova componentes inalcançáveis ou faça transformações que preservem rigorosamente a função das saídas. Se não puder garantir equivalência, retorne optimizedDocument como null."
    : "Analise o circuito visual, explique sua função e indique oportunidades seguras de simplificação. Não invente componentes nem conexões.";

  const response = await fetch(providerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Você é um especialista em lógica digital. Responda apenas JSON válido conforme o schema." },
        { role: "user", content: `${prompt}\n\nContexto:\n${JSON.stringify(context)}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "circuit_analysis", strict: true, schema } },
      max_completion_tokens: 1200,
    }),
  });
  if (!response.ok) {
    console.error("AI provider returned", response.status);
    return null;
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as Partial<AiResult>;
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.suggestions) || typeof parsed.confidence !== "number") return null;
    return {
      action,
      provider: "llm",
      summary: parsed.summary,
      suggestions: parsed.suggestions.filter((item): item is string => typeof item === "string").slice(0, 8),
      optimizedDocument: parseDocumentJson(parsed.optimizedDocumentJson),
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
    };
  } catch {
    return null;
  }
}

function parseDocumentJson(value: unknown): CircuitDocument | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isDocument(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function heuristic(action: Action, context: CircuitContext): AiResult {
  const document = context.payload.document;
  const outputs = document.nodes.filter((node) => node.type === "output");
  const reachable = new Set<string>();
  const incoming = new Map<string, string[]>();
  for (const connection of document.connections) {
    const sources = incoming.get(connection.target.node) ?? [];
    sources.push(connection.source.node);
    incoming.set(connection.target.node, sources);
  }
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const source of incoming.get(id) ?? []) visit(source);
  };
  outputs.forEach((node) => visit(node.id));
  const removed = document.nodes.filter((node) => !reachable.has(node.id));
  const optimizedDocument = removed.length > 0
    ? { ...document, nodes: document.nodes.filter((node) => reachable.has(node.id)), connections: document.connections.filter((connection) => reachable.has(connection.source.node) && reachable.has(connection.target.node)) }
    : null;

  return {
    action,
    provider: "heuristic",
    summary: `${context.circuitName}: ${document.nodes.length} componentes, ${document.connections.length} conexões e ${outputs.length} saída(s).`,
    suggestions: removed.length > 0
      ? [`${removed.length} componente(s) não alimentam nenhuma saída e podem ser removidos com segurança.`]
      : ["Todas as portas alcançam alguma saída; não há remoção estrutural segura automática."],
    optimizedDocument: action === "optimize" ? optimizedDocument : null,
    confidence: 0.72,
  };
}

function isContext(value: unknown): value is CircuitContext {
  if (!isRecord(value) || typeof value.circuitName !== "string" || !isRecord(value.payload)) return false;
  return isDocument(value.payload.document);
}

function isDocument(value: unknown): value is CircuitDocument {
  if (!isRecord(value) || value.format !== "veritas-circuit" || value.version !== 1 || typeof value.name !== "string") return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.connections)) return false;
  return value.nodes.every((node) => isRecord(node) && typeof node.id === "string" && typeof node.type === "string" && isRecord(node.position) && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) && value.connections.every((connection) => isRecord(connection) && isRecord(connection.source) && isRecord(connection.target) && typeof connection.source.node === "string" && typeof connection.target.node === "string" && Number.isInteger(connection.target.port));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
