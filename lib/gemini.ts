import { GoogleGenAI } from "@google/genai";
import { SERVER_LIMITS } from "@/lib/limits";

export class GeminiRequestError extends Error {
  constructor(readonly status: number | undefined) {
    super("Gemini request failed");
  }
}

export async function generateJson(
  prompt: string,
  model: string,
  schema: unknown,
  timeoutMs: number = SERVER_LIMITS.modelTimeoutMs,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiRequestError(undefined);

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        temperature: 0.1,
        maxOutputTokens: SERVER_LIMITS.maxOutputTokens,
        httpOptions: { timeout: timeoutMs },
        abortSignal: AbortSignal.timeout(timeoutMs),
      },
    });
    return response.text ?? "";
  } catch (error) {
    throw new GeminiRequestError(getStatus(error));
  }
}

function getStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const status = Reflect.get(error, "status");
  if (typeof status === "number") return status;
  const code = Reflect.get(error, "code");
  return typeof code === "number" ? code : undefined;
}
