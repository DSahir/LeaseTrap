import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronDown, CircleHelp } from "lucide-react";
import type { Clause } from "@/lib/contract";
import { categoryLabel, levelBadge, levelDescription } from "@/lib/display";
import { quoteStatus } from "@/lib/verifyQuotes";

const ICONS = {
  HIGH: AlertOctagon,
  WORTH_ASKING: AlertTriangle,
  STANDARD: CheckCircle2,
  POSSIBLY_MISSING: CircleHelp,
} as const;

export function ClauseCard({
  clause,
  quoteBasis,
  expanded,
  selected,
  canSelect,
  onToggle,
  onSelect,
}: {
  clause: Clause;
  quoteBasis: string;
  expanded: boolean;
  selected: boolean;
  canSelect: boolean;
  onToggle: () => void;
  onSelect: (selected: boolean) => void;
}) {
  const Icon = ICONS[clause.level];
  const status = quoteStatus(clause.quote, quoteBasis);
  const panelId = `clause-panel-${clause.id}`;
  const eligible = clause.level === "HIGH" || clause.level === "WORTH_ASKING";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{levelBadge(clause.level)}</span>
          </p>
          <p className="mt-1 text-sm text-slate-700">{levelDescription(clause.level)}</p>
          <p className="mt-2 text-sm text-slate-800">{categoryLabel(clause.category)}</p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-900"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
        >
          {expanded ? "Hide details" : "Show details"}
          <ChevronDown aria-hidden="true" className={`size-4 ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>
      {eligible ? (
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-slate-900">
          <input
            type="checkbox"
            checked={selected}
            disabled={!selected && !canSelect}
            onChange={(event) => onSelect(event.target.checked)}
          />
          Include in email
        </label>
      ) : null}
      {expanded ? (
        <div id={panelId} className="mt-4 space-y-3 text-sm leading-6 text-slate-800">
          {clause.quote ? (
            <blockquote className="max-h-48 overflow-auto border-l-4 border-slate-300 pl-3 break-words">
              {clause.quote}
            </blockquote>
          ) : (
            <p>No quote was provided for this item.</p>
          )}
          <p>
            {status === "verified" && "Quote matches the text we checked."}
            {status === "unverified" && "Quote was not found in the text we checked. Treat it with caution."}
            {status === "none" && "No quote to check."}
          </p>
          <p>{clause.plain_english}</p>
          <p>{clause.why_flagged}</p>
          <p>Confidence: {clause.confidence === "HIGH" ? "High" : clause.confidence === "MEDIUM" ? "Medium" : "Low"}</p>
          <p>Question you could ask: {clause.question_for_landlord}</p>
          {clause.ma_statute_citation.length > 0 ? (
            <ul className="space-y-2">
              {clause.ma_statute_citation.map((citation) => (
                <li key={`${citation.id}-${citation.url}`}>
                  <a className="font-medium text-slate-900 underline break-all" href={citation.url}>
                    {citation.citation === "MOCK" ? "Practice link (not a legal citation)" : citation.citation}
                  </a>
                  <span className="block text-slate-700">{citation.title}</span>
                  {citation.scope_note ? <span className="block text-slate-700">{citation.scope_note}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>No matching reference was attached.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
