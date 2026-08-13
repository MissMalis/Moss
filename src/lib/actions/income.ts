"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/today");
  revalidatePath("/income");
}

// ---- Income sources ----

const FREQS = ["biweekly", "semimonthly", "weekly", "monthly", "one-off"] as const;
type IncomeFreq = (typeof FREQS)[number];

function isIncomeFreq(value: string): value is IncomeFreq {
  return (FREQS as readonly string[]).includes(value);
}

export async function createIncomeSource(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const net_per_check = Number(formData.get("net_per_check") ?? 0);
  const freqRaw = String(formData.get("freq") ?? "");
  const anchor_date = String(formData.get("anchor_date") ?? "") || null;
  const sm_day1 = Number(formData.get("sm_day1") ?? 1);
  const sm_day2 = Number(formData.get("sm_day2") ?? 16);
  if (!name) throw new Error("Name is required");
  if (!isIncomeFreq(freqRaw)) throw new Error("Choose how often this gets paid");

  // biweekly/weekly/one-off reuse anchor_date; monthly reuses sm_day1 as the
  // day of month; semimonthly uses both sm_day1/sm_day2 — see schema.sql.
  if ((freqRaw === "biweekly" || freqRaw === "weekly" || freqRaw === "one-off") && !anchor_date) {
    throw new Error(freqRaw === "one-off" ? "Pick the date it lands" : "Pick an anchor date");
  }

  const { error } = await supabase.from("income_sources").insert({
    user_id: user.id,
    name,
    net_per_check,
    freq: freqRaw,
    anchor_date,
    sm_day1,
    sm_day2,
  });
  if (error) throw error;
  revalidate();
}

export async function deleteIncomeSource(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("income_sources").delete().eq("id", id);
  if (error) throw error;
  revalidate();
}

// ---- Deductions ----

export async function createDeduction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const income_source_id = String(formData.get("income_source_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const employer_match = Number(formData.get("employer_match") ?? 0);
  const target_account_key = String(formData.get("target_account_key") ?? "") || null;
  const tax_treatmentRaw = String(formData.get("tax_treatment") ?? "pre_tax");
  const tax_treatment = tax_treatmentRaw === "post_tax" ? "post_tax" : "pre_tax";
  if (!income_source_id || !name) throw new Error("Income source and name are required");

  const { error } = await supabase.from("deductions").insert({
    user_id: user.id,
    income_source_id,
    name,
    amount,
    employer_match,
    target_account_key,
    tax_treatment,
  });
  if (error) throw error;
  revalidate();
}

export async function deleteDeduction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("deductions").delete().eq("id", id);
  if (error) throw error;
  revalidate();
}

// ---- Purchases (one-off expense log, brief rev 02 §3 payment-source model) ----

const PAYMENT_SOURCES = ["checking", "investing", "stored_value"] as const;
type PaymentSource = (typeof PAYMENT_SOURCES)[number];

function isPaymentSource(value: string): value is PaymentSource {
  return (PAYMENT_SOURCES as readonly string[]).includes(value);
}

/**
 * Checking draws Safe-to-Spend in real time (unchanged). Investing/
 * stored-value spends come out of that account's own balance instead —
 * they never touch Safe-to-Spend. Rewards-card spending has its own entry
 * point (Sweep's "log a card charge"), since it's quarantined differently.
 */
export async function createPurchase(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const spent_on = String(formData.get("spent_on") ?? "") || new Date().toISOString().slice(0, 10);
  const category = String(formData.get("category") ?? "Play");
  const payment_sourceRaw = String(formData.get("payment_source") ?? "checking");
  const payment_source = isPaymentSource(payment_sourceRaw) ? payment_sourceRaw : "checking";
  const source_account_id = String(formData.get("source_account_id") ?? "") || null;
  if (!name || amount <= 0) throw new Error("Name and a positive amount are required");
  if (payment_source !== "checking" && !source_account_id) {
    throw new Error("Pick which account this comes out of");
  }

  const { error } = await supabase.from("purchases").insert({
    user_id: user.id,
    name,
    amount,
    spent_on,
    category,
    payment_source,
    source_account_id,
  });
  if (error) throw error;

  if (source_account_id) {
    const { data: account, error: acctErr } = await supabase
      .from("accounts")
      .select("id, balance")
      .eq("id", source_account_id)
      .maybeSingle();
    if (acctErr) throw acctErr;
    if (account) {
      const { error: updErr } = await supabase
        .from("accounts")
        .update({ balance: (account.balance ?? 0) - amount })
        .eq("id", account.id);
      if (updErr) throw updErr;
    }
  }

  revalidatePath("/today");
  revalidatePath("/expenses");
  revalidatePath("/portfolio");
}

