"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_TYPES, LIABILITY_TYPE_SET } from "@/lib/account-types";
import { computePerCheckEmployerMatch, type PayFreq } from "@/lib/employer-match";

// Rev 06b v2 §6: tax treatment is fixed by account type, not a user choice.
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

function numOrNull(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  return raw != null && raw !== "" ? Number(raw) : null;
}

function asOfToISO(formData: FormData): string {
  const raw = String(formData.get("as_of") ?? "");
  return raw ? new Date(raw + "T00:00:00").toISOString() : new Date().toISOString();
}

/** Reads indexed holding-position fields (`symbol_0`, `qty_0`, ...) — the wizard's multi-"Add position" rows (§5). */
function readPositions(formData: FormData): { symbol: string; qty: number; cost_basis: number; current_price: number; buy_date: string | null }[] {
  const count = Number(formData.get("position_count") ?? 0);
  const positions: ReturnType<typeof readPositions> = [];
  for (let i = 0; i < count; i++) {
    const symbol = String(formData.get(`symbol_${i}`) ?? "").trim().toUpperCase();
    if (!symbol) continue;
    positions.push({
      symbol,
      qty: Number(formData.get(`qty_${i}`) ?? 0),
      cost_basis: Number(formData.get(`cost_basis_${i}`) ?? 0),
      current_price: Number(formData.get(`current_price_${i}`) ?? 0),
      buy_date: String(formData.get(`buy_date_${i}`) ?? "") || null,
    });
  }
  return positions;
}

/**
 * Rev 06b v2 §1-5: the wizard's step-2 submit for an ASSET. Creates the
 * account with its type-specific fields, then — best-effort, same pattern
 * as other multi-insert actions in this file — any initial positions
 * (§5: multiple "Add position" rows) and an optional initial contribution
 * (§6/§7). Returns the new id so the wizard can route straight to the
 * account detail page.
 */
export async function createAccount(formData: FormData): Promise<{ id: string }> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const balance = Number(formData.get("balance") ?? 0);
  // §5: in lump mode, "total cost basis" IS the contributed baseline —
  // reuses starting_contributed rather than a parallel field.
  const starting_contributed = Number(formData.get("starting_contributed") ?? 0);
  const system_key = slugify(name);
  const apy_pct = numOrNull(formData, "apy_pct");
  const annual_contribution_limit = numOrNull(formData, "annual_contribution_limit");
  const min_cash = numOrNull(formData, "min_cash");
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const last4 = String(formData.get("last4") ?? "").trim() || null;
  const debit_card_last4 = String(formData.get("debit_card_last4") ?? "").trim() || null;
  const debit_card_network = String(formData.get("debit_card_network") ?? "").trim() || null;
  const uses_holdings = formData.get("uses_holdings") === "on";
  const salary = numOrNull(formData, "salary");
  const match_tier1_pct = numOrNull(formData, "match_tier1_pct");
  const match_tier2_limit_pct = numOrNull(formData, "match_tier2_limit_pct");
  const match_tier2_rate_pct = numOrNull(formData, "match_tier2_rate_pct");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const balance_updated_at = asOfToISO(formData);
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
      annual_contribution_limit,
      min_cash,
      icon,
      institution,
      last4,
      debit_card_last4,
      debit_card_network,
      uses_holdings,
      salary,
      match_tier1_pct,
      match_tier2_limit_pct,
      match_tier2_rate_pct,
      notes,
      balance_updated_at,
    })
    .select("id")
    .single();
  if (error) throw error;

  // §5: any initial positions.
  if (uses_holdings) {
    const positions = readPositions(formData);
    if (positions.length > 0) {
      await supabase.from("holdings").insert(positions.map((p) => ({ user_id: user.id, account_id: account.id, ...p })));
    }
  }

  // §6/§7: optional initial contribution — tax treatment fixed by type.
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
  revalidatePath("/sweep");
  return { id: account.id };
}

