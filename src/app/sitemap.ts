import type { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://www.qr.lexicalsoftware.in").replace(/\/+$/, "");

// Public pages only. The dashboard, API and order tracking pages are not listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly") => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });
  return [
    page("/", 1, "weekly"),
    page("/print-agent", 0.8, "monthly"),
    page("/signup", 0.7, "monthly"),
    page("/login", 0.5, "monthly"),
    page("/photo-tools", 0.5, "monthly"),
    page("/terms", 0.3, "yearly"),
    page("/privacy-policy", 0.3, "yearly"),
  ];
}
