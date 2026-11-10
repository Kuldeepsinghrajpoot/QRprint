import { SITE, PLANS } from "./site";

// Template text. Have it reviewed by a lawyer before relying on it.
export type LegalSection = { h: string; p: string[] };

export const LEGAL_UPDATED = "10 November 2026";

export const terms: LegalSection[] = [
  {
    h: "About the service",
    p: [
      `${SITE.name} lets print shops, cyber cafes and xerox centers receive print jobs from customers through a shop QR code. Shop owners create an account and use the dashboard and Print Agent. Customers upload files without an account.`,
      `${SITE.name} is software. The prints themselves are made and handed over by the shop the customer chose, and the shop is the seller of those prints.`,
    ],
  },
  {
    h: "Shop accounts",
    p: [
      `You must give correct information when you sign up and keep your password and Print Agent key private. You are responsible for the prices you set, the prints you make and everything done through your account.`,
    ],
  },
  {
    h: "Customer files",
    p: [
      `Customers must only upload files they have the right to print. Shops must not copy, keep or share customer files. Uploaded files are deleted as soon as the order is collected or cancelled.`,
    ],
  },
  {
    h: "Prices and payments",
    p: [
      `Print prices are set by each shop and shown to the customer, in Indian rupees, before the customer pays. Customers can pay in cash at the counter or online (UPI, cards or net banking) through the payment gateway the shop has chosen: Razorpay, PhonePe or Paytm.`,
      `Online payments are collected through the shop's own gateway account and settled to the shop by that gateway. Where a shop has not set up its own gateway account, online payments are collected through the account ${SITE.name} operates for it and passed on to the shop. ${SITE.name} takes no commission on customer payments. Refunds are covered in the Refund & Cancellation Policy.`,
    ],
  },
  {
    h: "Cancellations and refunds",
    p: [
      `A customer can cancel an order for a short time right after placing it. After that, printing starts and the order cannot be cancelled by the customer. The full rules are in the Refund & Cancellation Policy.`,
    ],
  },
  {
    h: "Acceptable use",
    p: [
      `Do not use the service for anything illegal, to upload harmful or abusive content, to overload or scrape the service, or to try to get around its security.`,
    ],
  },
  {
    h: "Plans and changes",
    p: [
      `Every feature is free for a limited period. Plans, prices and features may change, and any change to the free offer will be announced on this website. We may update these terms and will post the new version here.`,
    ],
  },
  {
    h: "Liability",
    p: [
      `The service is provided as it is. To the extent the law allows, ${SITE.name} is not responsible for failed or lost print jobs, printer or internet problems, or indirect losses.`,
    ],
  },
  {
    h: "Governing law and contact",
    p: [
      `These terms are governed by the laws of India. Questions about these terms can be sent to ${SITE.email}.`,
    ],
  },
];

export const privacy: LegalSection[] = [
  {
    h: "What we collect",
    p: [
      `Shop owners: your name, shop name, email address and a password, which we store only in hashed form.`,
      `Customers: the name and mobile number entered when placing an order, the file you upload, and your print choices such as size, colour, copies and pages.`,
    ],
  },
  {
    h: "How we use it",
    p: [
      `We use this information to run the service: to show new orders to the shop, print them, track order status and show the shop its order history. We do not sell personal information and we do not use customer files for anything else.`,
    ],
  },
  {
    h: "Customer files",
    p: [
      `Uploaded files are used only to print your order. They are deleted from our storage as soon as the order is collected or cancelled.`,
    ],
  },
  {
    h: "Payments",
    p: [
      `Online payments are processed by the payment gateway the shop uses (Razorpay, PhonePe or Paytm) on the gateway's own secure page. We do not collect or store your card number, bank details or UPI PIN. We keep only the payment reference and status we need to confirm your order and to refund it if it is cancelled.`,
    ],
  },
  {
    h: "Cookies",
    p: [
      `We use one sign-in cookie to keep shop owners logged in to the dashboard. We do not use advertising cookies.`,
    ],
  },
  {
    h: "Who can see your data",
    p: [
      `A shop can see the orders and customer details for its own shop only. Our hosting and storage providers, and the payment gateway used for an online payment, process data for us so the service can run. We share information with others only if the law requires it.`,
    ],
  },
  {
    h: "Your choices",
    p: [
      `You can ask us to correct or delete your information by writing to ${SITE.email}.`,
    ],
  },
  {
    h: "Changes to this policy",
    p: [
      `If we change this policy we will post the new version on this page with a new date.`,
    ],
  },
];