/**
 * Rev 06b v2 §1/§4: the liability wizard's step-2 submit. Creates the
 * account, then always one `liability_loans` row (§4: "defaults to a
 * single entry"), then — Credit card only — a linked rewards card
 * (Sweep-selectable; no more "is it a credit card?" toggle, credit card
 * is just its own type now).
 */
export async function createLiabilityAccount(formData: FormData): Promise<{ id: string }> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const balance = Number(formData.get("balance") ?? 0);
  const apr_pct = numOrNull(formData, "apr_pct");
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const termYears = numOrNull(formData, "term_years");
  const loan_term_months = termYears != null ? Math.round(termYears * 12) : null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const balance_updated_at = asOfToISO(formData);
  const system_key = slugify(name);
  if (!name || !type) throw new Error("Name and type are required");
  if (!isAccountType(type) || !LIABILITY_TYPE_SET.has(type)) throw new Error("Invalid liability type");

  const { data: account, error } = await supabase
    .from("accounts")
    .insert({ user_id: user.id, name, type, balance, apr_pct, icon, institution, loan_term_months, notes, balance_updated_at, system_key })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("liability_loans").insert({ user_id: user.id, account_id: account.id, name, balance, apr_pct });

  if (type === "Credit card") {
    const cardLast4 = String(formData.get("last4") ?? "").trim() || null;
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

  revalidatePath("/net-worth");
  revalidatePath("/sweep");
  return { id: account.id };
}

export async function updateAccount(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const as_ofRaw = String(formData.get("as_of") ?? "");
  const balance_updated_at = as_ofRaw ? new Date(as_ofRaw + "T00:00:00").toISOString() : new Date().toISOString();
  if (!id || !name || !type) throw new Error("Name and type are required");
  if (!isAccountType(type)) throw new Error("Invalid account type");

  if (LIABILITY_TYPE_SET.has(type)) {
    const apr_pct = numOrNull(formData, "apr_pct");
    const last4 = String(formData.get("last4") ?? "").trim() || null;
    const termYears = numOrNull(formData, "term_years");
  const loan_term_months = termYears != null ? Math.round(termYears * 12) : null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const { error } = await supabase
      .from("accounts")
      .update({ name, type, icon, institution, apr_pct, last4, loan_term_months, notes, balance_updated_at })
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/net-worth");
    revalidatePath("/sweep");
    return;
  }

  const balance = Number(formData.get("balance") ?? 0);
  const starting_contributed = Number(formData.get("starting_contributed") ?? 0);
  const apy_pct = numOrNull(formData, "apy_pct");
  const annual_contribution_limit = numOrNull(formData, "annual_contribution_limit");
  const min_cash = numOrNull(formData, "min_cash");
  const last4 = String(formData.get("last4") ?? "").trim() || null;
  const debit_card_last4 = String(formData.get("debit_card_last4") ?? "").trim() || null;
  const debit_card_network = String(formData.get("debit_card_network") ?? "").trim() || null;
  const uses_holdings = formData.get("uses_holdings") === "on";
  const salary = numOrNull(formData, "salary");
  const match_tier1_pct = numOrNull(formData, "match_tier1_pct");
  const match_tier2_limit_pct = numOrNull(formData, "match_tier2_limit_pct");
  const match_tier2_rate_pct = numOrNull(formData, "match_tier2_rate_pct");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const { error } = await supabase
    .from("accounts")
    .update({
      name,
      type,
      balance,
      starting_contributed,
      balance_updated_at,
      apy_pct,
      annual_contribution_limit,
      min_cash,
      icon,
      institution,
      last4,
      debit_card_last4,
      debit_card_network,
      uses_holdings,
      salary,
      match_tier1_pct,
      match_tier2_limit_pct,
      match_tier2_rate_pct,
      notes,
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/net-worth");
  revalidatePath("/sweep");
}

export async function deleteAccount(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing account id");

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/net-worth");
  revalidatePath("/sweep");
}
