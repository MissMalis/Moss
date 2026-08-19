import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";
import { getSettings } from "@/lib/data/settings";
import { FloatingAskMoss } from "@/components/FloatingAskMoss";
import { NavLinks } from "@/components/NavLinks";

// Rev 05 §2: Dashboard (renamed from Today), Budgets removed, Move money
// relocated into Net worth (§4) instead of living in the global header.
const NAV = [
  { href: "/today", label: "Dashboard" },
  { href: "/net-worth", label: "Net worth" },
  { href: "/income", label: "Income" },
  { href: "/expenses", label: "Bills & expenses" },
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

  // Rev 05 §0: this used to auto-reseed demo data on every page load if the
  // flag was set but a table came back empty. That's a ~20-step wipe-then-
  // reinsert with no database transaction around it — running it as a side
  // effect of navigation meant a concurrent page render could read the
  // account mid-rewrite (some tables cleared, not yet repopulated) and
  // crash. Recovery is now only ever triggered by the explicit "Load demo
  // data" button (Settings), never silently from a page load.
  const settings = await getSettings();

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 md:px-10">
          <span className="font-display text-xl font-medium text-ink">moss</span>
          <nav className="flex items-center gap-6 text-[13.5px] text-ink-2">
            <NavLinks items={NAV} />
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
