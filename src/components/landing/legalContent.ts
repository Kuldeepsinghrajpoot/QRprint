import { SITE } from "./site";

// Template text. Have it reviewed by a lawyer before relying on it.
export type LegalSection = { h: string; p: string[] };

export const LEGAL_UPDATED = "4 November 2026";

export const terms: LegalSection[] = [
  {
    h: "About the service",
    p: [
      `${SITE.name} lets print shops, cyber cafes and xerox centers receive print jobs from customers through a shop QR code. Shop owners create an account and use the dashboard and Print Agent. Customers upload files without an account.`,
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
    h: "Payments",
    p: [
      `UPI payments go directly to the shop's own UPI ID, and cash is paid at the counter. ${SITE.name} does not receive or hold customer money and takes no commission on customer payments.`,
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
      `UPI payments go straight to the shop. We do not collect or store card, bank or UPI PIN details.`,
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
      `A shop can see the orders and customer details for its own shop only. Our hosting and storage providers process data for us so the service can run. We share information with others only if the law requires it.`,
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
