import { formatVerifiedDate } from "@/lib/display";

export function AppFooter({ verifiedDate, practice }: { verifiedDate?: string; practice?: boolean }) {
  const verified = practice
    ? "practice data only"
    : verifiedDate
      ? formatVerifiedDate(verifiedDate)
      : "shown with your results";
  return (
    <footer className="mt-12 border-t border-slate-200 py-6 text-sm text-slate-700">
      <p>Educational tool, not legal advice.</p>
      <p>Legal reference last verified: {verified}.</p>
    </footer>
  );
}
