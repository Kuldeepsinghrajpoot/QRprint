# Shop addresses (one sub-address per shop)

Main address (dashboard, login, sign-up, Print Agent URL):  `https://qr.lexicalsoftware.in`
Every shop's customer page:                                 `https://<shop-name>.qr.lexicalsoftware.in`

## 1. Vercel (once)
1. Vercel → your project → **Settings → Environment Variables** (Production):
   - `NEXT_PUBLIC_APP_URL` = `https://qr.lexicalsoftware.in`
   - `NEXT_PUBLIC_SHOP_URL_TEMPLATE` = `https://{slug}.qr.lexicalsoftware.in`
   - plus your existing `MONGODB_URI`, `JWT_SECRET`, etc. (`AGENT_API_KEY` is now optional.)
2. **Settings → Domains → Add**: `qr.lexicalsoftware.in`, and the wildcard `*.qr.lexicalsoftware.in`.
3. Redeploy (the two `NEXT_PUBLIC_` values are baked in at build time, so a redeploy is required).

## 2. DNS (once) — where lexicalsoftware.in is managed
Vercel only issues HTTPS certificates for a wildcard when it controls the DNS for that name. You do NOT have to move
the whole domain — delegate just the `qr` part:

| Type | Name | Value |
| --- | --- | --- |
| NS | `qr` | `ns1.vercel-dns.com` |
| NS | `qr` | `ns2.vercel-dns.com` |

(Vercel shows the exact nameservers when you add the wildcard domain — use the ones it shows.)
Everything else on `lexicalsoftware.in` (website, email) is unaffected.

## 3. How it behaves
- Sign-up asks for a **Shop address** (suggested from the shop name; checked for availability live).
- The QR code and "Shop QR Code" page use `https://<name>.qr.lexicalsoftware.in`.
- `/admin`, `/login`, `/signup` on a shop address redirect to the main address.
- Reserved names (www, app, admin, api, …) can't be used. Owners can change the name in **Settings → Shop address**
  (printed QR codes for the old name stop working).
- Old QR links (`/?shop=<id>`) keep working.
- The desktop Print Agent keeps using the main address + the shop's agent key.
