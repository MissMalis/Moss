"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_TYPES } from "@/lib/data/accounts";
import { computePerCheckEmployerMatch, type PayFreq } from "@/lib/employer-match";

// Rev 06b §2: tax treatment is fixed by account type, not a user choice.
const CONTRIBUTION_TAX_TREATMENT: Record<string, "pre_tax" | "post_tax"> = {
  HSA: "pre_tax",
  "401(k)": "pre_tax",
  "Traditional IRA": "pre_tax",
  "Roth IRA": "post_tax",
};

type AccountType = (typeof ACCOUNT_TYPES)[number];

function isAccountType(value: string): value is AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(value);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

// The user never sees or types this — it's purely the internal link a
// deduction's "posts to" dropdown resolves against (brief rev 02 §2.5).
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Rev 06b §1-2: the wizard's step-2 submit. Creates the account with its
 * type-specific fields, then — best-effort, same pattern as other
 * multi-insert actions in this file — an optional first holding, an
 * optional linked rewards card (Liability + "is a credit card"), and an
 * optional initial contribution (deduction). Returns the new id so the
 * wizard can route straight to the account detail page (§1: "Then → the
 * account detail page").
 */
export async function createAccount(formData: FormData): Promise<{ id: string }> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const balance = Number(formData.get("balance") ?? 0);
  const starting_contributed = Number(formData.get("starting_contributed") ?? 0);
  // Rev 04 §5: no more "Fed by paycheck contributions" checkbox — every
  // account gets a linking key, and whether it's actually contribution-fed
  // is derived live from whether a deduction targets it (see
  // data/today.ts's checklist builder), not a manually-set flag that can
  // drift from reality.
  const system_key = slugify(name);
  const apy_pctRaw = formData.get("apy_pct");
  const apy_pct = apy_pctRaw != null && apy_pctRaw !== "" ? Number(apy_pctRaw) : null;
  const apr_pctRaw = formData.get("apr_pct");
  const apr_pct = apr_pctRaw != null && apr_pctRaw !== "" ? Number(apr_pctRaw) : null;
  const annualLimitRaw = formData.get("annual_contribution_limit");
  const annual_contribution_limit =
    annualLimitRaw != null && annualLimitRaw !== "" ? Number(annualLimitRaw) : null;
  const minCashRaw = formData.get("min_cash");
  const min_cash = minCashRaw != null && minCashRaw !== "" ? Number(minCashRaw) : null;
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const last4 = String(formData.get("last4") ?? "").trim() || null;
  const debit_card_last4 = String(formData.get("debit_card_last4") ?? "").trim() || null;
  const uses_holdings = formData.get("uses_holdings") === "on";
  const lump_cost_basisRaw = formData.get("lump_cost_basis");
  const lump_cost_basis = lump_cost_basisRaw != null && lump_cost_basisRaw !== "" ? Number(lump_cost_basisRaw) : null;
  const salaryRaw = formData.get("salary");
  const salary = salaryRaw != null && salaryRaw !== "" ? Number(salaryRaw) : null;
  const match_tier1_pctRaw = formData.get("match_tier1_pct");
  const match_tier1_pct = match_tier1_pctRaw != null && match_tier1_pctRaw !== "" ? Number(match_tier1_pctRaw) : null;
  const match_tier2_limit_pctRaw = formData.get("match_tier2_limit_pct");
  const match_tier2_limit_pct =
    match_tier2_limit_pctRaw != null && match_tier2_limit_pctRaw !== "" ? Number(match_tier2_limit_pctRaw) : null;
  const match_tier2_rate_pctRaw = formData.get("match_tier2_rate_pct");
  const match_tier2_rate_pct =
    match_tier2_rate_pctRaw != null && match_tier2_rate_pctRaw !== "" ? Number(match_tier2_rate_pctRaw) : null;
  const is_credit_card = formData.get("is_credit_card") === "on";
  const as_ofRaw = String(formData.get("as_of") ?? "");
  const balance_updated_at = as_ofRaw ? new Date(as_ofRaw + "T00:00:00").toISOString() : new Date().toISOString();
  if (!name || !type) throw new Error("Name and type are required");
  if (!isAccountType(type)) throw new Error("Invalid account type");

  const { data: account, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name,
      type,
      balance,
      starting_contributed,
      system_key,
      apy_pct,
      apr_pct,
      annual_contribution_limit,
      min_cash,
      icon,
      last4,
      debit_card_last4,
      uses_holdings,
      lump_cost_basis,
      salary,
      match_tier1_pct,
      match_tier2_limit_pct,
      match_tier2_rate_pct,
      is_credit_card,
      balance_updated_at,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Optional first position (§2: "holdings entry... individual shares").
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (uses_holdings && symbol) {
    const qty = Number(formData.get("qty") ?? 0);
    const cost_basis = Number(formData.get("cost_basis") ?? 0);
    const current_price = Number(formData.get("current_price") ?? 0);
    const buy_date = String(formData.get("buy_date") ?? "") || null;
    await supabase.from("holdings").insert({ user_id: user.id, account_id: account.id, symbol, qty, cost_basis, current_price, buy_date });
  }

  // Optional linked rewards card (Liability + "is it a credit card?").
  if (is_credit_card && type === "Liabilities") {
    const cardLast4 = String(formData.get("card_last4") ?? "").trim() || null;
    const cardNetwork = String(formData.get("card_network") ?? "").trim() || null;
    await supabase.from("cards").insert({
      user_id: user.id,
      account_id: account.id,
      name,
      last4: cardLast4,
      network: cardNetwork,
      color: "#14181C",
      base_multiplier: 1,
    });
  }

  // Optional initial contribution (§2/§5) — tax treatment fixed by type.
  const taxTreatment = CONTRIBUTION_TAX_TREATMENT[type];
  const contributionAmount = Number(formData.get("contribution_amount") ?? 0);
  const income_source_id = String(formData.get("income_source_id") ?? "");
  if (taxTreatment && contributionAmount > 0 && income_source_id) {
    let employer_match = 0;
    if (type === "401(k)" && salary && match_tier1_pct != null && match_tier2_limit_pct != null && match_tier2_rate_pct != null) {
      const { data: source } = await supabase.from("income_sources").select("freq").eq("id", income_source_id).maybeSingle();
      const freq = (source?.freq ?? "biweekly") as PayFreq;
      const contributionPct = Number(formData.get("contribution_pct") ?? 0);
      if (contributionPct > 0) {
        employer_match = computePerCheckEmployerMatch(
          { salaryAnnual: salary, tier1LimitPct: match_tier1_pct, tier2LimitPct: match_tier2_limit_pct, tier2RatePct: match_tier2_rate_pct },
          contributionPct,
          freq,
        );
      }
    }
    await supabase.from("deductions").insert({
      user_id: user.id,
      income_source_id,
      name: `${name} contribution`,
      amount: contributionAmount,
      employer_match,
      target_account_key: system_key,
      tax_treatment: taxTreatment,
    });
  }

  revalidatePath("/net-worth");
  return { id: account.id };
}

export async function updateAccount(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const apy_pctRaw = formData.get("apy_pct");
  const apy_pct = apy_pctRaw != null && apy_pctRaw !== "" ? Number(apy_pctRaw) : null;
  const apr_pctRaw = formData.get("apr_pct");
  const apr_pct = apr_pctRaw != null && apr_pctRaw !== "" ? Number(apr_pctRaw) : null;
  const annualLimitRaw = formData.get("annual_contribution_limit");
  const annual_contribution_limit =
    annualLimitRaw != null && annualLimitRaw !== "" ? Number(annualLimitRaw) : null;
  const minCashRaw = formData.get("min_cash");
  const min_cash = minCashRaw != null && minCashRaw !== "" ? Number(minCashRaw) : null;
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const last4 = String(formData.get("last4") ?? "").trim() || null;
  const debit_card_last4 = String(formData.get("debit_card_last4") ?? "").trim() || null;
  const uses_holdings = formData.get("uses_holdings") === "on";
  const lump_cost_basisRaw = formData.get("lump_cost_basis");
  const lump_cost_basis = lump_cost_basisRaw != null && lump_cost_basisRaw !== "" ? Number(lump_cost_basisRaw) : null;
  const salaryRaw = formData.get("salary");
  const salary = salaryRaw != null && salaryRaw !== "" ? Number(salaryRaw) : null;
  const match_tier1_pctRaw = formData.get("match_tier1_pct");
  const match_tier1_pct = match_tier1_pctRaw != null && match_tier1_pctRaw !== "" ? Number(match_tier1_pctRaw) : null;
  const match_tier2_limit_pctRaw = formData.get("match_tier2_limit_pct");
  const match_tier2_limit_pct =
    match_tier2_limit_pctRaw != null && match_tier2_limit_pctRaw !== "" ? Number(match_tier2_limit_pctRaw) : null;
  const match_tier2_rate_pctRaw = formData.get("match_tier2_rate_pct");
  const match_tier2_rate_pct =
    match_tier2_rate_pctRaw != null && match_tier2_rate_pctRaw !== "" ? Number(match_tier2_rate_pctRaw) : null;
  const is_credit_card = formData.get("is_credit_card") === "on";
  const balance = Number(formData.get("balance") ?? 0);
  const starting_contributed = Number(formData.get("starting_contributed") ?? 0);
  const as_ofRaw = String(formData.get("as_of") ?? "");
  const balance_updated_at = as_ofRaw ? new Date(as_ofRaw + "T00:00:00").toISOString() : new Date().toISOString();
  if (!id || !name || !type) throw new Error("Name and type are required");
  if (!isAccountType(type)) throw new Error("Invalid account type");

  const { error } = await supabase
    .from("accounts")
    .update({
      name,
      type,
      balance,
      starting_contributed,
      balance_updated_at,
      apy_pct,
      apr_pct,
      annual_contribution_limit,
      min_cash,
      icon,
      last4,
      debit_card_last4,
      uses_holdings,
      lump_cost_basis,
      salary,
      match_tier1_pct,
      match_tier2_limit_pct,
      match_tier2_rate_pct,
      is_credit_card,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/net-worth");
}

export async function updateStartingContributed(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const starting_contributed = Number(formData.get("starting_contributed") ?? 0);
  if (!id) throw new Error("Missing account id");

  const { error } = await supabase
    .from("accounts")
    .update({ starting_contributed })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/net-worth");
}

export async function deleteAccount(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing account id");

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/net-worth");
}
