import { EmailRequestSchema, type EmailRequest } from "@/lib/contract";
import { handleJsonPost, requestFault } from "@/lib/apiServer";
import { draftEmail } from "@/lib/emailDraft";

export const maxDuration = 60;

function parseEmailRequest(value: unknown): EmailRequest {
  const parsed = EmailRequestSchema.safeParse(value);
  if (!parsed.success) throw requestFault("BAD_REQUEST");
  return parsed.data;
}

export async function POST(request: Request): Promise<Response> {
  return handleJsonPost(request, "email", parseEmailRequest, draftEmail);
}
