import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuditRequest, EmailRequest } from "@/lib/contract";
import type { LegalCitation } from "@/lib/legal";

export const AUDIT_PROMPT_VERSION = "v3";

export async function buildAuditPrompt(
  input: AuditRequest,
  legalPack: string,
  localRules: string,
): Promise<string> {
  const prompt = await readFile(join(process.cwd(), "prompts", `${AUDIT_PROMPT_VERSION}.md`), "utf8");
  const lease = input.text.replace(/<\/?lease>/gi, "[LEASE_TAG_REMOVED]");
  return [
    prompt.trim(),
    `<context>\nMunicipality: ${input.municipality}\nTenancy type: ${input.tenancyType ?? "not specified"}\n</context>`,
    `<legal_pack>\n${legalPack}\n</legal_pack>`,
    localRules ? `<local_rules>\n${localRules}\n</local_rules>` : "<local_rules>None loaded.</local_rules>",
    `<lease>\n${lease}\n</lease>`,
  ].join("\n\n");
}

export async function buildEmailPrompt(input: EmailRequest, citations: LegalCitation[]): Promise<string> {
  const prompt = await readFile(join(process.cwd(), "prompts", "email-v1.md"), "utf8");
  const allowedCitations = new Set(citations.map((citation) => citation.citation));
  const clauses = input.clauses.map((clause) => ({
    category: clause.category,
    plain_english: neutralizeEmailTags(clause.plain_english),
    question_for_landlord: neutralizeEmailTags(clause.question_for_landlord),
    citations: clause.citations.filter((citation) => allowedCitations.has(citation)),
  }));
  return [
    prompt.trim(),
    `<selected_clauses>\n${JSON.stringify(clauses)}\n</selected_clauses>`,
    `<tone>\n${input.tone}\n</tone>`,
    `<optional_notes>\n${neutralizeEmailTags(input.notes ?? "")}\n</optional_notes>`,
  ].join("\n\n");
}

function neutralizeEmailTags(value: string): string {
  return value.replace(/<\/?(?:selected_clauses|tone|optional_notes)>/gi, "[PROMPT_TAG_REMOVED]");
}
