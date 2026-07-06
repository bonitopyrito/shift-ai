import { listCars } from "@/lib/db";
import { CarStatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

export default function InventoryPage() {
  const cars = listCars();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Inventory</h1>
        <p className="text-sm text-ink-2">
          What the AI is allowed to talk about. Update it by sending a voice note — “the altima’s
          gone, got an elantra coming thursday at 11,200”.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
              <th className="px-4 py-3 font-medium">Car</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Mileage</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {cars.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">
                  {[c.year, c.make, c.model].filter(Boolean).join(" ")}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {c.price != null ? `$${c.price.toLocaleString()}` : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-ink-2">
                  {c.mileage != null ? `${c.mileage.toLocaleString()} mi` : "—"}
                </td>
                <td className="px-4 py-3">
                  <CarStatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 text-ink-2">{c.notes ?? "—"}</td>
              </tr>
            ))}
            {cars.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-3">
                  No cars yet — add some with a voice note.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
