import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getSettings } from "@/lib/data/settings";
import { FloatingAskMoss } from "@/components/FloatingAskMoss";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/expenses", label: "Expenses" },
  { href: "/income", label: "Income" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/sweep", label: "Sweep" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const settings = await getSettings();

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl font-medium text-ink">moss</span>
          <nav className="flex items-center gap-6 text-[13.5px] text-ink-2">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-ink">
                {item.label}
              </Link>
            ))}
            <form action={signOut}>
              <button type="submit" className="transition hover:text-ink">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
      <FloatingAskMoss geminiConnected={settings.gemini_key_set} />
    </div>
  );
}
