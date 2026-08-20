"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { periodsForMonth } from "@/lib/periods";
import { DEFAULT_CATEGORIES, lucideKey } from "@/lib/icons";
import { NET_WORTH_SEED } from "@/lib/demo-net-worth-seed";
import { ensureDebtPaymentCategory } from "@/lib/liability-payments";

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
  for (const path of ["/today", "/net-worth", "/expenses", "/expenses/income", "/expenses/budget", "/sweep", "/history", "/settings"]) {
    revalidatePath(path);
  }
}

// Every table demo data (or a "start clean" wipe) touches. Order matters
// only in that nothing here is actually FK-blocking on delete (accounts/
// cards cascade or SET NULL downstream), so a flat pass is enough.
const DEMO_TABLES = [
  "dismissed_alerts",
  "transfers",
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
  "liability_loans",
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
 * The full realistic demo dataset, force-written for `userId` — doesn't
 * check whether anything already exists first. Only ever called from the
 * explicit "Load demo data" button (rev 05 §0: no more silent auto-reseed
 * from page loads).
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
    { name: "Checking", type: "Checking", balance: 3200, institution: "TD Bank", last4: "4821" },
    { name: "HYSA", type: "HYSA", balance: 11500, apy_pct: 4.25, institution: "Marcus", last4: "7743" },
    { name: "Buffer", type: "Checking", balance: 95, is_forbidden_money: true, icon: lucideKey("wallet"), institution: "TD Bank" },
    { name: "Transit card", type: "Stored-value", balance: 8, icon: lucideKey("train"), institution: "MTA", last4: "3390" },
    {
      name: "HSA",
      type: "HSA",
      balance: 900,
      min_cash: 1000,
      is_system: true,
      system_key: "hsa",
      annual_contribution_limit: 4300,
      balance_updated_at: today.toISOString(),
      institution: "Fidelity",
      debit_card_last4: "6612",
    },
    {
      name: "401(k)",
      type: "401(k)",
      balance: 0,
      is_system: true,
      system_key: "401k",
      annual_contribution_limit: 23500,
      salary: 95000,
      match_tier1_pct: 3,
      match_tier2_rate_pct: 50,
      match_tier2_limit_pct: 5,
      balance_updated_at: daysAgo(today, 35).toISOString(),
      institution: "Fidelity",
    },
    {
      name: "Roth IRA",
      type: "Roth IRA",
      balance: 150,
      is_system: true,
      system_key: "roth_ira",
      balance_updated_at: today.toISOString(),
      institution: "Vanguard",
    },
    { name: "Taxable Brokerage", type: "Taxable Brokerage", balance: 0, institution: "Vanguard", last4: "9058" },
    // last4 matches the linked Amex Gold card below, so the account
    // header and the card both show the same number.
    { name: "Credit card", type: "Credit card", balance: 2400, apr_pct: 22.9, institution: "American Express", last4: "1005" },
    { name: "Car loan", type: "Auto loan", balance: 9800, apr_pct: 6.4, loan_term_months: 60, institution: "Toyota Financial" },
    { name: "Student loans", type: "Student loans", balance: 14500, apr_pct: 5.2, institution: "Navient" },
  ] as const;

  const { data: accounts, error: acctErr } = await supabase
    .from("accounts")
    .insert(accountsToInsert.map((a) => ({ user_id: uid, ...a })))
    .select("id, name");
  if (acctErr) throw acctErr;
  const acctByName = new Map(accounts.map((a) => [a.name, a.id]));

  // §4: every liability gets its sub-loan(s) — Student loans shows the
  // grouped-loans feature (two federal loans rolling up to one blended APR).
  await supabase.from("liability_loans").insert([
    { user_id: uid, account_id: acctByName.get("Credit card"), name: "Credit card", balance: 2400, apr_pct: 22.9 },
    { user_id: uid, account_id: acctByName.get("Car loan"), name: "Car loan", balance: 9800, apr_pct: 6.4 },
    { user_id: uid, account_id: acctByName.get("Student loans"), name: "Federal Loan A", balance: 9500, apr_pct: 5.8 },
    { user_id: uid, account_id: acctByName.get("Student loans"), name: "Federal Loan B", balance: 5000, apr_pct: 4.2 },
  ]);

  await supabase.from("holdings").insert([
    // HSA is cash-sleeve-only in rev 04 (§5) — no holdings row for it.
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

  // ---- Categories (rev 05 §9: the full preloaded default set) ----
  // Rev 09 §0.1: upsert keyed on the (user_id, name) unique constraint —
  // `wipeAllData` above already clears these, but a plain insert isn't
  // idempotent against any other path that might re-run this (a retry, a
  // double-submit), which is exactly how they multiplied. Upsert converges
  // to one row per name no matter how many times this runs.
  const { data: categories, error: catErr } = await supabase
    .from("categories")
    .upsert(
      DEFAULT_CATEGORIES.map((c, i) => ({
        user_id: uid,
        sort_order: i,
        name: c.name,
        emoji: c.icon,
        color: c.color,
      })),
      { onConflict: "user_id,name" },
    )
    .select("id, name");
  if (catErr) throw catErr;
  const catByName = new Map(categories.map((c) => [c.name, c.id]));

  // Rev 10 §6.2: seeded up front (not left to the first real payment)
  // purely so the demo shows the feature working immediately.
  const debtPaymentCategory = await ensureDebtPaymentCategory(supabase, uid);
  catByName.set(debtPaymentCategory.name, debtPaymentCategory.id);

  // ---- Recurring bills (mix of fixed + variable) ----
  const { data: recurring, error: recErr } = await supabase
    .from("recurring_items")
    .insert([
      { user_id: uid, name: "Rent", category_id: catByName.get("Bills"), amount: 1150, day_of_month: 1 },
      {
        // Rev 10 §5.3: a real loan-payment bill — marking it posted also
        // pays down the Car loan liability, same as a Move money paydown.
        user_id: uid,
        name: "Car loan payment",
        category_id: catByName.get("Debt payment"),
        target_liability_account_id: acctByName.get("Car loan"),
        amount: 320,
        day_of_month: 15,
      },
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
        category_id: catByName.get("Groceries"),
        amount: 400,
        is_variable: true,
        day_of_month: 5,
      },
      { user_id: uid, name: "Netflix", category_id: catByName.get("Subscriptions"), amount: 15.49, day_of_month: 20 },
      {
        user_id: uid,
        name: "Amazon Sub&Save",
        category_id: catByName.get("Shopping"),
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
      {
        user_id: uid,
        name: "Amex Gold",
        last4: "1005",
        network: "amex",
        color: "#C9A227",
        base_multiplier: 1,
        icon: lucideKey("credit-card"),
        account_id: acctByName.get("Credit card"),
      },
      { user_id: uid, name: "Chase Freedom", last4: "4242", network: "visa", color: "#0F4C9A", base_multiplier: 1, icon: lucideKey("credit-card") },
    ])
    .select("id, name");
  if (cardErr) throw cardErr;
  const amex = cards.find((c) => c.name === "Amex Gold")!;
  const freedom = cards.find((c) => c.name === "Chase Freedom")!;

  await supabase.from("card_category_multipliers").insert([
    { user_id: uid, card_id: amex.id, category_id: catByName.get("Food"), multiplier: 4 },
    { user_id: uid, card_id: freedom.id, category_id: catByName.get("Shopping"), multiplier: 5 },
  ]);

  // Amex is the channeling/buffer card the mock visual + Sweep point at.
  await supabase.from("settings").upsert(
    { user_id: uid, cash_app_card_id: amex.id, demo_seeded: true },
    { onConflict: "user_id" },
  );

  // ---- Sweep: a couple of pending rewards-card charges — mirrored into
  // purchases too (payment_source: rewards_card), matching what
  // createPurchase does for a real logged charge (rev 04 §7, no double-entry). ----
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
      category_id: catByName.get("Shopping"),
      name: "Amazon order",
      amount: 67.3,
      spent_on: iso(daysAgo(today, 2)),
    },
  ]);
  await supabase.from("purchases").insert([
    {
      user_id: uid,
      name: "Clothes",
      amount: 85,
      spent_on: iso(daysAgo(today, 3)),
      category: "Play",
      payment_source: "rewards_card",
      card_id: amex.id,
    },
    {
      user_id: uid,
      name: "Amazon order",
      amount: 67.3,
      spent_on: iso(daysAgo(today, 2)),
      category: "Shopping",
      payment_source: "rewards_card",
      card_id: freedom.id,
    },
  ]);

  // ---- Market indices (ticker strip — hardcoded/plausible for demo) ----
  await supabase.from("market_indices").insert([
    { user_id: uid, symbol: "DJI", label: "Dow", value: 41235.6, prev_close: 41100.75 },
    { user_id: uid, symbol: "IXIC", label: "Nasdaq", value: 17845.2, prev_close: 17920.5 },
    { user_id: uid, symbol: "SPX", label: "S&P 500", value: 5625.3, prev_close: 5590.1 },
    { user_id: uid, symbol: "RUT", label: "Russell 2000", value: 2215.4, prev_close: 2198.9 },
    { user_id: uid, symbol: "US10Y", label: "10Y", value: 4.28, prev_close: 4.25 },
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

  // ---- A move-money transfer (rev 04 §4) — checking to the transit card, the "reload" pattern ----
  await supabase.from("transfers").insert({
    user_id: uid,
    from_account_id: acctByName.get("Checking"),
    to_account_id: acctByName.get("Transit card"),
    amount: 20,
    transfer_date: iso(daysAgo(today, 9)),
  });

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

  // ---- Net-worth-over-time: HSA keeps its own small monthly series;
  // Checking (cash) and 401(k)/Roth IRA/Taxable Brokerage (invested) get
  // the Rev 10 §2.1 daily series instead — real market-like jitter on the
  // invested sleeve, a step function on contributions, so the shared
  // graph reads as an honest consequence of the portfolio's mix instead
  // of near-straight monthly-interpolated lines. ----
  const hsaSnapshotPlan = { name: "HSA", startContributed: 200, startMarket: 210, endContributed: 850, endMarket: 900 };
  const snapshotRows: {
    user_id: string;
    account_id: string;
    snapshot_date: string;
    contributed: number;
    market_value: number;
  }[] = [];
  const MONTHS_OF_HISTORY = 12;
  {
    const accountId = acctByName.get(hsaSnapshotPlan.name);
    if (accountId) {
      for (let m = MONTHS_OF_HISTORY; m >= 1; m--) {
        const t = 1 - m / MONTHS_OF_HISTORY;
        const date = iso(monthsAgo(today, m));
        snapshotRows.push({
          user_id: uid,
          account_id: accountId,
          snapshot_date: date,
          contributed: Math.round(hsaSnapshotPlan.startContributed + (hsaSnapshotPlan.endContributed - hsaSnapshotPlan.startContributed) * t),
          market_value: Math.round(hsaSnapshotPlan.startMarket + (hsaSnapshotPlan.endMarket - hsaSnapshotPlan.startMarket) * t),
        });
      }
    }
  }

  // Proportional split of the invested sleeve across the three real
  // investment accounts, weighted by their target ending balances — the
  // three shares always sum back to the seed's `invested` figure exactly,
  // so the aggregate graph matches the calibrated series regardless of
  // how the split is weighted, while each account still gets its own
  // coherent (not flat) sparkline.
  const investedWeights: { name: string; weight: number }[] = [
    { name: "401(k)", weight: 42000 },
    { name: "Roth IRA", weight: 150 + 20 * 265 + 45 * 82 },
    { name: "Taxable Brokerage", weight: 15 * 190 + 22 * 265 },
  ];
  const investedWeightTotal = investedWeights.reduce((s, w) => s + w.weight, 0);
  const checkingId = acctByName.get("Checking");
  const investedAccountIds = investedWeights.map((w) => ({ id: acctByName.get(w.name), pct: w.weight / investedWeightTotal }));
  const seedDaysAgo = NET_WORTH_SEED.length - 1;
  NET_WORTH_SEED.forEach(([cash, invested, investedContributed], i) => {
    const date = iso(daysAgo(today, seedDaysAgo - i));
    if (checkingId) {
      snapshotRows.push({ user_id: uid, account_id: checkingId, snapshot_date: date, contributed: cash, market_value: cash });
    }
    for (const acct of investedAccountIds) {
      if (!acct.id) continue;
      snapshotRows.push({
        user_id: uid,
        account_id: acct.id,
        snapshot_date: date,
        contributed: Math.round(investedContributed * acct.pct * 100) / 100,
        market_value: Math.round(invested * acct.pct * 100) / 100,
      });
    }
  });
  if (snapshotRows.length > 0) {
    const { error: snapErr } = await supabase
      .from("net_worth_snapshots")
      .upsert(snapshotRows, { onConflict: "account_id,snapshot_date" });
    if (snapErr) throw snapErr;
  }
}

/**
 * The "Load demo data" button — always force-reseeds, regardless of what's
 * already there. If any single insert fails partway through (network blip,
 * a bad row), the account is left wiped-but-empty rather than half-seeded
 * with dangling references — empty is safe (every screen already has an
 * empty state); half-seeded is what caused the intermittent crash (rev 05
 * §0.1) since a page could read data mid-rewrite. Not a real database
 * transaction (Supabase's REST API doesn't expose one across calls like
 * this), but it removes the worst failure mode.
 */
export async function seedDemoData() {
  const { supabase, user } = await requireUser();
  try {
    await writeDemoDataset(supabase, user.id);
  } catch (err) {
    await wipeAllData(supabase, user.id).catch(() => {});
    throw err;
  }
  revalidateEverything();
}
