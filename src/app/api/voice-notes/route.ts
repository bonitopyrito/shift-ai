import { NextRequest, NextResponse } from "next/server";
import { processVoiceNote } from "@/lib/extract";

export const dynamic = "force-dynamic";

/**
 * Voice-note ingestion. Accepts a transcript directly:
 *   { transcript: string }
 * Audio transcription (Whisper/Deepgram/etc.) plugs in upstream of this
 * endpoint — transcribe, then POST the text here.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }
  const result = await processVoiceNote(transcript);
  return NextResponse.json(result);
}
