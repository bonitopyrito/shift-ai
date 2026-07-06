import { listDrafts } from "@/lib/db";
import DraftCard from "@/components/DraftCard";

export const dynamic = "force-dynamic";

export default function QueuePage() {
  const drafts = listDrafts();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Approval queue</h1>
        <p className="text-sm text-ink-2">
          Replies the AI held back — negotiations, trades, anything it wasn&apos;t sure about. Edit if
          you want, then approve or reject.
        </p>
      </div>
      {drafts.length === 0 ? (
        <p className="text-sm text-ink-3">Nothing waiting. The AI is handling it. 🎉</p>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draftId={d.id}
              igUsername={d.ig_username}
              displayName={d.display_name}
              reason={d.draft_reason}
              initialText={d.text}
            />
          ))}
        </div>
      )}
    </div>
  );
}
