import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { extractPages } from "@/lib/pdfRange";

async function makePdf(n: number): Promise<File> {
  const d = await PDFDocument.create();
  for (let i = 1; i <= n; i++) d.addPage([100 + i, 200]).drawText(`p${i}`);
  return new File([(await d.save()) as BlobPart], "notes.pdf", { type: "application/pdf" });
}

describe("extractPages", () => {
  it("keeps only the chosen pages, in order, and names the file after them", async () => {
    const out = await extractPages(await makePdf(6), [2, 3, 5]);
    expect(out.name).toBe("notes (pages 2-3, 5).pdf");
    expect(out.type).toBe("application/pdf");
    const doc = await PDFDocument.load(await out.arrayBuffer());
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPages().map((p) => p.getWidth())).toEqual([102, 103, 105]); // widths identify the source pages
  });
  it("can reorder pages", async () => {
    const doc = await PDFDocument.load(await (await extractPages(await makePdf(3), [3, 1])).arrayBuffer());
    expect(doc.getPages().map((p) => p.getWidth())).toEqual([103, 101]);
  });
});
