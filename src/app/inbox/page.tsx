import InboxSimulator from "@/components/InboxSimulator";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Inbox simulator</h1>
        <p className="text-sm text-ink-2">
          A stand-in for real Instagram DMs while Meta app access is pending — same pipeline the
          webhook uses.
        </p>
      </div>
      <InboxSimulator />
    </div>
  );
}
