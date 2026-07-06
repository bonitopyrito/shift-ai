import { NextRequest, NextResponse } from "next/server";
import { handleInboundMessage } from "@/lib/agent";
import {
  isInstagramConfigured,
  parseWebhookPayload,
  sendInstagramMessage,
  verifyWebhookSignature,
} from "@/lib/instagram";

export const dynamic = "force-dynamic";

/** Meta webhook verification handshake. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.IG_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

/** Inbound DM events from Meta. */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const events = parseWebhookPayload(payload);
  for (const event of events) {
    // The IG-scoped sender id doubles as the lead handle until profile lookup is wired in.
    const outcome = await handleInboundMessage(`ig:${event.senderId}`, event.text);
    if (outcome.disposition === "sent" && isInstagramConfigured()) {
      try {
        await sendInstagramMessage(event.senderId, outcome.replyText);
      } catch (err) {
        console.error("Failed to deliver Instagram reply:", err);
      }
    }
  }

  // Always 200 quickly so Meta doesn't retry-storm the endpoint.
  return NextResponse.json({ received: events.length });
}
