/**
 * Email layer. Preferred: Resend (set RESEND_API_KEY, and MAIL_FROM = a sender on your verified Resend domain).
 * Fallback: any SMTP account (Gmail app password, Brevo, Resend SMTP, Zoho...).
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (and optionally MAIL_FROM) to send for real.
 * With no SMTP settings the email is only written to the server log, so the app runs with zero setup.
 * Sending never throws: a mail problem must never break the thing that triggered it (sign-up, etc.).
 */
import nodemailer from "nodemailer";

interface MailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

async function sendViaResend(key: string, { to, subject, text, html }: MailParams): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "QRtoPrint <onboarding@resend.dev>", to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error("[mail] Resend refused:", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mail] Resend could not send:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function sendMail(params: MailParams): Promise<boolean> {
  const { to, subject, text, html } = params;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) return sendViaResend(resendKey, params);
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.log(`[mail] (no RESEND_API_KEY or SMTP set up, not sent) to ${to}: ${subject}`);
    return false;
  }
  try {
    const port = Number(process.env.SMTP_PORT) || 587;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
    await transport.sendMail({ from: process.env.MAIL_FROM || `QRtoPrint <${user}>`, to, subject, text, html });
    return true;
  } catch (err) {
    console.error("[mail] could not send:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Sent once to a new shop owner right after sign-up. Holds no password or secret key. */
export function welcomeEmail(p: { name: string; shopName: string; shopUrl: string; dashboardUrl: string }) {
  const { name, shopName, shopUrl, dashboardUrl } = p;
  const subject = `Welcome to QRtoPrint, ${shopName} is ready`;
  const text = [
    `Hi ${name},`,
    ``,
    `Your shop "${shopName}" is set up on QRtoPrint.`,
    ``,
    `Customer link (print this as a QR code for your counter):`,
    shopUrl,
    ``,
    `Your dashboard: ${dashboardUrl}`,
    ``,
    `First steps:`,
    `1. Pricing: set your per-page rates.`,
    `2. Printers: install the Print Agent and connect your printer.`,
    `3. Shop QR Code: print the QR and put it on your counter.`,
    ``,
    `If you didn't create this account, you can ignore this email.`,
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0f172a;line-height:1.55">
<h2 style="margin:0 0 12px">Welcome, ${esc(name)} 👋</h2>
<p>Your shop <b>${esc(shopName)}</b> is set up on QRtoPrint.</p>
<p style="margin:18px 0 6px;color:#475569">Your customer link (put it on a QR at your counter):</p>
<p style="margin:0 0 18px"><a href="${esc(shopUrl)}" style="color:#0369a1;font-weight:bold">${esc(shopUrl)}</a></p>
<p><a href="${esc(dashboardUrl)}" style="display:inline-block;background:#0369a1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open your dashboard</a></p>
<p style="margin-top:22px"><b>First steps</b></p>
<ol style="padding-left:18px;margin:6px 0">
<li>Pricing: set your per-page rates.</li>
<li>Printers: install the Print Agent and connect your printer.</li>
<li>Shop QR Code: print the QR and put it on your counter.</li>
</ol>
<p style="color:#94a3b8;font-size:12px;margin-top:24px">If you didn't create this account, you can ignore this email.</p>
</div>`;
  return { subject, text, html };
}

/** The 6-digit code that proves a new owner controls the email address they signed up with. */
export function otpEmail(p: { name: string; code: string; minutes: number }) {
  const { name, code, minutes } = p;
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const subject = `${code} is your QRtoPrint verification code`;
  const text = [
    `Hi ${name},`,
    ``,
    `Your QRtoPrint verification code is: ${code}`,
    ``,
    `It works for ${minutes} minutes. Don't share it with anyone.`,
    ``,
    `If you didn't try to create an account, you can ignore this email.`,
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0f172a;line-height:1.55">
<h2 style="margin:0 0 12px">Verify your email</h2>
<p>Hi ${esc(name)}, enter this code to finish creating your QRtoPrint account:</p>
<p style="margin:18px 0;font-size:34px;letter-spacing:8px;font-weight:bold;background:#f1f5f9;border-radius:10px;padding:14px 0;text-align:center">${esc(spaced)}</p>
<p style="color:#475569">It works for ${minutes} minutes. Don't share it with anyone.</p>
<p style="color:#94a3b8;font-size:12px;margin-top:24px">If you didn't try to create an account, you can ignore this email.</p>
</div>`;
  return { subject, text, html };
}
