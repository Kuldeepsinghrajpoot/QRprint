import type { Metadata } from "next";
import Legal from "@/components/landing/Legal";
import ShopLegal from "@/components/landing/ShopLegal";
import { refund } from "@/components/landing/legalContent";
import { SITE } from "@/components/landing/site";
import { shopFromRequest } from "@/lib/shopPublic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// On a shop's own address (or an old ?shop= link) this shows that shop's page; on the main address it shows QRtoPrint's.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const found = await shopFromRequest(await searchParams);
  return { title: `Refund & Cancellation Policy | ${found ? found.shop.name : SITE.name}` };
}

export default async function Page({ searchParams }: Props) {
  const found = await shopFromRequest(await searchParams);
  if (found) return <ShopLegal kind="refund" shop={found.shop} base={found.base} />;
  return <Legal title="Refund & Cancellation Policy" sections={refund} />;
}
