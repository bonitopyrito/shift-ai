import { NextRequest, NextResponse } from "next/server";
import { getLead, getMessage, updateLead, updateMessageStatus, listDrafts } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Approve or reject a queued draft reply.
 * Body: { action: "approve" | "reject", text?: string }  — text lets the seller
 * edit the reply before approving.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  const message = Number.isFinite(id) ? getMessage(id) : null;
  if (!message || message.status !== "draft") {
    return NextResponse.json({ error: "draft not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  if (action === "approve") {
    const text = typeof body?.text === "string" && body.text.trim() ? body.text.trim() : undefined;
    updateMessageStatus(id, "sent", text);
    // When Instagram is wired, the approved text is delivered here via sendInstagramMessage().
  } else {
    updateMessageStatus(id, "rejected");
  }

  // Clear the attention flag once no drafts remain for this lead.
  const lead = getLead(message.lead_id);
  if (lead) {
    const stillPending = listDrafts().some((d) => d.lead_id === lead.id);
    if (!stillPending) {
      updateLead(lead.id, { needs_attention: 0, attention_reason: null });
    }
  }

  return NextResponse.json({ ok: true, action });
}
