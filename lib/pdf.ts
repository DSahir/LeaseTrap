import { FRIENDLY_ERRORS } from "@/lib/config";

let workerReady = false;

/** Read text in the browser. The file itself is never uploaded. */
export async function extractPdfText(data: ArrayBuffer): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error(FRIENDLY_ERRORS.PDF);
  }
  const pdfjs = await import("pdfjs-dist");
  if (!workerReady) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerReady = true;
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const parts = content.items.flatMap((item) =>
        "str" in item && typeof item.str === "string" ? [item.str] : [],
      );
      pages.push(parts.join(" "));
    }
    return pages.join("\n\n").replace(/[ \t]+\n/g, "\n").trim();
  } finally {
    await task.destroy();
  }
}
