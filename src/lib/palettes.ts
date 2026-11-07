export const PALETTE_KEY = "qrprint_palette";

export const PALETTES = [
  { id: "ocean", label: "Ocean", color: "#0077B6" },
  { id: "navy", label: "Navy", color: "#1E3A8A" },
  { id: "green", label: "Green", color: "#059669" },
  { id: "orange", label: "Orange", color: "#EA580C" },
  { id: "purple", label: "Purple", color: "#7C3AED" },
  { id: "rose", label: "Rose", color: "#E11D48" },
  { id: "teal", label: "Teal", color: "#0D9488" },
  { id: "graphite", label: "Graphite", color: "#334155" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

/** Runs before first paint (inline in <head>) so the saved palette never flashes the default. */
export const PALETTE_INIT_SCRIPT = `try{var p=localStorage.getItem("${PALETTE_KEY}");if(p)document.documentElement.setAttribute("data-palette",p)}catch(e){}`;
