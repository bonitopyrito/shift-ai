"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VoiceNoteForm() {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ summary: string; applied: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = transcript.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/voice-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult({ summary: data.summary, applied: data.applied ?? [] });
      setTranscript("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="rounded-xl border border-line bg-surface p-4"
      >
        <label className="text-xs font-medium uppercase tracking-wide text-ink-3">
          Voice note (transcript)
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-y rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          placeholder="the gray corolla's gone… got a 2016 altima coming thursday, asking 8500 firm… oh and tell people financing is 30 down now"
        />
        <button
          type="submit"
          disabled={busy || !transcript.trim()}
          className="mt-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {busy ? "Processing…" : "Process voice note"}
        </button>
      </form>

      {result && (
        <div className="rounded-xl border border-line bg-surface p-4 text-sm">
          <p className="text-ink">{result.summary}</p>
          {result.applied.length > 0 && (
            <ul className="mt-2 space-y-1 text-ink-2">
              {result.applied.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span style={{ color: "var(--status-good)" }}>✓</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p className="text-sm" style={{ color: "var(--status-serious)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
