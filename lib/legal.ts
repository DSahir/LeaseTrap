import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { CitationSchema } from "@/lib/contract";

const CitationListSchema = z.array(CitationSchema);
const TownSlugsSchema = z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));

export type LegalCitation = z.infer<typeof CitationSchema>;

export async function loadLegalContext(municipality: string): Promise<{
  pack: string;
  citations: LegalCitation[];
  legalLastVerified: string;
  localRules: string;
}> {
  const legalDir = join(process.cwd(), "legal");
  const [pack, rawCitations, rawMeta, localRules] = await Promise.all([
    readFile(join(legalDir, "ma_tenant_law.md"), "utf8"),
    readFile(join(legalDir, "refs.json"), "utf8"),
    readFile(join(legalDir, "meta.json"), "utf8"),
    readLocalRules(legalDir, municipality),
  ]);
  const citations = CitationListSchema.parse(JSON.parse(rawCitations) as unknown);
  const meta = z.object({ legal_last_verified: z.iso.date() }).parse(JSON.parse(rawMeta) as unknown);
  return { pack, citations, legalLastVerified: meta.legal_last_verified, localRules };
}

async function readLocalRules(legalDir: string, municipality: string): Promise<string> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(municipality)) return "";
  const rawLoadedTowns = await readFile(join(process.cwd(), "public", "legal", "loaded-towns.json"), "utf8");
  const loadedTowns = TownSlugsSchema.parse(JSON.parse(rawLoadedTowns) as unknown);
  if (!loadedTowns.includes(municipality)) return "";
  return readFile(join(legalDir, "towns", `${municipality}.md`), "utf8");
}
