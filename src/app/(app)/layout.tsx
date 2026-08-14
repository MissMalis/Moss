import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getSettings } from "@/lib/data/settings";
import { listAccounts } from "@/lib/data/accounts";
import { ensureDemoSeedIfNeeded } from "@/lib/actions/demo";
import { FloatingAskMoss } from "@/components/FloatingAskMoss";
import { NavLinks } from "@/components/NavLinks";
import { MoveMoneyButton } from "@/components/MoveMoneyButton";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/net-worth", label: "Net worth" },
  { href: "/expenses", label: "Expenses" },
  { href: "/income", label: "Income" },
  { href: "/budgets", label: "Budgets" },
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

  // §0: if the demo flag is on but the tables came back empty (a partial
  // wipe, a fresh project), reseed before anything renders — never a
  // permanently-blank app.
  await ensureDemoSeedIfNeeded();
  const [settings, accounts] = await Promise.all([getSettings(), listAccounts()]);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 md:px-10">
          <span className="font-display text-xl font-medium text-ink">moss</span>
          <nav className="flex items-center gap-6 text-[13.5px] text-ink-2">
            <NavLinks items={NAV} />
            <MoveMoneyButton accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
            <form action={signOut}>
              <button type="submit" className="transition hover:text-ink">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      {/* Extra bottom clearance so the last card on a page never sits under the floating Ask Moss button (rev 04 §1.10). */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 pb-28 pt-8 md:px-10">{children}</main>
      <FloatingAskMoss geminiConnected={settings.gemini_key_set} />
    </div>
  );
}
