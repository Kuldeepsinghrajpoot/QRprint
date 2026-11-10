// Copies pdf.js's worker next to the site so the page-preview popup can load it from /pdf.worker.min.mjs.
// Runs after `npm install`, which keeps the worker the same version as the pdfjs-dist package.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const from = "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
if (existsSync(from)) {
  mkdirSync("public", { recursive: true });
  copyFileSync(from, "public/pdf.worker.min.mjs");
}
