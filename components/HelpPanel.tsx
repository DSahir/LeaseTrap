import { HELP_LINKS } from "@/content/help";

export function HelpPanel({ townMessage }: { townMessage: string }) {
  return (
    <section aria-labelledby="help-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 id="help-heading" className="text-lg font-semibold text-slate-900">
        Free help
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        These sites explain tenant information and where to ask for free or low-cost help. This app cannot tell you what to do in a dispute.
      </p>
      <p className="mt-2 text-sm text-slate-700">{townMessage}</p>
      <ul className="mt-3 space-y-3">
        {HELP_LINKS.map((link) => (
          <li key={link.href}>
            <a className="font-medium text-slate-900 underline" href={link.href} target="_blank" rel="noreferrer">
              {link.title}
            </a>
            <p className="text-sm text-slate-700">{link.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
