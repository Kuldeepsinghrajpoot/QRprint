import { notFound } from "next/navigation";
import CustomerOrder from "@/components/CustomerOrder";

/** A shop's customer link on the main address: /ravi-xerox (or /<random id> for a shop with no short name). */
export default async function ShopPage({ params }: { params: Promise<{ shop: string }> }) {
  const { shop } = await params;
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(shop)) notFound();
  return <CustomerOrder />;
}
