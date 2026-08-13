import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions/auth";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/net-worth", label: "Net Worth" },
  { href: "/recurring", label: "Recurring" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl text-text">moss</span>
          <nav className="flex items-center gap-6 text-sm text-dim">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-text">
                {item.label}
              </Link>
            ))}
            <form action={signOut}>
              <button type="submit" className="hover:text-text">
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
