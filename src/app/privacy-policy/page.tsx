import type { Metadata } from "next";
import Legal from "@/components/landing/Legal";
import { privacy } from "@/components/landing/legalContent";
import { SITE } from "@/components/landing/site";

export const metadata: Metadata = { title: `Privacy Policy | ${SITE.name}` };

export default function PrivacyPage() {
  return <Legal title="Privacy Policy" sections={privacy} />;
}
