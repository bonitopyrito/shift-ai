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

/** Reply publicly under a comment on one of his posts/reels. */
export async function replyToComment(commentId: string, text: string): Promise<void> {
  const token = process.env.IG_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("IG_PAGE_ACCESS_TOKEN not set");
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(commentId)}/replies?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Comment reply failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

/**
 * Meta "private reply": send a DM to someone in response to their comment —
 * the recipient is the comment id, not a user id. Allowed once per comment,
 * within 7 days. This is what turns a reel commenter into a DM lead.
 */
export async function sendPrivateReply(commentId: string, text: string): Promise<void> {
  const token = process.env.IG_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("IG_PAGE_ACCESS_TOKEN not set");
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Private reply failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

/** Shape of the webhook entries we care about. */
export interface IgMessagingEvent {
  senderId: string;
  text: string;
}

export interface IgCommentEvent {
  commentId: string;
  username: string;
  text: string;
  mediaLabel: string;
}

/** Pull inbound DMs and comments out of a Meta webhook payload. */
export function parseWebhookPayload(payload: unknown): {
  messages: IgMessagingEvent[];
  comments: IgCommentEvent[];
} {
  const messages: IgMessagingEvent[] = [];
  const comments: IgCommentEvent[] = [];
  const body = payload as {
    object?: string;
    entry?: {
      id?: string;
      messaging?: { sender?: { id?: string }; message?: { text?: string; is_echo?: boolean } }[];
      changes?: {
        field?: string;
        value?: {
          id?: string;
          text?: string;
          from?: { id?: string; username?: string };
          media?: { id?: string; media_product_type?: string };
        };
      }[];
    }[];
  };
  if (body.object !== "instagram" && body.object !== "page") return { messages, comments };
  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const senderId = event.sender?.id;
      const text = event.message?.text;
      if (senderId && text && !event.message?.is_echo) {
        messages.push({ senderId, text });
      }
    }
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments") continue;
      const v = change.value;
      // entry.id is the seller's own account — skip his own comments/replies
      if (!v?.id || !v.text || !v.from?.username || v.from.id === entry.id) continue;
      const kind = v.media?.media_product_type === "REELS" ? "reel" : "post";
      comments.push({
        commentId: v.id,
        username: v.from.username,
        text: v.text,
        mediaLabel: `${kind} ${v.media?.id ?? ""}`.trim(),
      });
    }
  }
  return { messages, comments };
}
