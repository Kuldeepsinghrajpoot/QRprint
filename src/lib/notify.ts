/**
 * Notification layer — sends order updates to customers.
 *
 * This ships with a console-log fallback so the app runs with zero setup.
 * To go live, plug in real credentials and uncomment the fetch calls:
 *   - WhatsApp: Meta WhatsApp Cloud API (free tier: 1,000 conversations/month)
 *     https://developers.facebook.com/docs/whatsapp/cloud-api
 *   - SMS fallback: Twilio or MSG91 (India-friendly, has a free trial)
 */

interface NotifyParams {
  phone?: string;
  customerName: string;
  message: string;
}

export async function sendOrderNotification({ phone, customerName, message }: NotifyParams): Promise<void> {
  if (!phone) return;

  const whatsappToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (whatsappToken && whatsappPhoneId) {
    try {
      await fetch(`https://graph.facebook.com/v19.0/${whatsappPhoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        }),
      });
      return;
    } catch (err) {
      console.error("WhatsApp notification failed, falling back to log:", err);
    }
  }

  // Fallback: just log it. Replace with an SMS provider call (Twilio/MSG91) if desired.
  console.log(`[notify] to ${customerName} (${phone}): ${message}`);
}

export function readyMessage(customerName: string, token: string): string {
  return `Hi ${customerName}, your print is ready! Token: #${token} — please collect it from the counter.`;
}

export function orderPlacedMessage(customerName: string, token: string): string {
  return `Hi ${customerName}, your print order #${token} has been placed. We'll notify you when it's ready.`;
}

export function cancelledMessage(customerName: string, token: string, refund: boolean): string {
  return `Hi ${customerName}, your print order #${token} was cancelled by the shop.${refund ? " Your payment will be refunded." : ""} Please check with the counter if you have questions.`;
}
