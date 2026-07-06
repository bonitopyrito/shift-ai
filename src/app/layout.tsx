import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shift AI — DM copilot",
  description: "AI that answers a car seller's Instagram DMs in his voice and turns them into a lead dashboard",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/inbox", label: "Inbox simulator" },
  { href: "/queue", label: "Approval queue" },
  { href: "/inventory", label: "Inventory" },
  { href: "/voice-notes", label: "Voice notes" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-base font-semibold tracking-tight">
              Shift<span style={{ color: "var(--accent)" }}>AI</span>
            </Link>
            <nav className="flex flex-wrap gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-ink-2 hover:bg-background hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
