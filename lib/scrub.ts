import { LIMITS } from "@/lib/config";

export type KnownNames = {
  tenants: string[];
  roommates: string[];
  guarantors: string[];
  landlord: string;
  manager: string;
  propertyAddress: string;
};

export type ScrubResult = {
  text: string;
  /** Placeholder to original. Keep this in memory and never send it. */
  map: Record<string, string>;
  warnings: string[];
};

const PHONE_SOURCE =
  String.raw`(?<![\d])(?:\+1[ \t.-]?)?(?:\(\d{3}\)|\d{3})[ \t.-]?\d{3}[ \t.-]?\d{4}(?![\d])`;
const EMAIL_SOURCE = String.raw`\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b`;
const SSN_SOURCE = String.raw`\b\d{3}[-\s]\d{2}[-\s]\d{4}\b`;
const DOB_SOURCE =
  String.raw`\b(?:DOB|D\.O\.B\.|date of birth|born)\b[ \t]*[:\-]?[ \t]*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|[A-Za-z]+[ \t]+\d{1,2},[ \t]+\d{4})`;
const LONG_NUMBER_SOURCE = String.raw`(?<![\d$])(?:\d[ \t-]?){9,}(?!\d)`;
const STREET_SOURCE =
  String.raw`\b\d{1,6}[ \t]+(?:[A-Za-z][A-Za-z0-9.'-]*[ \t]+){0,4}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Way|Walk|Boulevard|Blvd|Place|Pl|Court|Ct|Terrace|Ter)\.?(?:,?[ \t]*(?:Apt|Apartment|Unit|#)[ \t]*[A-Za-z0-9-]+)?`;
const ZIP_SOURCE = String.raw`\b(MA|Massachusetts)([ \t]+)(\d{5})(-\d{4})?\b`;

const COMPANY_MARK = /\b(LLC|L\.L\.C\.|Inc|Corp|Company|LP|LLP|Trust|Properties|Rentals)\b/i;

export function splitNameList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter((part) => part.length >= 2)
    .map((part) => part.slice(0, LIMITS.maxNameChars))
    .slice(0, 8);
}

export function scrubText(text: string, known: KnownNames): ScrubResult {
  const map: Record<string, string> = {};
  let current = text;
  current = applyKnownValues(current, known, map);
  current = replacePattern(current, new RegExp(EMAIL_SOURCE, "gi"), "[EMAIL]", map);
  current = replacePattern(current, new RegExp(PHONE_SOURCE, "gi"), "[PHONE]", map);
  current = replacePattern(current, new RegExp(SSN_SOURCE, "gi"), "[SSN]", map);
  current = replacePattern(current, new RegExp(DOB_SOURCE, "gi"), "[DOB]", map);
  current = replacePattern(current, new RegExp(LONG_NUMBER_SOURCE, "gi"), "[NUMBER]", map);
  current = replacePattern(current, new RegExp(STREET_SOURCE, "gi"), "[ADDRESS]", map);
  current = replaceZips(current, map);
  return { text: current, map, warnings: residualWarnings(current) };
}

function applyKnownValues(text: string, known: KnownNames, map: Record<string, string>): string {
  const needles: { pattern: string; token: string; canonical: string }[] = [];
  addPeople(needles, known.tenants, (index) => `[TENANT_${index}]`);
  addPeople(needles, known.roommates, (index) => `[ROOMMATE_${index}]`);
  addPeople(needles, known.guarantors, (index) => `[GUARANTOR_${index}]`);
  addLabeled(needles, known.manager, "[MANAGER]");
  addLabeled(needles, known.landlord, "[LANDLORD]");
  const address = known.propertyAddress.trim().replace(/\s+/g, " ").slice(0, LIMITS.maxAddressChars);
  if (address.length >= 5) {
    needles.push({ pattern: address, token: "[PROPERTY_ADDRESS]", canonical: address });
  }
  needles.sort((a, b) => b.pattern.length - a.pattern.length);
  let current = text;
  for (const needle of needles) {
    const applied = applyNeedle(current, needle.pattern, needle.token);
    current = applied.text;
    if (applied.matched) map[needle.token] ??= needle.canonical;
  }
  return current;
}

function addPeople(
  needles: { pattern: string; token: string; canonical: string }[],
  names: string[],
  tokenFor: (index: number) => string,
): void {
  names.forEach((name, index) => addLabeled(needles, name, tokenFor(index + 1)));
}

function addLabeled(
  needles: { pattern: string; token: string; canonical: string }[],
  name: string,
  token: string,
): void {
  const canonical = name.trim().replace(/\s+/g, " ").slice(0, LIMITS.maxNameChars);
  if (canonical.length < 2) return;
  const patterns = isLikelyPerson(canonical) ? nameVariants(canonical) : [canonical];
  for (const pattern of patterns) {
    needles.push({ pattern, token, canonical });
  }
}

function isLikelyPerson(name: string): boolean {
  if (COMPANY_MARK.test(name)) return false;
  const parts = name.split(" ");
  return parts.length >= 2 && parts.length <= 4 && parts.every((part) => /^[A-Za-z][A-Za-z.'-]*$/.test(part));
}

export function nameVariants(full: string): string[] {
  const cleaned = full.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(" ").filter(Boolean);
  const variants = new Set<string>();
  if (cleaned.length >= 2) variants.add(cleaned);
  if (parts.length >= 2) {
    const first = parts[0] ?? "";
    const last = parts[parts.length - 1] ?? "";
    variants.add(`${first} ${last}`);
    variants.add(`${last}, ${first}`);
    if (first[0]) {
      variants.add(`${first[0]}. ${last}`);
      variants.add(`${first[0]}. ${parts.slice(1).join(" ")}`);
    }
  }
  return [...variants].filter((variant) => variant.replace(/[^A-Za-z]/g, "").length >= 3);
}

function applyNeedle(text: string, needle: string, token: string): { text: string; matched: boolean } {
  const body = needle.trim().split(/\s+/).map(escapeRegExp).join("\\s+");
  if (body.length === 0) return { text, matched: false };
  const pattern = new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, "gi");
  let matched = false;
  const next = text.replace(pattern, () => {
    matched = true;
    return token;
  });
  return { text: next, matched };
}

function replacePattern(text: string, pattern: RegExp, token: string, map: Record<string, string>): string {
  const found = new Set<string>();
  const next = text.replace(pattern, (match) => {
    found.add(match.trim());
    return token;
  });
  if (found.size === 1) {
    const [only] = found;
    if (only) map[token] = only;
  }
  return next;
}

function replaceZips(text: string, map: Record<string, string>): string {
  const found = new Set<string>();
  const pattern = new RegExp(ZIP_SOURCE, "gi");
  const next = text.replace(pattern, (_full, state: string, space: string, zip: string, plus4?: string) => {
    found.add(plus4 ? `${zip}${plus4}` : zip);
    return `${state}${space}[ZIP]`;
  });
  if (found.size === 1) {
    const [only] = found;
    if (only) map["[ZIP]"] = only;
  }
  return next;
}

function residualWarnings(text: string): string[] {
  const warnings: string[] = [];
  if (new RegExp(PHONE_SOURCE, "i").test(text)) {
    warnings.push("A phone number may still be in the text. Check the preview before you send.");
  }
  if (text.includes("@")) {
    warnings.push("An email address may still be in the text. Check the preview before you send.");
  }
  if (new RegExp(SSN_SOURCE, "i").test(text) || new RegExp(LONG_NUMBER_SOURCE, "i").test(text)) {
    warnings.push("An ID or account number may still be in the text. Check the preview before you send.");
  }
  return warnings;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
