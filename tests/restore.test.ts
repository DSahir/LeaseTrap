import assert from "node:assert/strict";
import test from "node:test";
import { restorePlaceholders } from "../lib/restore.ts";

test("restores longer placeholders before shorter ones", () => {
  const text = "Write to [LANDLORD] about [PROPERTY_ADDRESS] and [ADDRESS].";
  const restored = restorePlaceholders(text, {
    "[ADDRESS]": "1 Short St",
    "[PROPERTY_ADDRESS]": "18 Kellogg Avenue, Apt 3",
    "[LANDLORD]": "Maple and Mill Properties LLC",
  });
  assert.equal(
    restored,
    "Write to Maple and Mill Properties LLC about 18 Kellogg Avenue, Apt 3 and 1 Short St.",
  );
});