export async function deletePurchase(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");

  const { data: purchase, error: fetchErr } = await supabase
    .from("purchases")
    .select("amount, source_account_id")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const { error } = await supabase.from("purchases").delete().eq("id", id);
  if (error) throw error;

  // Removing a logged investing/stored-value spend puts the money back.
  if (purchase?.source_account_id) {
    const { data: account, error: acctErr } = await supabase
      .from("accounts")
      .select("id, balance")
      .eq("id", purchase.source_account_id)
      .maybeSingle();
    if (acctErr) throw acctErr;
    if (account) {
      const { error: updErr } = await supabase
        .from("accounts")
        .update({ balance: (account.balance ?? 0) + purchase.amount })
        .eq("id", account.id);
      if (updErr) throw updErr;
    }
  }

  revalidatePath("/today");
  revalidatePath("/expenses");
  revalidatePath("/portfolio");
}

/** Funding a stored-value account (transit card, gift card...) from checking — the one Safe-to-Spend hit for that balance. */
export async function loadStoredValue(formData: FormData) {
  const { supabase, user } = await requireUser();
  const account_id = String(formData.get("account_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const spent_on = new Date().toISOString().slice(0, 10);
  if (!account_id || amount <= 0) throw new Error("Pick an account and a positive amount");

  const { data: account, error: acctErr } = await supabase
    .from("accounts")
    .select("id, name, balance")
    .eq("id", account_id)
    .maybeSingle();
  if (acctErr) throw acctErr;
  if (!account) throw new Error("Account not found");

  const { error: purchaseErr } = await supabase.from("purchases").insert({
    user_id: user.id,
    name: `Load ${account.name}`,
    amount,
    spent_on,
    category: "Load",
    payment_source: "checking",
    source_account_id: null,
  });
  if (purchaseErr) throw purchaseErr;

  const { error: updErr } = await supabase
    .from("accounts")
    .update({ balance: (account.balance ?? 0) + amount })
    .eq("id", account.id);
  if (updErr) throw updErr;

  revalidatePath("/today");
  revalidatePath("/expenses");
  revalidatePath("/portfolio");
}

// ---- Paycheck posting (contributions -> net worth, brief §0.5 / §4) ----

export async function postPaycheck(formData: FormData) {
  const { supabase, user } = await requireUser();
  const income_source_id = String(formData.get("income_source_id") ?? "");
  const pay_date = String(formData.get("pay_date") ?? "");
  const window_start = String(formData.get("window_start") ?? "");
  const window_end = String(formData.get("window_end") ?? "");
  const net_income = Number(formData.get("net_income") ?? 0);
  if (!income_source_id || !pay_date) throw new Error("Missing income source or pay date");

  // The (income_source_id, pay_date) unique constraint is the idempotency
  // gate: if this pay date was already posted, the insert conflicts and we
  // skip crediting accounts a second time.
  const { error: insertError } = await supabase.from("pay_periods").insert({
    user_id: user.id,
    income_source_id,
    pay_date,
    window_start,
    window_end,
    net_income,
    closed: false,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return; // already posted
    }
    throw insertError;
  }

  const { data: deductions, error: dedError } = await supabase
    .from("deductions")
    .select("*")
    .eq("income_source_id", income_source_id)
    .not("target_account_key", "is", null);
  if (dedError) throw dedError;

  for (const d of deductions ?? []) {
    if (!d.target_account_key) continue;
    const credit = d.amount + d.employer_match;
    if (credit === 0) continue;

    const { data: account, error: acctErr } = await supabase
      .from("accounts")
      .select("id, balance")
      .eq("system_key", d.target_account_key)
      .maybeSingle();
    if (acctErr) throw acctErr;
    if (!account) continue;

    const { error: updErr } = await supabase
      .from("accounts")
      .update({ balance: (account.balance ?? 0) + credit })
      .eq("id", account.id);
    if (updErr) throw updErr;
  }

  revalidatePath("/today");
  revalidatePath("/portfolio");
}
