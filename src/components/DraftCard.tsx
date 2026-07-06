"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  draftId: number;
  igUsername: string;
  displayName: string | null;
  reason: string | null;
  initialText: string;
}

export default function DraftCard({ draftId, igUsername, displayName, reason, initialText }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: action === "approve" ? text : undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">
          @{igUsername}
          {displayName && <span className="ml-2 text-sm font-normal text-ink-3">{displayName}</span>}
        </div>
      </div>
      {reason && (
        <p className="mt-1 text-sm" style={{ color: "var(--status-warning)" }}>
          ⚠ {reason}
        </p>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="mt-3 w-full resize-y rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => void act("approve")}
          disabled={busy || !text.trim()}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--status-good)" }}
        >
          Approve &amp; send
        </button>
        <button
          onClick={() => void act("reject")}
          disabled={busy}
          className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Reject
        </button>
        {error && (
          <span className="text-sm" style={{ color: "var(--status-serious)" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
