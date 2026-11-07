import type { Metadata } from "next";
import Legal from "@/components/landing/Legal";
import { terms } from "@/components/landing/legalContent";
import { SITE } from "@/components/landing/site";

export const metadata: Metadata = { title: `Terms of Use | ${SITE.name}` };

export default function TermsPage() {
  return <Legal title="Terms of Use" sections={terms} />;
}
