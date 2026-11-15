import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SAMPLE_LEASE_TEXT } from "../content/sampleLease.ts";

const MAX_BYTES = 3 * 1024 * 1024;
const LINES_PER_PAGE = 46;
const LINE_WIDTH = 90;

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapParagraph(paragraph: string): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > LINE_WIDTH && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function paginate(text: string): string[][] {
  const lines = text.split(/\n/).flatMap((paragraph) => {
    if (paragraph.trim().length === 0) return [""];
    return wrapParagraph(paragraph.trim());
  });
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += LINES_PER_PAGE) {
    pages.push(lines.slice(index, index + LINES_PER_PAGE));
  }
  return pages;
}

function contentStream(lines: string[]): string {
  const commands = ["BT", "/F1 11 Tf", "54 748 Td", "14 TL"];
  for (const line of lines) {
    commands.push(`(${pdfEscape(line)}) Tj`, "T*");
  }
  commands.push("ET");
  const stream = commands.join("\n");
  return `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
}

function buildPdf(pages: string[][]): Buffer {
  const bodies: string[] = [];
  bodies.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  bodies.push(`<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`);
  bodies.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((lines, index) => {
    const contentId = 5 + index * 2;
    bodies.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
    bodies.push(contentStream(lines));
  });

  let out = "%PDF-1.4\n";
  const offsets = [0];
  bodies.forEach((body, index) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${bodies.length + 1}\n`;
  out += "0000000000 65535 f \n";
  for (let index = 1; index <= bodies.length; index += 1) {
    out += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function main(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const target = join(root, "public", "samples", "sample-lease.pdf");
  const pdf = buildPdf(paginate(SAMPLE_LEASE_TEXT));
  if (pdf.length > MAX_BYTES) {
    throw new Error(`Sample PDF is ${pdf.length} bytes, over 3 MB.`);
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, pdf);
  process.stdout.write(`Wrote ${target} (${pdf.length} bytes, fictional sample)\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`Could not create sample PDF: ${String(error)}\n`);
  process.exitCode = 1;
});
