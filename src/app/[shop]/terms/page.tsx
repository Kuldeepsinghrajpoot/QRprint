import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ShopLegal from "@/components/landing/ShopLegal";
import { loadShopPublic } from "@/lib/shopPublic";

type Props = { params: Promise<{ shop: string }> };

/** A shop's Terms & Conditions: /pradeepcsc/terms */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shop } = await params;
  const s = await loadShopPublic(shop);
  return { title: s ? `Terms & Conditions | ${s.name}` : "Not found" };
}

export default async function Page({ params }: Props) {
  const { shop } = await params;
  const s = await loadShopPublic(shop);
  if (!s) notFound();
  return <ShopLegal kind="terms" shop={s} base={`/${shop}`} />;
}
