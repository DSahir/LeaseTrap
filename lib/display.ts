import type { Category, Clause, Level } from "@/lib/contract";

const LEVEL_RANK: Record<Level, number> = {
  HIGH: 0,
  WORTH_ASKING: 1,
  STANDARD: 2,
  POSSIBLY_MISSING: 3,
};

const LEVEL_COPY: Record<Level, { badge: string; description: string }> = {
  HIGH: {
    badge: "High concern",
    description: "May need a closer look. Confirm before you sign.",
  },
  WORTH_ASKING: {
    badge: "Worth asking about",
    description: "Uncommon or one-sided. A fair question to ask.",
  },
  STANDARD: {
    badge: "Looks typical",
    description: "Often seen in leases.",
  },
  POSSIBLY_MISSING: {
    badge: "Possibly missing",
    description: "We did not find an item people often expect.",
  },
};

const CATEGORY_LABELS: Record<Category, string> = {
  SECURITY_DEPOSIT: "Security deposit",
  FEES: "Fees",
  ENTRY: "Entry",
  REPAIRS: "Repairs",
  RENEWAL: "Renewal",
  LIABILITY: "Liability",
  SUBLETTING: "Subletting",
  DISCLOSURES: "Disclosures",
  OTHER: "Other",
};

export function levelBadge(level: Level): string {
  return LEVEL_COPY[level].badge;
}

export function levelDescription(level: Level): string {
  return LEVEL_COPY[level].description;
}

export function categoryLabel(category: Category): string {
  return CATEGORY_LABELS[category];
}

export function sortClauses(clauses: Clause[]): Clause[] {
  return clauses
    .map((clause, index) => ({ clause, index }))
    .sort((a, b) => LEVEL_RANK[a.clause.level] - LEVEL_RANK[b.clause.level] || a.index - b.index)
    .map((item) => item.clause);
}

export function formatVerifiedDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
