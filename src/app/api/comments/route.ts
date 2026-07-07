import { NextRequest, NextResponse } from "next/server";
import { handleInboundMessage } from "@/lib/agent";
import { isInstagramConfigured, replyToComment, sendPrivateReply } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/**
 * Comment ingestion — used by the simulator, the Graph API poller
 * (scripts/poll-meta.mjs), and anything else that surfaces a comment.
 * Body: { handle: string, text: string, media?: string, name?: string, commentId?: string }
 *
 * When commentId is present and Instagram is configured, the public reply and
 * the private-reply DM are actually delivered via the Graph API.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const handle = typeof body?.handle === "string" ? body.handle.trim().replace(/^@/, "") : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const media = typeof body?.media === "string" && body.media.trim() ? body.media.trim() : "a post";
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const commentId = typeof body?.commentId === "string" ? body.commentId : null;

  if (!handle || !text) {
    return NextResponse.json({ error: "handle and text are required" }, { status: 400 });
  }

  const outcome = await handleInboundMessage(handle, text, name, {
    comment: { mediaLabel: media },
  });

  let delivered = false;
  if (commentId && isInstagramConfigured()) {
    try {
      if (outcome.publicReply) await replyToComment(commentId, outcome.publicReply);
      // Held drafts go out through the approval queue instead.
      if (outcome.disposition === "sent") {
        await sendPrivateReply(commentId, outcome.replyText);
      }
      delivered = true;
    } catch (err) {
      console.error("Failed to deliver comment replies:", err);
    }
  }

  return NextResponse.json({
    leadId: outcome.leadId,
    publicReply: outcome.publicReply,
    reply: outcome.replyText,
    disposition: outcome.disposition,
    draftReason: outcome.draftReason,
    live: outcome.live,
    delivered,
  });
}
