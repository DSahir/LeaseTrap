import { categoryLabel } from "@/lib/display";
import type { Clause, EmailRequest, EmailResponse } from "@/lib/contract";
import { restorePlaceholders } from "@/lib/restore";
import { nameVariants, scrubText, type KnownNames } from "@/lib/scrub";

export const MARKET_NOTE =
  "Rentals can be competitive. A landlord may keep the lease as written. This draft only asks polite questions. It does not make a demand or predict what will happen.";

export function toEmailClause(clause: Clause): EmailRequest["clauses"][number] {
  return {
    category: clause.category,
    plain_english: clause.plain_english,
    question_for_landlord: clause.question_for_landlord,
    citations: clause.ma_statute_citation.map((citation) => citation.citation),
  };
}

export function sanitizeEmailRequest(
  input: EmailRequest,
  placeholderMap: Record<string, string>,
): EmailRequest {
  const names: KnownNames = {
    tenants: [],
    roommates: [],
    guarantors: [],
    landlord: "",
    manager: "",
    propertyAddress: "",
  };
  const originals = Object.entries(placeholderMap)
    .filter(([, original]) => original.trim().length >= 2)
    .sort((left, right) => right[1].length - left[1].length);
  for (const [placeholder, original] of originals) {
    const variants = placeholder.startsWith("[TENANT_")
      ? names.tenants
      : placeholder.startsWith("[ROOMMATE_")
        ? names.roommates
        : placeholder.startsWith("[GUARANTOR_")
          ? names.guarantors
          : null;
    if (variants) variants.push(...nameVariants(original));
    else if (placeholder === "[LANDLORD]") names.landlord = original;
    else if (placeholder === "[MANAGER]") names.manager = original;
    else if (placeholder === "[PROPERTY_ADDRESS]") names.propertyAddress = original;
  }
  const sanitize = (value: string) => {
    let text = value;
    for (const [placeholder, original] of originals) {
      const pattern = original.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
      text = text.replace(new RegExp(`(?<![A-Za-z0-9])${pattern}(?![A-Za-z0-9])`, "gi"), placeholder);
    }
    return scrubText(text, names).text;
  };

  return {
    ...input,
    clauses: input.clauses.map((clause) => ({
      ...clause,
      plain_english: sanitize(clause.plain_english),
      question_for_landlord: sanitize(clause.question_for_landlord),
    })),
    ...(input.notes === undefined ? {} : { notes: sanitize(input.notes) }),
  };
}

/** Local draft used for practice mode and when the email service is unavailable. */
export function buildLocalEmail(input: EmailRequest): EmailResponse {
  const opening =
    input.tone === "direct"
      ? "I read the lease and want a few points confirmed or rewritten before I sign. What follows is my understanding, not a legal conclusion."
      : "Could we walk through a few clauses together before I sign? I want to understand them. I am not asking you to treat this note as a legal opinion.";

  const items = input.clauses.map((clause, index) => {
    const cites = clause.citations.filter((citation) => citation && citation !== "MOCK");
    const reference = cites.length > 0 ? cites.join("; ") : "No statute citation was attached to this item.";
    return [
      `${index + 1}. ${categoryLabel(clause.category)}`,
      `My understanding is: ${clause.plain_english}`,
      `Could you confirm: ${clause.question_for_landlord}`,
      `Reference shown to me: ${reference}`,
    ].join("\n");
  });

  const note = input.notes?.trim() ? `\nNote I added: ${input.notes.trim()}\n` : "";
  const body = [
    "Dear [LANDLORD],",
    "",
    opening,
    "",
    "I know apartments in this area can be competitive. I am asking so the written lease is clear before I sign.",
    "",
    ...items.flatMap((item) => [item, ""]),
    note.trimEnd(),
    "Thank you for reading this.",
    "[TENANT_1]",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .trim();

  return {
    subject: "Questions about the lease before I sign",
    body,
  };
}

export function emailForClipboard(
  draft: EmailResponse,
  map: Record<string, string>,
  restore: boolean,
): string {
  const combined = `Subject: ${draft.subject}\n\n${draft.body}`;
  if (!restore) return combined;
  return restorePlaceholders(combined, map);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
