import { FRIENDLY_ERRORS } from "@/lib/config";

const KNOWN_MESSAGES = new Set<string>(Object.values(FRIENDLY_ERRORS));

export function toFriendlyMessage(
  error: unknown,
  fallback: string = FRIENDLY_ERRORS.MODEL_FAILURE,
): string {
  if (error instanceof Error && KNOWN_MESSAGES.has(error.message)) {
    return error.message;
  }
  return fallback;
}
