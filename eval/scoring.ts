import type { Clause } from "../lib/contract.ts";

export type ExpectedFinding = {
  label?: string;
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
  const expectedMatchedIndices = matchExpectedIndices(flagged, answer.should_flag);
  const cleanCandidateIndices = flagged
    .map((_, index) => index)
    .filter((index) => !expectedMatchedIndices.has(index));
  const cleanCandidateMatches = matchExpectedIndices(
    cleanCandidateIndices.map((index) => flagged[index]!),
    answer.should_not_flag,
  );
  const cleanMatchedIndices = new Set(
    [...cleanCandidateMatches].map((candidateIndex) => cleanCandidateIndices[candidateIndex]!),
  );
  const expectedMatches = expectedMatchedIndices.size;
  const notExpectedMatches = cleanMatchedIndices.size;
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
    matched_expected_labels: labelsAt(answer.should_flag, expectedMatchedIndices),
    matched_clean_labels: labelsAt(answer.should_not_flag, cleanCandidateMatches),
    unclassified_flag_categories: flagged
      .filter((_, index) => !expectedMatchedIndices.has(index) && !cleanMatchedIndices.has(index))
      .map((clause) => clause.category),
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
  const expectedFindings = answer.should_flag.map((finding, findingIndex) => ({
    label: findingLabel(finding, findingIndex),
    matched_runs: runScores.filter((score) => score.matched_expected_labels.includes(findingLabel(finding, findingIndex))).length,
    total_runs: runs.length,
  }));
  const expectedCleanFindings = answer.should_not_flag.map((finding, findingIndex) => ({
    label: findingLabel(finding, findingIndex),
    flagged_runs: runScores.filter((score) => score.matched_clean_labels.includes(findingLabel(finding, findingIndex))).length,
    total_runs: runs.length,
  }));
  const unclassifiedFlagsByCategory = new Map<string, number>();
  for (const score of runScores) {
    for (const category of score.unclassified_flag_categories) {
      unclassifiedFlagsByCategory.set(category, (unclassifiedFlagsByCategory.get(category) ?? 0) + 1);
    }
  }

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
    expected_findings: expectedFindings,
    expected_clean_clause_flags: expectedCleanFindings,
    unclassified_flags_by_category: [...unclassifiedFlagsByCategory]
      .map(([category, count]) => ({ category, count })),
  };
}

function matchExpectedIndices(clauses: Clause[], expected: ExpectedFinding[]): Set<number> {
  const matched = new Set<number>();
  for (const clause of clauses) {
    const index = expected.findIndex((finding, findingIndex) =>
      !matched.has(findingIndex) && matchesFinding(clause, finding),
    );
    if (index >= 0) matched.add(index);
  }
  return matched;
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

function labelsAt(findings: ExpectedFinding[], indices: Set<number>): string[] {
  return [...indices].map((index) => findingLabel(findings[index]!, index));
}

function findingLabel(finding: ExpectedFinding, index: number): string {
  return finding.label ?? `${finding.category.toLocaleLowerCase()}-${index + 1}`;
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
