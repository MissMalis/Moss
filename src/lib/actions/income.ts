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
  revalidatePath("/settings");
}

// ---- Income sources ----

export async function createIncomeSource(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const net_per_check = Number(formData.get("net_per_check") ?? 0);
  const freq = String(formData.get("freq") ?? "biweekly") as "biweekly" | "semimonthly";
  const anchor_date = String(formData.get("anchor_date") ?? "") || null;
  const sm_day1 = Number(formData.get("sm_day1") ?? 1);
  const sm_day2 = Number(formData.get("sm_day2") ?? 16);
  if (!name) throw new Error("Name is required");

  const { error } = await supabase.from("income_sources").insert({
    user_id: user.id,
    name,
    net_per_check,
    freq,
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
  if (!income_source_id || !name) throw new Error("Income source and name are required");

  const { error } = await supabase.from("deductions").insert({
    user_id: user.id,
    income_source_id,
    name,
    amount,
    employer_match,
    target_account_key,
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

// ---- Purchases (play-money log) ----

export async function createPurchase(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const spent_on = String(formData.get("spent_on") ?? "") || new Date().toISOString().slice(0, 10);
  const category = String(formData.get("category") ?? "Play");
  if (!name || amount <= 0) throw new Error("Name and a positive amount are required");

  const { error } = await supabase
    .from("purchases")
    .insert({ user_id: user.id, name, amount, spent_on, category });
  if (error) throw error;
  revalidatePath("/today");
}

export async function deletePurchase(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("purchases").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/today");
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
  revalidatePath("/net-worth");
}
