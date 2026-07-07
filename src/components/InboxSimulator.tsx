"use client";

import { useState } from "react";

interface ChatEntry {
  from: "customer" | "ai" | "ai-public";
  text: string;
  comment?: boolean;
  draft?: boolean;
  draftReason?: string | null;
}

export default function InboxSimulator() {
  const [mode, setMode] = useState<"dm" | "comment">("dm");
  const [handle, setHandle] = useState("carlos_m");
  const [media, setMedia] = useState("reel: 2016 civic walkaround");
  const [text, setText] = useState("");
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const message = text.trim();
    if (!message || !handle.trim() || busy) return;
    setBusy(true);
    setError(null);
    setChat((c) => [...c, { from: "customer", text: message, comment: mode === "comment" }]);
    setText("");
    try {
      const endpoint = mode === "comment" ? "/api/comments" : "/api/messages";
      const body =
        mode === "comment"
          ? { handle: handle.trim(), text: message, media: media.trim() || "a post" }
          : { handle: handle.trim(), text: message };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const replies: ChatEntry[] = [];
      if (data.publicReply) {
        replies.push({ from: "ai-public", text: data.publicReply });
      }
      replies.push({
        from: "ai",
        text: data.reply,
        draft: data.disposition === "draft",
        draftReason: data.draftReason,
      });
      setChat((c) => [...c, ...replies]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex gap-2">
          {(["dm", "comment"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                mode === m ? "text-white" : "border border-line text-ink-2"
              }`}
              style={mode === m ? { background: "var(--accent)" } : undefined}
            >
              {m === "dm" ? "Direct message" : "Comment on a post/reel"}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
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
          {mode === "comment" && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-ink-3">
                Commenting on
              </label>
              <input
                value={media}
                onChange={(e) => setMedia(e.target.value)}
                className="mt-1 w-full rounded-md border border-line bg-background px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                placeholder='e.g. reel: 2016 civic walkaround'
              />
            </div>
          )}
        </div>
      </div>

      <div className="min-h-64 space-y-2 rounded-xl border border-line bg-surface p-4">
        {chat.length === 0 && (
          <p className="text-sm text-ink-3">
            {mode === "dm"
              ? "Play the customer. Try: “how much for the corolla”, “you got any civics?”, “would you take 7800 cash today” — then watch the dashboard."
              : "Play someone commenting on his reel. Try: “how much?”, “is this still available”, “i want it” — the AI replies publicly and slides into their DMs."}
          </p>
        )}
        {chat.map((entry, i) => (
          <div key={i} className={entry.from === "customer" ? "flex" : "flex justify-end"}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                entry.from === "customer" ? "border border-line" : "text-white"
              }`}
              style={
                entry.from === "customer"
                  ? undefined
                  : {
                      background: entry.from === "ai-public" ? "var(--text-muted)" : "var(--accent)",
                      opacity: entry.draft ? 0.65 : 1,
                    }
              }
            >
              {entry.comment && <div className="mb-1 text-xs opacity-75">💬 comment</div>}
              {entry.from === "ai-public" && (
                <div className="mb-1 text-xs opacity-90">public reply under the comment</div>
              )}
              {entry.text}
              {entry.draft && (
                <div className="mt-1 text-xs opacity-90">
                  ✋ DM held for approval{entry.draftReason ? ` — ${entry.draftReason}` : ""}
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
          placeholder={mode === "dm" ? "Type a customer message…" : "Type a comment…"}
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
