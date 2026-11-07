import type { Metadata } from "next";
import { headers } from "next/headers";
import { slugFromHostname } from "@/lib/shopUrl";
import CustomerOrder from "@/components/CustomerOrder";
import Landing from "@/components/landing/Landing";
import { SITE } from "@/components/landing/site";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * "/" has two jobs:
 *  - a shop sub-address (ravi-xerox.qr.lexicalsoftware.in) or an old "?shop=<id>" QR link -> the customer upload page
 *  - the main address with no shop -> the marketing landing page
 */
async function isCustomerRequest(searchParams: Props["searchParams"]): Promise<boolean> {
  const [h, sp] = await Promise.all([headers(), searchParams]);
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim().split(":")[0];
  return !!slugFromHostname(host) || !!sp.shop;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  if (await isCustomerRequest(searchParams)) return {};
  const title = `${SITE.name}: QR Printing Software for Cyber Cafes & Xerox Shops`;
  return {
    title,
    description: SITE.description,
    openGraph: { title, description: SITE.description, type: "website", siteName: SITE.name },
  };
}

export default async function Home({ searchParams }: Props) {
  return (await isCustomerRequest(searchParams)) ? <CustomerOrder /> : <Landing />;
}
