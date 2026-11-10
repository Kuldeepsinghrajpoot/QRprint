import { SITE } from "./site";
import type { LegalSection } from "./legalContent";
import type { ShopPublic } from "@/lib/shopPublic";

export type PolicyKind = "terms" | "privacy" | "refund" | "pricing";

export const POLICY_TITLE: Record<PolicyKind, string> = {
  terms: "Terms & Conditions",
  privacy: "Privacy Policy",
  refund: "Refund & Cancellation Policy",
  pricing: "Pricing & Services",
};

type Shop = Pick<ShopPublic, "name" | "email" | "phone" | "address">;

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "write to a@b.in or call 98xxxx" built from whatever details the shop has saved. */
function reach(s: Shop): string {
  const parts = [s.email && `write to ${s.email}`, s.phone && `call ${s.phone}`].filter(Boolean);
  return parts.length ? parts.join(" or ") : "ask at the shop counter";
}

const software = `The online ordering software is provided by ${SITE.name}, a product of ${SITE.poweredBy.name}.`;

// Template text. Have it reviewed by a lawyer before relying on it.
export function shopPolicy(kind: PolicyKind, shop: Shop, extra?: { hours?: string; payments?: string; minOrder?: string }): LegalSection[] {
  const n = shop.name;
  const place = shop.address ? `at ${shop.address}` : "at the shop counter";

  if (kind === "terms") {
    return [
      {
        h: "About us",
        p: [
          `${n} is a print shop that takes print orders online. Customers scan the shop's QR code or open its web address, upload a file, choose print options, pay and collect the print ${place}. ${software}`,
        ],
      },
      {
        h: "Orders and prices",
        p: [
          `Prices are in Indian rupees and are shown before you pay. The price depends on paper size, black and white or colour, number of pages and copies, and options such as double-sided printing, binding or priority printing. GST is added where ${n} has switched it on.`,
          `Please check your file, page count and options before paying. A print is made as uploaded.`,
        ],
      },
      {
        h: "Payments",
        p: [
          `You can pay in cash at the counter or online (UPI, cards or net banking), depending on what ${n} has switched on. Online payments are processed on the secure page of the payment gateway ${n} uses, which is Razorpay, PhonePe or Paytm. We do not see or store your card number, bank details or UPI PIN.`,
        ],
      },
      {
        h: "Your files",
        p: [
          `Upload only files you have the right to print. Your file is used only to print your order and is deleted when the order is collected or cancelled.`,
        ],
      },
      {
        h: "Collecting your print",
        p: [
          `Your print is collected ${place}. Nothing is delivered to your home. After you order you get a receipt with a token number and a tracking page that shows Uploaded, Printing, Ready and Collected.`,
        ],
      },
      {
        h: "Cancellations and refunds",
        p: [
          `You can cancel an order for a short time right after placing it. After that, printing starts and the order cannot be cancelled. Please read the Refund & Cancellation Policy for the full rules.`,
        ],
      },
      {
        h: "Acceptable use",
        p: [
          `Do not upload anything illegal, harmful or abusive, and do not misuse or try to break the ordering service.`,
        ],
      },
      {
        h: "Liability",
        p: [
          `We take care with every print, but we are not responsible for problems caused by a file that is blurry, damaged or set up wrongly, or for delays caused by the printer or the internet. To the extent the law allows, our responsibility is limited to the amount you paid for the order.`,
        ],
      },
      {
        h: "Governing law and contact",
        p: [`These terms are governed by the laws of India. For any question, ${reach(shop)}.`],
      },
    ];
  }

  if (kind === "privacy") {
    return [
      {
        h: "What we collect",
        p: [
          `When you place an order: your name and mobile number, the file you upload, your print choices (size, colour, copies, pages) and, for online payments, a payment reference and status from the payment gateway.`,
        ],
      },
      {
        h: "How we use it",
        p: [
          `We use it to print your order, tell you when it is ready, let you track it, handle refunds and keep a record of orders for the shop. We do not sell your information.`,
        ],
      },
      {
        h: "Your files",
        p: [`Your file is used only to print your order and is deleted when the order is collected or cancelled.`],
      },
      {
        h: "Payments",
        p: [
          `Online payments are handled by the payment gateway ${n} uses (Razorpay, PhonePe or Paytm) on its own secure page. We never collect or store your card number, bank details or UPI PIN.`,
        ],
      },
      {
        h: "Who can see your information",
        p: [
          `Only ${n} can see your orders. ${software} It stores order data on our behalf. The payment gateway handles the payment details of online payments. We share information with others only if the law requires it.`,
        ],
      },
      {
        h: "Cookies",
        p: [`We do not use advertising cookies.`],
      },
      {
        h: "Your choices",
        p: [`To correct or delete your information, ${reach(shop)}.`],
      },
      {
        h: "Changes to this policy",
        p: [`If this policy changes, the new version will be posted on this page with a new date.`],
      },
    ];
  }

  if (kind === "refund") {
    return [
      {
        h: "Cancelling right after you order",
        p: [
          `After you place an order, a countdown of about 30 seconds appears on your receipt screen with a Cancel button, for example if you picked the wrong file. While it runs, nothing is printed. When it ends, printing starts and the order can no longer be cancelled by you.`,
        ],
      },
      {
        h: "If we cancel your order",
        p: [
          `${n} can cancel an order that is waiting, being printed or has failed to print, for example if the printer is out of paper or the file cannot be printed. You are not charged for an order we cancel.`,
        ],
      },
      {
        h: "How refunds are paid",
        p: [
          `Online payment: the full amount is refunded to the same UPI ID, card or bank account you paid from, through the same payment gateway. It usually reaches you in 5 to 7 working days, depending on your bank.`,
          `Cash payment: if you already paid cash for a cancelled order, we give the cash back at the counter.`,
          `If an automatic online refund does not go through, the order stays cancelled and we refund you manually. ${reach(shop).charAt(0).toUpperCase() + reach(shop).slice(1)} with your order token.`,
        ],
      },
      {
        h: "Orders that are already printed",
        p: [
          `Prints that are ready or collected are not refundable, because the paper and ink are used. If a print comes out wrong because of our printer or a mistake on our side, such as blank or missing pages or the wrong paper size, tell us at the counter and we will reprint it or refund you.`,
          `A file that is blurry, wrongly sized or wrongly oriented as uploaded is printed as received.`,
        ],
      },
      {
        h: "Money taken but no order created",
        p: [
          `If money was deducted but you did not get an order receipt, the payment gateway or your bank normally returns it automatically in 5 to 7 working days. If it does not arrive after that, ${reach(shop)} and share the payment reference from your SMS or bank app.`,
        ],
      },
      {
        h: "Contact",
        p: [`For refund questions, ${reach(shop)}. Please include your order token and the phone number used for the order.`],
      },
    ];
  }

  // pricing & services (the rates table is added by the page; these are the written parts)
  return [
    {
      h: "What you pay",
      p: [
        `You pay only the print price shown before you pay, in Indian rupees. The rates in the table above are ${n}'s own. There are no hidden charges, and the ordering software adds no fee to your payment.`,
        ...(extra?.minOrder ? [extra.minOrder] : []),
      ],
    },
    {
      h: "How you can pay",
      p: [extra?.payments || `Payment options are shown on the order page.`],
    },
    {
      h: "How the service works",
      p: [
        `1. Scan the shop's QR code or open its web address. 2. Upload your file and choose your print options. 3. Pay online or choose cash. 4. Track your order and collect the print ${place}.`,
        `This is a print service, and nothing is shipped. You collect your prints from the shop.`,
        ...(extra?.hours ? [extra.hours] : []),
      ],
    },
    {
      h: "Support",
      p: [`For any question about an order, ${reach(shop)}.`],
    },
  ];
}

export function hoursText(c: { openingHoursEnabled?: boolean; openTime?: string; closeTime?: string; openDays?: number[] } | null): string | undefined {
  if (!c?.openingHoursEnabled || !c.openTime || !c.closeTime) return undefined;
  const days = c.openDays && c.openDays.length < 7 ? ` on ${c.openDays.map((d) => DAY[d]).filter(Boolean).join(", ")}` : " every day";
  return `Orders are accepted from ${c.openTime} to ${c.closeTime}${days}.`;
}
