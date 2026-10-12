import Anthropic from "@anthropic-ai/sdk";

/**
 * Capa de IA multiproveedor (SOLO servidor — las claves nunca llegan al navegador).
 *
 * Proveedores soportados:
 *  - "ollama"    → IA local (gratis y privada; requiere Ollama corriendo)
 *  - "anthropic" → Claude API (nube; requiere ANTHROPIC_API_KEY)
 *  - "auto"      → intenta Ollama y, si no está, Claude; si nada, devuelve null
 *  - "none"      → sin IA (el asistente funciona con reglas básicas)
 *
 * Cada negocio puede fijar su proveedor en `businesses.ai` = { provider, model }.
 * Si la IA no responde, el llamador usa su red de seguridad (heurísticas).
 */

export interface AIConfig {
  provider?: "auto" | "ollama" | "anthropic" | "none";
  model?: string;
}

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3.5:9b";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

async function completeOllama(system: string, user: string, model?: string): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || OLLAMA_MODEL,
        stream: false,
        format: "json",
        options: { temperature: 0.2 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function completeAnthropic(system: string, user: string, model?: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: model || ANTHROPIC_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = response.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : null;
  } catch {
    return null;
  }
}

/**
 * Pide una respuesta JSON a la IA configurada. Devuelve el texto crudo
 * (el llamador lo parsea con red de seguridad) o null si no hay IA disponible.
 */
export async function aiComplete(
  system: string,
  user: string,
  config?: AIConfig | null,
): Promise<string | null> {
  const provider = config?.provider ?? "auto";
  const model = config?.model || undefined;

  if (provider === "none") return null;
  if (provider === "ollama") return completeOllama(system, user, model);
  if (provider === "anthropic") return completeAnthropic(system, user, model);
  // auto: local primero (privacidad y coste 0), nube como respaldo
  return (await completeOllama(system, user, model)) ?? (await completeAnthropic(system, user, model));
}

/** Extrae el primer objeto JSON válido de un texto de LLM (tolera ruido alrededor). */
export function extractJSON<T>(text: string | null): T | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
