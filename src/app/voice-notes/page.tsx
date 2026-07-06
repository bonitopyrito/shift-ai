import { listVoiceNotes } from "@/lib/db";
import VoiceNoteForm from "@/components/VoiceNoteForm";

export const dynamic = "force-dynamic";

export default function VoiceNotesPage() {
  const notes = listVoiceNotes();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Voice notes</h1>
        <p className="text-sm text-ink-2">
          Talk to the system like you&apos;d talk to an assistant — sold cars, new arrivals, price
          changes, things customers should know. It updates inventory and the AI&apos;s knowledge
          instantly. (Audio transcription plugs in upstream; paste the transcript here for now.)
        </p>
      </div>

      <VoiceNoteForm />

      <section>
        <h2 className="mb-3 text-sm font-semibold">History</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-ink-3">No voice notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((n) => (
              <div key={n.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-3">{n.created_at}</span>
                  <span
                    className="text-xs font-medium"
                    style={{
                      color:
                        n.status === "processed"
                          ? "var(--status-good)"
                          : n.status === "error"
                            ? "var(--status-serious)"
                            : "var(--status-warning)",
                    }}
                  >
                    {n.status}
                  </span>
                </div>
                <p className="mt-2 italic text-ink-2">“{n.transcript}”</p>
                {n.summary && <p className="mt-2 text-ink">{n.summary}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
