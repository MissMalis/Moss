import { createClient } from "@/lib/supabase/server";
import { accountGroup } from "@/lib/net-worth";
import type { Database } from "@/lib/database.types";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type HoldingRow = Database["public"]["Tables"]["holdings"]["Row"];

/**
 * Lazily upserts today's per-account snapshot (contributed vs market value)
 * for every account with real market movement to track — same "close on
 * next visit" pattern the build brief uses for pay periods. Cash/liability
 * accounts are skipped: they have no market value of their own.
 *
 * Accepts already-fetched accounts/holdings when the caller has them, so
 * this doesn't re-query data the page is about to fetch again anyway —
 * that duplicate round-trip was a real, measurable chunk of page latency.
 */
export async function ensureSnapshotsForToday(preloaded?: {
  accounts: AccountRow[];
  holdings: HoldingRow[];
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const todayISO = new Date().toISOString().slice(0, 10);

  let accounts: AccountRow[];
  let holdings: HoldingRow[];
  if (preloaded) {
    accounts = preloaded.accounts;
    holdings = preloaded.holdings;
  } else {
    const [{ data: accountsData, error: accErr }, { data: holdingsData, error: holdErr }] =
      await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", user.id),
        supabase.from("holdings").select("*").eq("user_id", user.id),
      ]);
    if (accErr) throw accErr;
    if (holdErr) throw holdErr;
    accounts = accountsData ?? [];
    holdings = holdingsData ?? [];
  }

  const holdingsByAccount = new Map<string, typeof holdings>();
  for (const h of holdings) {
    if (!h.account_id) continue;
    holdingsByAccount.set(h.account_id, [...(holdingsByAccount.get(h.account_id) ?? []), h]);
  }

  const { data: deductions, error: dedErr } = await supabase
    .from("deductions")
    .select("*")
    .eq("user_id", user.id);
  if (dedErr) throw dedErr;

  const { data: payPeriods, error: ppErr } = await supabase
    .from("pay_periods")
    .select("income_source_id")
    .eq("user_id", user.id);
  if (ppErr) throw ppErr;

  const postedCountBySource = new Map<string, number>();
  for (const pp of payPeriods ?? []) {
    if (!pp.income_source_id) continue;
    postedCountBySource.set(
      pp.income_source_id,
      (postedCountBySource.get(pp.income_source_id) ?? 0) + 1,
    );
  }

  const rows: { user_id: string; account_id: string; snapshot_date: string; contributed: number; market_value: number }[] = [];

  for (const account of accounts) {
    const accountHoldings = holdingsByAccount.get(account.id) ?? [];
    const hasHoldings = accountHoldings.length > 0;
    // Rev 04 §5: track anything in the "Investments" group (holdings-
    // bearing types, plus HSA's cash sleeve) rather than trusting the old
    // manually-set is_system flag — Cash/Liabilities don't grow via
    // contributions vs. market movement, so they're skipped either way.
    const trackable = hasHoldings || accountGroup(account.type) === "Investments";
    if (!trackable) continue;

    let marketValue: number;
    let contributed: number;

    if (hasHoldings) {
      // Cash sleeve (balance) + holdings — matches computeNetWorth (net-worth.ts).
      marketValue =
        (account.balance ?? 0) + accountHoldings.reduce((s, h) => s + h.qty * h.current_price, 0);
      contributed =
        (account.starting_contributed ?? 0) +
        accountHoldings.reduce((s, h) => s + h.qty * h.cost_basis, 0);
    } else {
      // System (paycheck-fed) account with no positions: balance is the
      // market value directly; contributed is reconstructed from your own
      // deduction amount (not employer match) times how many pay dates have
      // posted for that income source — deductions aren't versioned, so
      // this assumes today's deduction amount held for all past postings.
      marketValue = account.balance ?? 0;
      const yours = (deductions ?? [])
        .filter((d) => d.target_account_key === account.system_key)
        .reduce((s, d) => s + d.amount * (postedCountBySource.get(d.income_source_id ?? "") ?? 0), 0);
      contributed = (account.starting_contributed ?? 0) + yours;
    }

    rows.push({
      user_id: user.id,
      account_id: account.id,
      snapshot_date: todayISO,
      contributed,
      market_value: marketValue,
    });
  }

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("net_worth_snapshots")
    .upsert(rows, { onConflict: "account_id,snapshot_date" });
  if (error) throw error;
}

export async function listSnapshotsForAccount(accountId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .order("snapshot_date");
  if (error) throw error;
  return data;
}

/** All snapshots for the user, for the portfolio-wide history graph. */
export async function listAllSnapshots() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .select("*")
    .order("snapshot_date");
  if (error) throw error;
  return data;
}