export const refund: LegalSection[] = [
  {
    h: "Who this applies to",
    p: [
      `This policy covers print orders placed through a shop's ${SITE.name} link or QR code. The shop prepares the print and is responsible for the order. ${SITE.name} provides the software that takes the order, the payment and the refund.`,
    ],
  },
  {
    h: "Cancelling right after you order",
    p: [
      `After you place an order, a countdown of about 30 seconds appears on your receipt screen with a Cancel button, for example if you picked the wrong file. While the countdown runs the order is held and nothing is printed.`,
      `Once the countdown ends, printing starts and you can no longer cancel the order yourself.`,
    ],
  },
  {
    h: "If the shop cancels your order",
    p: [
      `A shop can cancel an order that is still waiting, being printed or has failed to print, for example if the printer is out of paper or the file cannot be printed. You will not be charged for an order the shop cancels.`,
    ],
  },
  {
    h: "How refunds are paid",
    p: [
      `Online payment: the amount is refunded in full to the same UPI ID, card or bank account you paid from, through the same gateway (Razorpay, PhonePe or Paytm). It usually reaches you in 5 to 7 working days, depending on your bank.`,
      `Cash payment: if you already paid cash at the counter for a cancelled order, the shop gives the cash back.`,
      `If an automatic online refund does not go through, the order stays cancelled and the shop refunds you manually. Contact the shop, or write to ${SITE.email} with your order token.`,
    ],
  },
  {
    h: "Orders that are already printed",
    p: [
      `Prints that are ready or collected are not refundable, because the paper and ink are already used. If a print comes out wrong because of a printer or shop error, such as blank pages, missing pages or a wrong paper size, tell the shop at the counter and they will reprint it or refund you.`,
      `A file that is blurry, wrongly sized or wrongly oriented as uploaded is printed as received.`,
    ],
  },
  {
    h: "Money taken but no order created",
    p: [
      `If money was deducted but you did not get an order receipt, the gateway or your bank normally returns it automatically within 5 to 7 working days. If it does not arrive after that, contact the shop or write to ${SITE.email} with the payment reference from your SMS or bank app.`,
    ],
  },
  {
    h: "Shop subscription charges",
    p: [
      `The ${SITE.name} plans are currently free, so there is nothing to refund. If paid plans begin, the price, billing period and refund terms will be shown clearly before you pay, and any change will be announced on this website.`,
    ],
  },
  {
    h: "Contact",
    p: [
      `For refund questions write to ${SITE.email}. Please include your order token and the phone number used for the order.`,
    ],
  },
];

export const pricing: LegalSection[] = [
  {
    h: "What is free right now",
    p: [
      `Every feature of ${SITE.name} is free for a limited period, in both plans. There are no setup fees, no hidden charges and no auto-renewal.`,
      ...PLANS.map((p) => `${p.n}: ${p.o}. Free for now. Regular price ₹${p.p} ${p.per}.`),
    ],
  },
  {
    h: "What customers pay",
    p: [
      `Customers pay only the print price set by the shop, shown in Indian rupees before paying. It depends on paper size, black and white or colour, number of pages and copies, and options such as double-sided printing, binding or priority printing.`,
      `${SITE.name} adds no platform fee and takes no commission on customer payments. GST is shown where the shop has switched it on.`,
      `Any charge a payment gateway makes for processing an online payment is between the shop and its gateway.`,
    ],
  },
  {
    h: "What you get as a shop",
    p: [
      `A shop QR code and a customer link of your own, a dashboard with a live order queue, pricing and settings, reports and analytics, order history, staff logins, online payments through Razorpay, PhonePe or Paytm, cash orders, and the Print Agent that sends jobs to your printer automatically.`,
    ],
  },
  {
    h: "How the service is delivered",
    p: [
      `${SITE.name} is an online service with nothing to ship. After you sign up and verify your email, your shop account and link are ready straight away. You then set up the Print Agent on the shop computer.`,
      `For customers, the print is made at the shop. After you pay or place a cash order you get a receipt with a token and a tracking page that moves from Uploaded to Printing to Ready to Collected. You collect the print from the shop counter. Nothing is delivered to your home.`,
      `Orders wait in the queue if the shop computer or internet is off and print when it is back online.`,
    ],
  },
  {
    h: "Support",
    p: [
      `Write to ${SITE.email}${/^\d{10,15}$/.test(SITE.whatsapp) ? ` or message us on WhatsApp at +${SITE.whatsapp}` : ""}. Questions about a particular print order are best asked at the shop's counter.`,
    ],
  },
];
