"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { periodsForMonth } from "@/lib/periods";

type Client = Awaited<ReturnType<typeof createClient>>;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function revalidateEverything() {
  for (const path of ["/today", "/net-worth", "/expenses", "/income", "/budgets", "/sweep", "/history", "/settings"]) {
    revalidatePath(path);
  }
}

// Every table demo data (or a "start clean" wipe) touches. Order matters
// only in that nothing here is actually FK-blocking on delete (accounts/
// cards cascade or SET NULL downstream), so a flat pass is enough.
const DEMO_TABLES = [
  "card_charges",
  "card_category_multipliers",
  "cards",
  "budgets",
  "market_indices",
  "purchases",
  "recurring_occurrences",
  "recurring_items",
  "categories",
  "pay_periods",
  "income_amount_versions",
  "deductions",
  "income_sources",
  "net_worth_snapshots",
  "holdings",
  "accounts",
] as const;

async function wipeAllData(supabase: Client, userId: string) {
  for (const table of DEMO_TABLES) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }
}

/**
 * "Start clean before using Moss for real" — wipes every table this user
 * owns and turns the demo flag off, so a stray auto-reseed never fights a
 * deliberately-empty real account.
 */
export async function clearAllData() {
  const { supabase, user } = await requireUser();
  await wipeAllData(supabase, user.id);
  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: user.id, demo_seeded: false }, { onConflict: "user_id" });
  if (error) throw error;
  revalidateEverything();
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(from: Date, n: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

function monthsAgo(from: Date, n: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() - n);
  return d;
}

/**
 * The full realistic Rev 03 §0 dataset, force-written for `userId` —
 * doesn't check whether anything already exists first; `seedDemoData` (the
 * button) and `ensureDemoSeedIfNeeded` (the auto-reseed) both call this
 * after deciding it's time to write.
 */
