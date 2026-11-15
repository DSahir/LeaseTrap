import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalEmail, MARKET_NOTE } from "../lib/emailClient.ts";
import { levelDescription } from "../lib/display.ts";

const forbidden = /\b(illegal|void|unenforceable)\b/i;

test("draft stays hedged and keeps placeholders", () => {
  const draft = buildLocalEmail({
    tone: "direct",
    clauses: [
      {
        category: "FEES",
        plain_english: "The sample charges a late fee after the 5th.",
        question_for_landlord: "Could you confirm when a late fee can start?",
        citations: ["MOCK"],
      },
    ],
  });
  assert.match(draft.body, /\[LANDLORD\]/);
  assert.match(draft.body, /\[TENANT_1\]/);
  assert.match(draft.body, /competitive/);
  assert.equal(forbidden.test(draft.body), false);
  assert.equal(forbidden.test(draft.subject), false);
  assert.equal(forbidden.test(MARKET_NOTE), false);
  assert.equal(forbidden.test(levelDescription("HIGH")), false);
  assert.doesNotMatch(draft.body, /MOCK/);
});
