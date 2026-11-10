import Legal from "./Legal";
import { POLICY_TITLE, shopPolicy, hoursText, type PolicyKind } from "./shopLegalContent";
import type { ShopPublic, ShopConfig } from "@/lib/shopPublic";

const PAPERS = ["A4", "A3", "Legal", "Letter", "Photo"] as const;
const money = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(2)}`;

function PricingTable({ config }: { config: ShopConfig }) {
  const extras: string[] = [];
  if (config.duplexDiscountPercent > 0) extras.push(`Double-sided printing: ${config.duplexDiscountPercent}% discount`);
  if (config.bindingSpiralCharge > 0) extras.push(`Spiral binding: ${money(config.bindingSpiralCharge)}`);
  if (config.bindingLaminationCharge > 0) extras.push(`Lamination: ${money(config.bindingLaminationCharge)} per page`);
  if (config.priorityFeePercent > 0) extras.push(`Priority printing: ${config.priorityFeePercent}% extra`);
  if (config.onlineFeeEnabled && config.onlineFeePercent > 0)
    extras.push(`Online payments (UPI / card): ${config.onlineFeePercent}% payment fee${config.onlineFeeGstPercent > 0 ? ` + ${config.onlineFeeGstPercent}% GST on that fee` : ""}. Cash has no extra fee`);
  extras.push(config.gstEnabled ? `GST: ${config.gstPercent}% added to the bill` : "GST: not charged");

  return (
    <div className="mt-8">
      <h2 className="font-display text-xl font-bold">Print rates (per page)</h2>
      <div className="mt-3 overflow-x-auto rounded-md border border-ink/10 bg-white">
        <table className="w-full min-w-[460px] text-left text-sm">
          <thead className="bg-ink/5 text-ink/70">
            <tr>
              <th className="px-3 py-2 font-semibold">Paper</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">1st page</th>
              <th className="px-3 py-2 font-semibold">Pages 2 to 10</th>
              <th className="px-3 py-2 font-semibold">Page 11 onwards</th>
            </tr>
          </thead>
          <tbody>
            {PAPERS.flatMap((paper) =>
              (["bw", "color"] as const).map((t) => {
                const r = config.rates?.[paper]?.[t];
                if (!r || config.availability?.[paper]?.[t] === false) return null;
                return (
                  <tr key={`${paper}-${t}`} className="border-t border-ink/10">
                    <td className="px-3 py-2 font-medium">{paper}</td>
                    <td className="px-3 py-2">{t === "bw" ? "Black & white" : "Colour"}</td>
                    <td className="px-3 py-2 tabular-nums">{money(r.page1)}</td>
                    <td className="px-3 py-2 tabular-nums">{money(r.page2to10)}</td>
                    <td className="px-3 py-2 tabular-nums">{money(r.page11plus)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-ink/80">
        {extras.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  );
}

function ContactBox({ shop }: { shop: ShopPublic }) {
  const has = shop.email || shop.phone || shop.address;
  return (
    <section className="mt-12 rounded-md border border-ink/10 bg-white p-5">
      <h2 className="font-display text-xl font-bold">Contact {shop.name}</h2>
      {has ? (
        <dl className="mt-3 space-y-2 text-ink/80">
          {shop.address && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Address</dt>
              <dd className="whitespace-pre-line">{shop.address}</dd>
            </div>
          )}
          {shop.phone && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Phone</dt>
              <dd><a href={`tel:${shop.phone}`} className="hover:text-brand">{shop.phone}</a></dd>
            </div>
          )}
          {shop.email && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">Email</dt>
              <dd><a href={`mailto:${shop.email}`} className="hover:text-brand">{shop.email}</a></dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-2 text-ink/70">Please ask at the shop counter.</p>
      )}
    </section>
  );
}

/** A shop's own policy page. All names, contact details and prices come from what the shop owner saved in Settings. */
export default function ShopLegal({ kind, shop, base }: { kind: PolicyKind; shop: ShopPublic; base: string }) {
  const c = shop.config;
  const payments = c
    ? c.freePrinting
      ? "Printing is free at this shop, so there is nothing to pay."
      : `Accepted: ${[c.onlinePaymentEnabled && "online payment (UPI, cards or net banking)", c.cashPaymentEnabled && "cash at the counter"].filter(Boolean).join(" and ") || "see the order page"}.`
    : undefined;
  const minOrder = c && c.minOrderAmount > 0 ? `The minimum order amount is ${money(c.minOrderAmount)}.` : undefined;
  const sections = shopPolicy(kind, shop, { hours: hoursText(c), payments, minOrder });

  return (
    <Legal
      title={POLICY_TITLE[kind]}
      sections={sections}
      brand={shop.name}
      homeHref={base || "/"}
      linksBase={base}
      before={kind === "pricing" && c ? <PricingTable config={c} /> : undefined}
      after={<ContactBox shop={shop} />}
    />
  );
}
