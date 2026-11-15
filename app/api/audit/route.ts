import { AuditRequestSchema, type AuditRequest } from "@/lib/contract";
import { handleJsonPost, requestFault } from "@/lib/apiServer";
import { runAudit } from "@/lib/audit";
import { SERVER_LIMITS } from "@/lib/limits";

export const maxDuration = 60;

function parseAuditRequest(value: unknown): AuditRequest {
  if (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    typeof value.text === "string" &&
    value.text.length > SERVER_LIMITS.maxTextChars
  ) {
    throw requestFault("TOO_LARGE");
  }
  const parsed = AuditRequestSchema.safeParse(value);
  if (!parsed.success) throw requestFault("BAD_REQUEST");
  return parsed.data;
}

export async function POST(request: Request): Promise<Response> {
  return handleJsonPost(request, "audit", parseAuditRequest, runAudit);
}
