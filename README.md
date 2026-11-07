# QRtoPrint — Next.js 16 + TypeScript + MongoDB

Production-grade implementation of the QR-based print-shop platform. This
repo is the **web app + dashboard**; a companion project, **`qrprint-agent`**
(Electron desktop app), is what actually sends jobs to a physical printer —
see [its README](../qrprint-agent/README.md).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16.3 (App Router) + TypeScript** |
| Styling | Tailwind CSS v4 |
| Database | **MongoDB** (via Mongoose) — MongoDB Atlas free tier |
| File Storage | **Local disk** by default (optional: Supabase Storage) |
| Auth | Custom JWT session cookies (`jose` + `bcryptjs`) — no external auth service needed |
| Payments | **Razorpay** (real integration; falls back to a simulated test-mode flow if no keys are set) |
| Notifications | WhatsApp Cloud API (falls back to console log if not configured) |
| Validation | Zod |
| PDF | `pdf-lib` — client-side page-count detection + server-side invoice PDF generation |
| QR Codes | `qrcode` — generates the shop's customer-facing QR |
| Hosting | Vercel (free/Hobby plan) |

No Express — everything is Next.js **Route Handlers** (`src/app/api/**/route.ts`), which are serverless-compatible.

### Customer (`/`) — additions
- **Mobile-first UI overhaul**: every dropdown (print type, paper size, binding, payment method) replaced with tappable pill/chip buttons — no native `<select>` menus; copies use a +/− stepper. Responsive from narrow phones up through tablet widths.
- **Expanded file types**: PDF, Word (.doc/.docx), ZIP, JPEG, PNG. PDF/image pages are still auto-counted; for Word/ZIP (which can't be reliably page-counted in-browser) the customer enters an estimate and is told staff will confirm the exact count.
- **File preview before paying** — a real embedded PDF viewer for PDFs, an image preview for photos, and a clear "can't preview this type" card (with file size) for Word/ZIP so nothing is a surprise.
- **Scan Document** — opens the phone's camera directly (`capture="environment"`), then runs the photo through a canvas-based contrast/grayscale enhancement so it reads like a proper scan rather than a dim phone photo.
- **💡 Smart duplex tip** — for documents over 4 pages, suggests turning on double-sided printing to cut paper cost.
- Add-ons: **order cancellation window** (30s countdown right after payment — cancels the order and auto-refunds via Razorpay if it was paid online), and a **Photo Tools** page (`/photo-tools`) for a **collage maker** (2–9 photos in a grid), **text/date-stamp overlay** on a photo, **ID Card Front & Back** (arranges both sides of an ID card on one sheet, uncropped), and **batch resize** (passport/stamp/postcard presets, auto-arranged on a sheet) — all done client-side with the Canvas API, no extra libraries.

### Shop Dashboard — additions
- **Pause/Resume printing** — a one-click toggle (Live Queue banner or Settings) for lunch breaks/printer maintenance: blocks new customer orders and holds the Print Agent from picking up already-queued ones until resumed.
- **Drag-and-drop queue reordering** — on the "Queued" filter tab, drag any order up/down to reprioritize (e.g. move a VIP customer up); priority/rush orders still always print first regardless of manual position.
- **Manual-print flagging** — Word/ZIP orders are marked `requiresManualPrint` and held back from the Print Agent entirely (there's no reliable silent-print path for those formats on Windows); the Live Queue shows a "📎 open & print manually" badge so staff know to handle them by hand, then click Mark Ready. Orders with a customer-estimated page count show an "⚠️ estimated" badge too, as a reminder to verify before charging/printing.

## Feature list

### Customer (`/`)
- Name + phone capture, file upload with **automatic page-count detection** (client-side `pdf-lib`, no server round-trip)
- **Live tiered pricing** — paper size (A4/A3/Legal/Letter/Photo) × print type (B&W/Color) × page tiers, computed from dashboard-editable rates
- Advanced options: **duplex** (with discount), **binding** (spiral/lamination), **priority/rush print** (extra fee)
- Cash or **real Razorpay online payment** (UPI/cards) — signature-verified server-side before an order is ever marked "paid"
- Animated "printer machine" payment screen + digital receipt with a unique token
- **Order tracking page** (`/track/[token]`) — live status: Uploaded → Printing → Ready → Collected

### Shop Dashboard (`/admin`, login-protected)
- **Live Queue** — polling order list, status filters, priority badges, per-order printer assignment, one-click invoice download, "Cash Received" / "Mark Ready" / "Mark Collected" actions
- **🔊 Hindi voice announcement** ("Naam, aapka print ready hai") via the Web Speech API whenever an order is marked ready
- **Printers** — register printers, see live online/offline heartbeat from the Print Agent
- **Pricing & Settings** — edit every price tier, duplex discount, binding charges, priority fee, GST, and toggle cash/online payments — changes apply instantly to the customer page
- **Analytics** — 14-day revenue chart, peak-hour chart, B&W vs Color split, totals
- **Shop QR Code** — generate/download the QR customers scan to reach the upload page
- **Staff roles** — `owner` vs `staff` (pricing changes are owner-only)

### Backend / Infrastructure
- MongoDB models: `Order`, `PricingConfig`, `Printer`, `User`, `Customer` (loyalty points + wallet-ready)
- File upload + **auto-delete on collection** (privacy)
- GST invoice PDF generation on the fly (`/api/orders/:id/invoice`)
- **Auto-cancel** stale unpaid cash orders (configurable timeout)
- Agent-facing APIs (`/api/agent/**`) — secured with a separate shared-secret key, used by the Electron Print Agent
- WhatsApp/SMS notification hook on order-placed and order-ready

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. MongoDB Atlas (Free)
Create a free M0 cluster at mongodb.com/cloud/atlas, add a DB user, allow network access, copy the connection string.

### 3. File storage
Nothing to set up: uploads are saved in `./.local-uploads` on the machine running the app (needs a normal, persistent disk — not Vercel). Optional free cloud alternative: Supabase Storage (see `.env.local.example`).

### 4. Configure environment variables
```bash
cp .env.local.example .env.local
```
At minimum, fill in `MONGODB_URI`, `JWT_SECRET`, and `AGENT_API_KEY` (generate random strings for the last two). Razorpay and WhatsApp variables are optional — the app works without them (simulated payment / console-logged notifications).

### 5. Create your shop-owner login
```bash
npm run seed
```
Answer the prompts (shop name, owner email/password) — this also seeds default pricing.

### 6. Run locally
```bash
npm run dev
```
- Customer page: http://localhost:3000
- Dashboard login: http://localhost:3000/login

### 7. Deploy (free)
Push to GitHub → import on vercel.com (auto-detects Next.js) → add the same env vars in Vercel project settings.

## Connecting the Print Agent

1. In the dashboard, go to **Printers → Add Printer**, give it a name and its exact Windows printer name, save
2. On the shop PC, set up `qrprint-agent` (see its README), pointing it at this server's URL + your `AGENT_API_KEY`, and map the printer ID from step 1
3. Orders marked "paid" now get picked up by the agent automatically and printed

## Notes

- **Realtime**: the dashboard polls every 3s rather than using WebSockets — zero extra setup required. Swap in Pusher/Supabase Realtime later if you want instant updates.
- **Razorpay**: leave `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` blank to use the built-in simulated payment flow while developing; add real (test or live) keys when ready to accept real payments.
- **Security hardening**: all dashboard-data API routes (`/api/orders`, `/api/printers`) now require a logged-in session (this was missing on the GET endpoints in an earlier pass — fixed); `/api/upload` validates file size (25MB max) and type (PDF/JPEG/PNG) server-side, not just via the client's `<input accept>`; `pages` is capped at 2000 and price calculation is O(1) rather than looping per page (prevents a huge `pages` value from being used to peg server CPU); login, order creation, and the public order-tracking endpoint are all rate-limited per IP (in-memory — fine for one server instance; swap for Upstash Redis if you scale to multiple instances) to blunt brute-forcing and scripted spam.
- **Multi-printer routing & special paper**: the agent picks a printer for each order — staff's manual assignment (dashboard dropdown) first, then a type-matched printer (B&W/Color), then a configured default. Orders using **non-A4 paper (Photo/A3/Legal)** are deliberately held back from auto-printing until a staff member manually assigns a printer from the dashboard — the Live Queue shows an amber alert banner and a per-order "📄 Needs X paper" badge for these, since no software can physically swap a printer's paper tray. Plain A4 jobs still print automatically. With multiple printers, the agent processes each printer's queue in parallel, so one busy printer doesn't stall the others. **Word docs and ZIP files are never sent to the agent** either — `pdf-to-printer`/SumatraPDF has no reliable way to silently print those formats — so these orders wait in the queue with a badge until staff open and print them manually from their own PC, then mark the order ready.
- **Duplicate-print protection**: if two agent instances ever poll at the same time (e.g. the agent accidentally installed on two PCs), the `queued → printing` transition is an atomic, conditional database update — only one of them can "claim" a given order, so the same file can never print twice. If an order ever gets stuck mid-print (rare network-drop edge case), staff can resolve it manually with the "Mark Ready (manual)" button on that order's card.
- **Single-shop model**: all data currently uses `shopId: "main"`. Multi-shop/franchise support would mean deriving `shopId` from the logged-in user/subdomain instead of hardcoding it.


## Landing page (Chhapo)

`/` now serves two things (see `src/app/page.tsx`):

- **Main address, no shop** (e.g. `qr.lexicalsoftware.in/`) -> the marketing landing page (`src/components/landing/`).
- **A shop sub-address** (`ravi-xerox.qr.lexicalsoftware.in`) **or an old `/?shop=<id>` link** -> the customer upload page (`src/components/CustomerOrder.tsx`, the former `page.tsx`).

Landing buttons use the real auth: the header "Login" popup calls `/api/auth/login` and opens `/admin`; "Start free trial" goes to `/signup`.
Edit brand name, WhatsApp number, email and address in `src/components/landing/site.ts`, and the plans in the `plans` array in `Landing.tsx` (display only, no billing is wired).
Locally, test the customer page with `http://localhost:3000/?shop=main`.

## File cleanup and cancel secret

- Customer files are deleted when an order is collected or cancelled. `src/lib/fileCleanup.ts` also removes files of failed or
  ready-but-uncollected orders and uploads that never became an order after `FILE_RETENTION_HOURS` (default 24). It runs from the
  dashboard's order polling (at most every 10 minutes) and from `GET /api/cron/cleanup` (set `CRON_SECRET`, call it hourly).
- Placing an order returns a one-time `cancelKey`. Cancelling an order needs it, so knowing an order id is not enough.
- API errors return a generic message in production and the details go to the server log (`src/lib/apiError.ts`).


## Order History, new-order alert and team logins

- **Order History** (`/admin/orders`): every order, not only the latest 200 of the Live Queue. Search by name, phone or token, filter by date range
  (today / 7 / 30 days / custom), print status, payment status and cash or online, page through the results, and **Export CSV** for Excel or your accountant
  (up to 5,000 rows, in the shop timezone). The four cards on top (orders, revenue, cash, online) follow the filters. API: `GET /api/orders/history`, `GET /api/orders/export`.
- **Live Queue**: a *New-order alert* switch (beep, banner and a count in the browser tab title when the tab is in the background; remembered per device)
  and a search box (name, phone or token).
- **Team** (Settings, owner only): add up to 10 staff logins, reset their password, remove them. Staff can run the queue, printers and order history,
  but not settings, the team list or "refunded". API: `/api/team`, `/api/team/:id`.
