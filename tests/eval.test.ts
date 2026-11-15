import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import type { Clause } from "../lib/contract.ts";
import { calculateMetrics, scoreRun, type Answer } from "../eval/scoring.ts";

const source = [
  "A late fee of $50 is due after the 5th day of the month.",
  "The landlord may enter only for a purpose allowed by law.",
].join("\n");

function clause(overrides: Partial<Clause> = {}): Clause {
  return {
    id: "model-generated-id",
    level: "WORTH_ASKING",
    category: "FEES",
    quote: "A late fee of $50 is due after the 5th day of the month.",
    plain_english: "The lease sets a late fee.",
    legal_reference_ids: ["L6"],
    why_flagged: "The timing may be worth checking.",
    confidence: "LOW",
    question_for_landlord: "Could you confirm the timing?",
    ma_statute_citation: [],
    ...overrides,
  };
}

const answer: Answer = {
  should_flag: [{
    category: "FEES",
    quote: "A late fee of $50 is due after the 5th day of the month.",
  }],
  should_not_flag: [{
    category: "ENTRY",
    quote: "The landlord may enter only for a purpose allowed by law.",
  }],
};

test("scores findings by category and quoted lease text, not model-generated IDs", () => {
  const score = scoreRun(
    source,
    [clause({ id: "entirely-different-generated-id" })],
    answer,
    new Set(["L6"]),
  );

  assert.equal(score.recall, 1);
  assert.equal(score.precision, 1);
  assert.equal(score.findings_matched, 1);
});

test("does not match the wrong category or count one clause for multiple expected findings", () => {
  const score = scoreRun(
    source,
    [clause({ category: "ENTRY" })],
    {
      should_flag: [
        { category: "FEES", quote: "A late fee of $50 is due after the 5th day of the month." },
        { category: "FEES", quote: "A late fee of $50 is due after the 5th day of the month." },
      ],
      should_not_flag: [],
    },
    new Set(["L6"]),
  );

  assert.equal(score.findings_matched, 0);
  assert.equal(score.recall, 0);
  assert.equal(score.precision, 0);
});

test("matches explicitly labeled missing findings using category, level, and issue wording", () => {
  const missing = clause({
    id: "unstable-id",
    level: "POSSIBLY_MISSING",
    category: "SECURITY_DEPOSIT",
    quote: null,
    plain_english: "The lease may not include a statement of condition for the deposit.",
    legal_reference_ids: [],
    question_for_landlord: "Could you provide the condition statement?",
  });
  const score = scoreRun(
    "A fictional lease with no deposit condition statement.",
    [missing],
    {
      should_flag: [{
        category: "SECURITY_DEPOSIT",
        level: "POSSIBLY_MISSING",
        match_any: ["statement of condition", "condition report"],
      }],
      should_not_flag: [],
    },
    new Set(),
  );

  assert.equal(score.findings_matched, 1);
  assert.equal(score.recall, 1);
});

test("variance compares semantic finding keys rather than generated IDs", () => {
  const metrics = calculateMetrics(
    source,
    [
      { result: { clauses: [clause({ id: "first-id" })] }, latencyMs: 100 },
      { result: { clauses: [clause({ id: "second-id" })] }, latencyMs: 200 },
      { result: { clauses: [clause({ id: "third-id" })] }, latencyMs: 300 },
    ],
    answer,
    new Set(["L6"]),
  );

  assert.equal(metrics.variance, 0);
  assert.equal(metrics.recall, 1);
  assert.equal(metrics.average_latency_ms, 200);
});

test("variance treats differently worded versions of the same missing issue as one finding", () => {
  const answerWithMissing: Answer = {
    should_flag: [{
      category: "SECURITY_DEPOSIT",
      level: "POSSIBLY_MISSING",
      match_any: ["statement of condition", "condition report"],
    }],
    should_not_flag: [],
  };
  const first = clause({
    level: "POSSIBLY_MISSING",
    category: "SECURITY_DEPOSIT",
    quote: null,
    plain_english: "The lease may omit a statement of condition for the deposit.",
  });
  const second = clause({
    level: "POSSIBLY_MISSING",
    category: "SECURITY_DEPOSIT",
    quote: null,
    plain_english: "A deposit condition report may not be included.",
  });
  const metrics = calculateMetrics(
    source,
    [
      { result: { clauses: [first] }, latencyMs: 100 },
      { result: { clauses: [second] }, latencyMs: 100 },
    ],
    answerWithMissing,
    new Set(),
  );

  assert.equal(metrics.variance, 0);
  assert.equal(metrics.recall, 1);
});

test("quoted evaluation labels exist in their fictional source leases", async () => {
  const answers = JSON.parse(
    await readFile(join(process.cwd(), "eval", "answers.json"), "utf8"),
  ) as Record<string, Answer>;
  const sources: Record<string, string> = {
    "demo-lease": await readFile(join(process.cwd(), "public", "samples", "demo-lease.txt"), "utf8"),
    clean: await readFile(join(process.cwd(), "eval", "leases", "clean.txt"), "utf8"),
    injection: await readFile(join(process.cwd(), "eval", "leases", "injection.txt"), "utf8"),
  };

  for (const [leaseId, answer] of Object.entries(answers)) {
    const source = sources[leaseId];
    assert.ok(source, `${leaseId} has a source lease`);
    for (const finding of [...answer.should_flag, ...answer.should_not_flag]) {
      if (finding.quote) {
        assert.ok(source.includes(finding.quote), `${leaseId} contains the labeled quote: ${finding.quote}`);
      }
    }
  }
});

test("evaluation diagnostics report missed and false-positive labels without clause text", () => {
  const expectedAnswer: Answer = {
    should_flag: [
      { label: "late-fee", category: "FEES", quote: "A late fee of $50 is due after the 5th day of the month." },
      { label: "deposit-fee", category: "SECURITY_DEPOSIT", quote: "The security deposit is one month's rent." },
    ],
    should_not_flag: [
      { label: "lawful-entry", category: "ENTRY", quote: "The landlord may enter only for a purpose allowed by law." },
    ],
  };
  const diagnosticSource = [
    source,
    "The security deposit is one month's rent.",
    "Another clause in the fictional lease.",
  ].join("\n");
  const report = calculateMetrics(
    diagnosticSource,
    [{
      result: {
        clauses: [
          clause({ id: "new-model-id" }),
          clause({
            id: "entry-flag",
            category: "ENTRY",
            quote: "The landlord may enter only for a purpose allowed by law.",
          }),
          clause({ id: "other-flag", category: "OTHER", quote: "Another clause in the fictional lease." }),
        ],
      },
      latencyMs: 100,
    }],
    expectedAnswer,
    new Set(["L6"]),
  );
  const serialized = JSON.stringify(report);

  assert.deepEqual(report.expected_findings, [
    { label: "late-fee", matched_runs: 1, total_runs: 1 },
    { label: "deposit-fee", matched_runs: 0, total_runs: 1 },
  ]);
  assert.deepEqual(report.expected_clean_clause_flags, [
    { label: "lawful-entry", flagged_runs: 1, total_runs: 1 },
  ]);
  assert.deepEqual(report.unclassified_flags_by_category, [{ category: "OTHER", count: 1 }]);
  assert.equal(serialized.includes("Another clause in the fictional lease."), false);
  assert.equal(serialized.includes("A late fee of $50"), false);
});
