"use client";

import { useState } from "react";

interface ChatEntry {
  from: "customer" | "ai";
  text: string;
  draft?: boolean;
  draftReason?: string | null;
}

export default function InboxSimulator() {
  const [handle, setHandle] = useState("carlos_m");
  const [text, setText] = useState("");
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const message = text.trim();
    if (!message || !handle.trim() || busy) return;
    setBusy(true);
    setError(null);
    setChat((c) => [...c, { from: "customer", text: message }]);
    setText("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim(), text: message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setChat((c) => [
        ...c,
        {
          from: "ai",
          text: data.reply,
          draft: data.disposition === "draft",
          draftReason: data.draftReason,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-3">
          You are messaging as
        </label>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          placeholder="instagram handle, e.g. carlos_m"
        />
      </div>

      <div className="min-h-64 space-y-2 rounded-xl border border-line bg-surface p-4">
        {chat.length === 0 && (
          <p className="text-sm text-ink-3">
            Play the customer. Try: “how much for the corolla”, “you got any civics?”, “would you
            take 7800 cash today” — then watch the dashboard.
          </p>
        )}
        {chat.map((entry, i) => (
          <div key={i} className={entry.from === "ai" ? "flex justify-end" : "flex"}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                entry.from === "ai" ? "text-white" : "border border-line"
              }`}
              style={
                entry.from === "ai"
                  ? { background: "var(--accent)", opacity: entry.draft ? 0.65 : 1 }
                  : undefined
              }
            >
              {entry.text}
              {entry.draft && (
                <div className="mt-1 text-xs opacity-90">
                  ✋ held for approval{entry.draftReason ? ` — ${entry.draftReason}` : ""}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-ink-3">typing…</p>}
      </div>

      {error && (
        <p className="text-sm" style={{ color: "var(--status-serious)" }}>
          {error}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          placeholder="Type a customer message…"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
