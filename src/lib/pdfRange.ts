import { PDFDocument } from "pdf-lib";
import { describePages } from "@/lib/pageRange";

/**
 * Builds a new PDF holding only the chosen pages (1-based, in the given order), in the browser.
 * The shop receives a file that is already trimmed, so printing and the page count/price always agree.
 */
export async function extractPages(file: File, pages: number[]): Promise<File> {
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pages.map((p) => p - 1));
  copied.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  const base = file.name.replace(/\.pdf$/i, "");
  return new File([bytes as BlobPart], `${base} (pages ${describePages(pages)}).pdf`, { type: "application/pdf" });
}
