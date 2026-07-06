import Link from "next/link";
import {
  getDemandSignals,
  getLeadNotes,
  getStats,
  listLeads,
} from "@/lib/db";
import { isLiveMode } from "@/lib/agent";
import { StageBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div
        className="text-3xl font-semibold tabular-nums"
        style={tone === "warn" && value > 0 ? { color: "var(--status-warning)" } : undefined}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-ink-2">{label}</div>
    </div>
  );
}

function DemandChart({ data }: { data: { model: string; make: string | null; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-3">No requests recorded yet — they appear as customers DM.</p>;
  }
  const max = Math.max(...data.map((d) => d.count));
  return (
    // Single measure, single hue; every bar direct-labeled (name + value in text ink)
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.model} className="flex items-center gap-3">
          <div className="w-32 shrink-0 truncate text-sm text-ink-2">
            {[d.make, d.model].filter(Boolean).join(" ")}
          </div>
          <div className="h-4 flex-1">
            <div
              className="h-2.5 translate-y-[3px] rounded-r"
              style={{
                width: `${Math.max((d.count / max) * 100, 4)}%`,
                background: "var(--series-1)",
              }}
              title={`${[d.make, d.model].filter(Boolean).join(" ")}: ${d.count} ${d.count === 1 ? "person" : "people"} asked`}
            />
          </div>
          <div className="w-8 shrink-0 text-right text-sm tabular-nums text-ink">{d.count}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const stats = getStats();
  const leads = listLeads();
  const demand = getDemandSignals();
  const live = isLiveMode();

  return (
    <div className="space-y-6">
      {!live && (
        <div
          className="rounded-lg border px-4 py-2.5 text-sm"
          style={{ borderColor: "var(--status-warning)", color: "var(--status-warning)" }}
        >
          Stub mode — no ANTHROPIC_API_KEY set. Replies use keyword matching so you can demo the full
          loop; set the key to turn on the real AI.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Leads" value={stats.leads} />
        <StatTile label="Hot leads" value={stats.hot} />
        <StatTile label="Need you" value={stats.attention} tone="warn" />
        <StatTile label="Drafts waiting" value={stats.drafts} tone="warn" />
        <StatTile label="Cars in stock" value={stats.inStock} />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">What people are asking for</h2>
        <p className="mb-4 text-xs text-ink-3">
          Unique customers per model — your sourcing signal
        </p>
        <DemandChart data={demand} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Leads</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-ink-3">
            No leads yet. Open the <Link href="/inbox" className="underline">inbox simulator</Link> and
            send a message as a customer.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {leads.map((lead) => {
              const notes = getLeadNotes(lead.id);
              return (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-[var(--accent)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">
                      @{lead.ig_username}
                      {lead.display_name && (
                        <span className="ml-2 text-sm font-normal text-ink-3">{lead.display_name}</span>
                      )}
                    </div>
                    <StageBadge stage={lead.stage} />
                  </div>
                  {lead.needs_attention === 1 && (
                    <div className="mt-2 text-sm" style={{ color: "var(--status-warning)" }}>
                      ⚠ {lead.attention_reason ?? "Needs your attention"}
                    </div>
                  )}
                  <ul className="mt-3 space-y-1 text-sm text-ink-2">
                    {notes.slice(-4).map((n) => (
                      <li key={n.id} className="flex gap-2">
                        <span className="text-ink-3">•</span>
                        <span>{n.content}</span>
                      </li>
                    ))}
                    {notes.length === 0 && <li className="text-ink-3">Nothing recorded yet</li>}
                  </ul>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
