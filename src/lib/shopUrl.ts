/**
 * Shop web addresses. Every shop gets its own sub-address, e.g. https://ravi-xerox.qr.lexicalsoftware.in
 * (no server-only imports here — also used in the browser).
 *
 * NEXT_PUBLIC_SHOP_URL_TEMPLATE decides the shape; {slug} is replaced by the shop's name:
 *   production:  https://{slug}.qr.lexicalsoftware.in
 *   local test:  http://{slug}.qr.localhost:3000
 */
const TEMPLATE = process.env.NEXT_PUBLIC_SHOP_URL_TEMPLATE || "";

export const RESERVED_SLUGS = new Set([
  "www", "app", "qr", "admin", "api", "mail", "support", "help", "login", "signup", "static", "assets",
  "dashboard", "main", "track", "terms", "privacy-policy", "photo-tools", "privacy", "pricing", "about", "contact", "status", "blog", "docs", "billing", "ftp", "smtp", "test", "demo",
]);

export const shopUrlForSlug = (slug: string): string => (TEMPLATE ? TEMPLATE.replace("{slug}", slug) : "");

/** Host (without port) that shop sub-addresses live under, e.g. "qr.lexicalsoftware.in". */
function rootHost(): string {
  if (!TEMPLATE.includes("{slug}.")) return "";
  try {
    return new URL(TEMPLATE.replace("{slug}", "x")).hostname.replace(/^x\./, "");
  } catch {
    return "";
  }
}

/** "ravi-xerox.qr.lexicalsoftware.in" -> "ravi-xerox". Returns "" for the main site or any other host. */
export function slugFromHostname(hostname: string): string {
  const root = rootHost();
  const host = hostname.toLowerCase().split(":")[0];
  if (!root || !host.endsWith("." + root)) return "";
  const sub = host.slice(0, -(root.length + 1));
  return /^[a-z0-9-]{1,40}$/.test(sub) && !RESERVED_SLUGS.has(sub) ? sub : "";
}

/** True when the host is a shop sub-address (so dashboard pages should live on the main address instead). */
export const isShopHost = (hostname: string): boolean => !!slugFromHostname(hostname);

/** Turns "Ravi's Xerox & Prints!" into "ravis-xerox-prints". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’`]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

export function validateSlug(slug: string): string | null {
  if (slug.length < 3) return "Use at least 3 characters";
  if (slug.length > 30) return "Use at most 30 characters";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return "Use only lowercase letters, numbers and single hyphens";
  if (RESERVED_SLUGS.has(slug)) return "This name is reserved — please choose another";
  return null;
}
