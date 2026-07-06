import Link from "next/link";
import { notFound } from "next/navigation";
import { getLead, getLeadNotes, getMessages, getModelRequests } from "@/lib/db";
import { StageBadge } from "@/components/badges";
import type { NoteKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<NoteKind, string> = {
  model_interest: "Cars they want",
  question: "Their questions",
  intent: "Where they stand",
  note: "Notes",
};

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = getLead(Number(id));
  if (!lead) notFound();

  const notes = getLeadNotes(lead.id);
  const messages = getMessages(lead.id, 100);
  const requests = getModelRequests(lead.id);

  const grouped = new Map<NoteKind, string[]>();
  for (const n of notes) {
    const list = grouped.get(n.kind) ?? [];
    list.push(n.content);
    grouped.set(n.kind, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-ink-3 hover:underline">
          ← Dashboard
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold">
            @{lead.ig_username}
            {lead.display_name && (
              <span className="ml-2 text-base font-normal text-ink-3">{lead.display_name}</span>
            )}
          </h1>
          <StageBadge stage={lead.stage} />
        </div>
        {lead.needs_attention === 1 && (
          <div className="mt-2 text-sm" style={{ color: "var(--status-warning)" }}>
            ⚠ {lead.attention_reason ?? "Needs your attention"} —{" "}
            <Link href="/queue" className="underline">
              open the approval queue
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold">Jotted down</h2>
          {notes.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {(Object.keys(KIND_LABELS) as NoteKind[]).map((kind) => {
                const items = grouped.get(kind);
                if (!items || items.length === 0) return null;
                return (
                  <div key={kind}>
                    <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-3">
                      {KIND_LABELS[kind]}
                    </h3>
                    <ul className="space-y-1 text-sm text-ink-2">
                      {items.map((content, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-ink-3">•</span>
                          <span>{content}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {requests.length > 0 && (
                <p className="text-xs text-ink-3">
                  Feeding the demand chart: {requests.map((r) => r.model).join(", ")}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold">Conversation</h2>
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className={m.direction === "out" ? "flex justify-end" : "flex"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.direction === "out" ? "text-white" : "border border-line"
                  }`}
                  style={
                    m.direction === "out"
                      ? {
                          background: "var(--accent)",
                          opacity: m.status === "draft" ? 0.65 : 1,
                        }
                      : undefined
                  }
                >
                  {m.text}
                  {m.status === "draft" && (
                    <div className="mt-1 text-xs opacity-90">✋ draft — awaiting your approval</div>
                  )}
                  {m.status === "rejected" && (
                    <div className="mt-1 text-xs opacity-90">✕ rejected, never sent</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
