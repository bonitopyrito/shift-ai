import crypto from "node:crypto";

/**
 * Meta (Instagram Messaging API) integration.
 * Requires: IG professional account linked to a Facebook Page, a Meta app with
 * instagram_manage_messages, and these env vars:
 *   IG_VERIFY_TOKEN      — any string you choose; entered in the Meta webhook config
 *   IG_APP_SECRET        — the Meta app secret (for X-Hub-Signature-256 verification)
 *   IG_PAGE_ACCESS_TOKEN — page access token used to send replies
 */

export function isInstagramConfigured(): boolean {
  return Boolean(process.env.IG_PAGE_ACCESS_TOKEN);
}

/** Constant-time verification of Meta's X-Hub-Signature-256 header. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.IG_APP_SECRET;
  if (!secret) return false;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

/** Send a text DM via the Meta Graph API. */
export async function sendInstagramMessage(recipientId: string, text: string): Promise<void> {
  const token = process.env.IG_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("IG_PAGE_ACCESS_TOKEN not set");
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: "RESPONSE",
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram send failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

/** Shape of the webhook entries we care about. */
export interface IgMessagingEvent {
  senderId: string;
  text: string;
}

/** Pull inbound text messages out of a Meta webhook payload. */
export function parseWebhookPayload(payload: unknown): IgMessagingEvent[] {
  const events: IgMessagingEvent[] = [];
  const body = payload as {
    object?: string;
    entry?: { messaging?: { sender?: { id?: string }; message?: { text?: string; is_echo?: boolean } }[] }[];
  };
  if (body.object !== "instagram" && body.object !== "page") return events;
  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id;
      const text = event.message?.text;
      if (senderId && text && !event.message?.is_echo) {
        events.push({ senderId, text });
      }
    }
  }
  return events;
}
