import type { AuditResponse } from "@/lib/contract";

export function isPracticeResult(result: AuditResponse): boolean {
  const citations = result.clauses.flatMap((clause) => clause.ma_statute_citation);
  return citations.length > 0 && citations.every((citation) => citation.id === "MOCK");
}
