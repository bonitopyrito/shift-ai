import { NextRequest, NextResponse } from "next/server";
import { handleInboundMessage } from "@/lib/agent";

export const dynamic = "force-dynamic";

/**
 * Simulated inbox endpoint: play a customer sending a DM.
 * Body: { handle: string, text: string, name?: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const handle = typeof body?.handle === "string" ? body.handle.trim().replace(/^@/, "") : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;

  if (!handle || !text) {
    return NextResponse.json({ error: "handle and text are required" }, { status: 400 });
  }

  const outcome = await handleInboundMessage(handle, text, name);
  return NextResponse.json({
    leadId: outcome.leadId,
    reply: outcome.replyText,
    disposition: outcome.disposition,
    draftReason: outcome.draftReason,
    live: outcome.live,
  });
}
