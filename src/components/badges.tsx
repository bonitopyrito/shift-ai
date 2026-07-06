import type { LeadStage } from "@/lib/types";

const STAGE_STYLES: Record<LeadStage, { label: string; color: string }> = {
  new: { label: "New", color: "var(--text-muted)" },
  engaged: { label: "Engaged", color: "var(--accent)" },
  hot: { label: "Hot", color: "var(--status-warning)" },
  closed: { label: "Closed", color: "var(--status-good)" },
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  const s = STAGE_STYLES[stage] ?? STAGE_STYLES.new;
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color: s.color, borderColor: s.color }}
    >
      {s.label}
    </span>
  );
}

export function CarStatusBadge({ status }: { status: "available" | "incoming" | "sold" }) {
  const map = {
    available: { label: "Available", color: "var(--status-good)" },
    incoming: { label: "Incoming", color: "var(--accent)" },
    sold: { label: "Sold", color: "var(--text-muted)" },
  } as const;
  const s = map[status];
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ color: s.color, borderColor: s.color }}
    >
      {s.label}
    </span>
  );
}
