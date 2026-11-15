import type { Clause } from "../lib/contract.ts";

export type ExpectedFinding = {
  category: Clause["category"];
  quote?: string;
  level?: Clause["level"];
  match_any?: string[];
};

export type Answer = {
  should_flag: ExpectedFinding[];
  should_not_flag: ExpectedFinding[];
};

export type RunResult = {
  clauses: Clause[];
};

export function scoreRun(
  source: string,
  clauses: Clause[],
  answer: Answer,
  legalIds: Set<string>,
) {
  const flagged = clauses.filter((clause) => clause.level !== "STANDARD");
  const expectedMatches = matchExpected(flagged, answer.should_flag);
  const notExpectedMatches = matchExpected(flagged, answer.should_not_flag);
  const quoteClauses = flagged.filter((clause) => clause.quote !== null);
  const validQuotes = quoteClauses.filter((clause) =>
    normalize(source).includes(normalize(clause.quote ?? "")),
  ).length;
  const citations = flagged.flatMap((clause) => clause.legal_reference_ids);
  const validCitations = citations.filter((id) => legalIds.has(id)).length;

  return {
    recall: ratio(expectedMatches, answer.should_flag.length),
    precision: ratio(expectedMatches, flagged.length),
    false_positive_rate: ratio(notExpectedMatches, answer.should_not_flag.length),
    quote_accuracy: ratio(validQuotes, quoteClauses.length),
    citation_validity: ratio(validCitations, citations.length),
    findings_matched: expectedMatches,
    findings_expected: answer.should_flag.length,
    findings_flagged: flagged.length,
  };
}

export function calculateMetrics(
  source: string,
  runs: { result: RunResult; latencyMs: number }[],
  answer: Answer,
  legalIds: Set<string>,
) {
  const runScores = runs.map(({ result }) => scoreRun(source, result.clauses, answer, legalIds));
  const keysByRun = runs.map(({ result }) =>
    result.clauses
      .filter((clause) => clause.level !== "STANDARD")
      .map((clause) => findingKey(clause, answer))
      .sort(),
  );
  const baseline = JSON.stringify(keysByRun[0] ?? []);
  const variedRuns = keysByRun.slice(1).filter((keys) => JSON.stringify(keys) !== baseline).length;

  return {
    recall: average(runScores.map((score) => score.recall)),
    precision: average(runScores.map((score) => score.precision)),
    false_positive_rate: average(runScores.map((score) => score.false_positive_rate)),
    quote_accuracy: average(runScores.map((score) => score.quote_accuracy)),
    citation_validity: average(runScores.map((score) => score.citation_validity)),
    variance: ratio(variedRuns, Math.max(runs.length - 1, 1)),
    average_latency_ms: Math.round(runs.reduce((total, run) => total + run.latencyMs, 0) / Math.max(runs.length, 1)),
    average_findings_matched: average(runScores.map((score) => score.findings_matched)),
    findings_expected: answer.should_flag.length,
  };
}

function matchExpected(clauses: Clause[], expected: ExpectedFinding[]): number {
  const matched = new Set<number>();
  for (const clause of clauses) {
    const index = expected.findIndex((finding, findingIndex) =>
      !matched.has(findingIndex) && matchesFinding(clause, finding),
    );
    if (index >= 0) matched.add(index);
  }
  return matched.size;
}

function matchesFinding(clause: Clause, expected: ExpectedFinding): boolean {
  if (clause.category !== expected.category) return false;
  if (expected.level && clause.level !== expected.level) return false;

  if (expected.quote) {
    if (!clause.quote) return false;
    const expectedQuote = normalize(expected.quote);
    const actualQuote = normalize(clause.quote);
    return expectedQuote.includes(actualQuote) || actualQuote.includes(expectedQuote);
  }

  if (clause.quote !== null || !expected.match_any?.length) return false;
  const generatedText = normalize([
    clause.plain_english,
    clause.why_flagged,
    clause.question_for_landlord,
  ].join(" "));
  return expected.match_any.some((term) => generatedText.includes(normalize(term)));
}

function findingKey(clause: Clause, answer: Answer): string {
  if (clause.quote) return `${clause.category}|${normalize(clause.quote)}`;
  const expected = [...answer.should_flag, ...answer.should_not_flag].find((finding) =>
    matchesFinding(clause, finding),
  );
  if (expected?.match_any) {
    return `${clause.category}|${clause.level}|missing:${expected.match_any.map(normalize).sort().join("|")}`;
  }
  return `${clause.category}|${clause.level}|${normalize(clause.plain_english)}`;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(3));
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (!present.length) return null;
  return Number((present.reduce((total, value) => total + value, 0) / present.length).toFixed(3));
}