async function writeDemoDataset(supabase: Client, userId: string) {
  await wipeAllData(supabase, userId);
  const uid = userId;
  const today = new Date();
  const todayISO = iso(today);

  // A recent Friday — biweekly cadence just needs one real payday to walk
  // ±14 days from; it doesn't need to be far in the past.
  const fridayOffset = (today.getDay() + 2) % 7; // getDay(): Fri = 5
  const mostRecentFriday = daysAgo(today, fridayOffset);
  const anchorISO = iso(mostRecentFriday);

  // ---- Income ----
  const { data: lordAbbett, error: incomeErr } = await supabase
    .from("income_sources")
    .insert({
      user_id: uid,
      name: "Lord Abbett",
      net_per_check: 2000,
      freq: "biweekly",
      anchor_date: anchorISO,
      sm_day1: 1,
      sm_day2: 16,
    })
    .select("id")
    .single();
  if (incomeErr) throw incomeErr;

  const { data: freelance, error: freelanceErr } = await supabase
    .from("income_sources")
    .insert({
      user_id: uid,
      name: "Freelance",
      net_per_check: 600,
      freq: "one-off",
      anchor_date: iso(daysAgo(today, 7)),
      sm_day1: 1,
      sm_day2: 16,
    })
    .select("id")
    .single();
  if (freelanceErr) throw freelanceErr;

  await supabase.from("income_amount_versions").insert([
    { user_id: uid, income_source_id: lordAbbett.id, net_per_check: 2000, effective_date: iso(monthsAgo(today, 12)) },
    { user_id: uid, income_source_id: freelance.id, net_per_check: 600, effective_date: iso(daysAgo(today, 7)) },
  ]);

  // ---- Accounts ----
  const accountsToInsert = [
    { name: "Checking", type: "Cash", balance: 3200 },
    { name: "HYSA", type: "HYSA", balance: 11500, apy_pct: 4.25 },
    { name: "Buffer", type: "Cash", balance: 95, is_forbidden_money: true, icon: "🧺" },
    { name: "Transit card", type: "Stored-value", balance: 8, icon: "🚊" },
    {
      name: "HSA",
      type: "HSA",
      balance: 900,
      min_cash: 1000,
      is_system: true,
      system_key: "hsa",
      annual_contribution_limit: 4300,
      balance_updated_at: today.toISOString(),
    },
    {
      name: "401(k)",
      type: "401(k)",
      balance: 0,
      is_system: true,
      system_key: "401k",
      annual_contribution_limit: 23500,
      balance_updated_at: daysAgo(today, 35).toISOString(),
    },
    {
      name: "Roth IRA",
      type: "Roth IRA",
      balance: 150,
      is_system: true,
      system_key: "roth_ira",
      balance_updated_at: today.toISOString(),
    },
    { name: "Taxable Brokerage", type: "Taxable Brokerage", balance: 0 },
    { name: "Credit card", type: "Liabilities", balance: 2400, apr_pct: 22.9 },
    { name: "Car loan", type: "Liabilities", balance: 9800, apr_pct: 6.4 },
    { name: "Student loan", type: "Liabilities", balance: 14500, apr_pct: 5.2 },
  ] as const;

  const { data: accounts, error: acctErr } = await supabase
    .from("accounts")
    .insert(accountsToInsert.map((a) => ({ user_id: uid, ...a })))
    .select("id, name");
  if (acctErr) throw acctErr;
  const acctByName = new Map(accounts.map((a) => [a.name, a.id]));

  await supabase.from("holdings").insert([
    {
      user_id: uid,
      account_id: acctByName.get("HSA"),
      symbol: "VTI",
      qty: 3,
      cost_basis: 240,
      current_price: 265,
      buy_date: iso(monthsAgo(today, 6)),
    },
    // No public ticker — a manually-priced plan fund, the classic "lump"
    // 401(k) holding that only ever updates when you type a new number in.
    {
      user_id: uid,
      account_id: acctByName.get("401(k)"),
      symbol: "PLANFUND",
      qty: 1,
      cost_basis: 30000,
      current_price: 42000,
      buy_date: iso(monthsAgo(today, 24)),
    },
    {
      user_id: uid,
      account_id: acctByName.get("Roth IRA"),
      symbol: "VTI",
      qty: 20,
      cost_basis: 230,
      current_price: 265,
      buy_date: iso(monthsAgo(today, 18)),
    },
    {
      user_id: uid,
      account_id: acctByName.get("Roth IRA"),
      symbol: "SCHD",
      qty: 45,
      cost_basis: 72,
      current_price: 82,
      buy_date: iso(monthsAgo(today, 14)),
    },
    {
      user_id: uid,
      account_id: acctByName.get("Taxable Brokerage"),
      symbol: "AAPL",
      qty: 15,
      cost_basis: 175,
      current_price: 190,
      buy_date: iso(monthsAgo(today, 10)),
    },
    {
      user_id: uid,
      account_id: acctByName.get("Taxable Brokerage"),
      symbol: "VTI",
      qty: 22,
      cost_basis: 230,
      current_price: 265,
      buy_date: iso(monthsAgo(today, 8)),
    },
  ]);

  // ---- Contributions (attached to Lord Abbett) ----
  await supabase.from("deductions").insert([
    {
      user_id: uid,
      income_source_id: lordAbbett.id,
      name: "401(k)",
      amount: 200,
      employer_match: 100,
      target_account_key: "401k",
      tax_treatment: "pre_tax",
    },
    {
      user_id: uid,
      income_source_id: lordAbbett.id,
      name: "HSA",
      amount: 75,
      employer_match: 0,
      target_account_key: "hsa",
      tax_treatment: "pre_tax",
    },
    {
      user_id: uid,
      income_source_id: lordAbbett.id,
      name: "Roth IRA",
      amount: 150,
      employer_match: 0,
      target_account_key: "roth_ira",
      tax_treatment: "post_tax",
    },
  ]);

  // ---- Categories ----
  const categoriesToInsert = [
    { name: "Bills", emoji: "🏠" },
    { name: "Food", emoji: "🍔" },
    { name: "Subscriptions", emoji: "📺" },
    { name: "Amazon", emoji: "📦" },
    { name: "Play", emoji: "🎮" },
    { name: "Transit", emoji: "🚊" },
  ];
  const { data: categories, error: catErr } = await supabase
    .from("categories")
    .insert(categoriesToInsert.map((c, i) => ({ user_id: uid, sort_order: i, ...c })))
    .select("id, name");
  if (catErr) throw catErr;
  const catByName = new Map(categories.map((c) => [c.name, c.id]));

  // ---- Recurring bills (mix of fixed + variable) ----
  const { data: recurring, error: recErr } = await supabase
    .from("recurring_items")
    .insert([
      { user_id: uid, name: "Rent", category_id: catByName.get("Bills"), amount: 1150, day_of_month: 1 },
      {
        user_id: uid,
        name: "PSEG",
        category_id: catByName.get("Bills"),
        amount: 180,
        is_variable: true,
        day_of_month: 12,
      },
      {
        user_id: uid,
        name: "Groceries",
        category_id: catByName.get("Food"),
        amount: 400,
        is_variable: true,
        day_of_month: 5,
      },
      { user_id: uid, name: "Netflix", category_id: catByName.get("Subscriptions"), amount: 15.49, day_of_month: 20 },
      {
        user_id: uid,
        name: "Amazon Sub&Save",
        category_id: catByName.get("Amazon"),
        amount: 42,
        is_variable: true,
        day_of_month: 8,
      },
    ])
    .select("id, name");
  if (recErr) throw recErr;
  const pseg = recurring.find((r) => r.name === "PSEG")!;

  // PSEG's last three actuals — the rolling-average history behind its "est" tag.
  await supabase.from("recurring_occurrences").insert([
    {
      user_id: uid,
      recurring_item_id: pseg.id,
      occ_date: iso(new Date(monthsAgo(today, 1).getFullYear(), monthsAgo(today, 1).getMonth(), 12)),
      posted: true,
      actual_amount: 174,
    },
    {
      user_id: uid,
      recurring_item_id: pseg.id,
      occ_date: iso(new Date(monthsAgo(today, 2).getFullYear(), monthsAgo(today, 2).getMonth(), 12)),
      posted: true,
      actual_amount: 168,
    },
    {
      user_id: uid,
      recurring_item_id: pseg.id,
      occ_date: iso(new Date(monthsAgo(today, 3).getFullYear(), monthsAgo(today, 3).getMonth(), 12)),
      posted: true,
      actual_amount: 150,
    },
  ]);

  // ---- Cards (rewards + one channeling/buffer card) ----
  const { data: cards, error: cardErr } = await supabase
    .from("cards")
    .insert([
      { user_id: uid, name: "Amex Gold", last4: "1005", network: "amex", color: "#C9A227", base_multiplier: 1, icon: "🥇" },
      { user_id: uid, name: "Chase Freedom", last4: "4242", network: "visa", color: "#0F4C9A", base_multiplier: 1, icon: "❄️" },
    ])
    .select("id, name");
  if (cardErr) throw cardErr;
  const amex = cards.find((c) => c.name === "Amex Gold")!;
  const freedom = cards.find((c) => c.name === "Chase Freedom")!;

  await supabase.from("card_category_multipliers").insert([
    { user_id: uid, card_id: amex.id, category_id: catByName.get("Food"), multiplier: 4 },
    { user_id: uid, card_id: freedom.id, category_id: catByName.get("Amazon"), multiplier: 5 },
  ]);

  // Amex is the channeling/buffer card the mock visual + Sweep point at.
  await supabase.from("settings").upsert(
    { user_id: uid, cash_app_card_id: amex.id, demo_seeded: true },
    { onConflict: "user_id" },
  );

  // ---- Sweep: a couple of pending rewards-card charges ----
  await supabase.from("card_charges").insert([
    {
      user_id: uid,
      card_id: amex.id,
      category_id: catByName.get("Play"),
      name: "Clothes",
      amount: 85,
      spent_on: iso(daysAgo(today, 3)),
    },
    {
      user_id: uid,
      card_id: freedom.id,
      category_id: catByName.get("Amazon"),
      name: "Amazon order",
      amount: 67.3,
      spent_on: iso(daysAgo(today, 2)),
    },
  ]);

  // ---- Budgets ----
  await supabase.from("budgets").insert([
    { user_id: uid, category: "Food", cap_amount: 200 },
    { user_id: uid, category: "Play", cap_amount: 150 },
  ]);

  // ---- Market indices (ticker strip — hardcoded/plausible for demo) ----
  await supabase.from("market_indices").insert([
    { user_id: uid, symbol: "SPX", label: "S&P 500", value: 5625.3, prev_close: 5590.1 },
    { user_id: uid, symbol: "IXIC", label: "Nasdaq", value: 17845.2, prev_close: 17920.5 },
    { user_id: uid, symbol: "DJI", label: "Dow", value: 41235.6, prev_close: 41100.75 },
  ]);

  // ---- One-off expenses, on different payment sources (tests the routing) ----
  await supabase.from("purchases").insert([
    { user_id: uid, name: "Dinner", amount: 38, spent_on: iso(daysAgo(today, 1)), category: "Food", payment_source: "checking" },
    { user_id: uid, name: "Coffee", amount: 5.5, spent_on: todayISO, category: "Food", payment_source: "checking" },
    { user_id: uid, name: "Movie night", amount: 22, spent_on: iso(daysAgo(today, 2)), category: "Play", payment_source: "checking" },
    {
      user_id: uid,
      name: "Prescription",
      amount: 60,
      spent_on: iso(daysAgo(today, 4)),
      category: "Bills",
      payment_source: "investing",
      source_account_id: acctByName.get("HSA"),
    },
    ...[0, 2, 5, 8].map((n) => ({
      user_id: uid,
      name: "Subway ride",
      amount: 2.9,
      spent_on: iso(daysAgo(today, n)),
      category: "Transit",
      payment_source: "stored_value" as const,
      source_account_id: acctByName.get("Transit card"),
    })),
  ]);

  // ---- Freelance's one-off payment, as its own frozen "pay period" so it shows up in Recent ----
  const freelanceDate = iso(daysAgo(today, 7));
  await supabase.from("pay_periods").insert({
    user_id: uid,
    income_source_id: freelance.id,
    pay_date: freelanceDate,
    window_start: freelanceDate,
    window_end: freelanceDate,
    net_income: 600,
    rollover_in: 0,
    earmarked_total: 0,
    auto_reserved: 0,
    purchases_total: 0,
    safe_to_spend: 600,
    closed: true,
    snapshot: { earmarked: [], purchases: [] },
  });

  // ---- History: ~6 months of closed biweekly Lord Abbett periods ----
  const historyWindows = Array.from({ length: 7 }, (_, i) => periodsForMonth(
    { freq: "biweekly", anchor: anchorISO },
    monthsAgo(today, i).getFullYear(),
    monthsAgo(today, i).getMonth(),
  ))
    .flat()
    .filter((w, i, arr) => arr.findIndex((x) => x.payDate === w.payDate) === i)
    .filter((w) => w.end < todayISO)
    .sort((a, b) => a.payDate.localeCompare(b.payDate))
    .slice(-10);

  let rollover = 0;
  const closedRows = historyWindows.map((w, i) => {
    const income_amt = 2000;
    const earmarked = 550 + (i % 3) * 60; // varies a bit period to period, still plausible
    const purchases = 140 + Math.round(Math.random() * 90);
    const sts = income_amt + rollover - earmarked - purchases;
    const row = {
      user_id: uid,
      income_source_id: lordAbbett.id,
      pay_date: w.payDate,
      window_start: w.start,
      window_end: w.end,
      net_income: income_amt,
      rollover_in: rollover,
      earmarked_total: earmarked,
      auto_reserved: 0,
      purchases_total: purchases,
      safe_to_spend: sts,
      closed: true,
      snapshot: {
        earmarked: [{ name: "Rent", occDate: w.start, amount: earmarked }],
        purchases: [{ name: "Groceries", amount: purchases, spent_on: w.start, category: "Food" }],
      },
    };
    rollover = Math.max(0, sts);
    return row;
  });
  if (closedRows.length > 0) {
    const { error: payErr } = await supabase.from("pay_periods").insert(closedRows);
    if (payErr) throw payErr;
  }

  // ---- Net-worth-over-time: ~12 monthly snapshots per investable account ----
  const snapshotPlan: { name: string; startContributed: number; startMarket: number; endContributed: number; endMarket: number }[] = [
    { name: "HSA", startContributed: 200, startMarket: 250, endContributed: 720, endMarket: 900 + 3 * 265 },
    { name: "401(k)", startContributed: 24000, startMarket: 33000, endContributed: 30000, endMarket: 42000 },
    { name: "Roth IRA", startContributed: 6800, startMarket: 7400, endContributed: 8990, endMarket: 150 + 20 * 265 + 45 * 82 },
    { name: "Taxable Brokerage", startContributed: 5900, startMarket: 6300, endContributed: 6375, endMarket: 15 * 190 + 22 * 265 },
  ];
  const snapshotRows: {
    user_id: string;
    account_id: string;
    snapshot_date: string;
    contributed: number;
    market_value: number;
  }[] = [];
  const MONTHS_OF_HISTORY = 12;
  for (const plan of snapshotPlan) {
    const accountId = acctByName.get(plan.name);
    if (!accountId) continue;
    for (let m = MONTHS_OF_HISTORY; m >= 1; m--) {
      const t = 1 - m / MONTHS_OF_HISTORY; // 0 at the oldest point, ~1 near today
      const date = iso(monthsAgo(today, m));
      snapshotRows.push({
        user_id: uid,
        account_id: accountId,
        snapshot_date: date,
        contributed: Math.round(plan.startContributed + (plan.endContributed - plan.startContributed) * t),
        market_value: Math.round(plan.startMarket + (plan.endMarket - plan.startMarket) * t),
      });
    }
  }
  if (snapshotRows.length > 0) {
    const { error: snapErr } = await supabase
      .from("net_worth_snapshots")
      .upsert(snapshotRows, { onConflict: "account_id,snapshot_date" });
    if (snapErr) throw snapErr;
  }
}

/** The "Load demo data" button — always force-reseeds, regardless of what's already there. */
export async function seedDemoData() {
  const { supabase, user } = await requireUser();
  await writeDemoDataset(supabase, user.id);
  revalidateEverything();
}

/**
 * Auto-run on page load if the demo flag is on but the tables are empty —
 * covers the case where an earlier partial wipe (or a fresh Supabase
 * project the flag survived from) leaves the app looking permanently
 * blank instead of just re-seeding.
 */
export async function ensureDemoSeedIfNeeded() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: settingsRow } = await supabase
    .from("settings")
    .select("demo_seeded")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!settingsRow?.demo_seeded) return;

  const { count } = await supabase
    .from("income_sources")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (count && count > 0) return;

  await writeDemoDataset(supabase, user.id);
}
