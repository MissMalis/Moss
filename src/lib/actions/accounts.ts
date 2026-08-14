"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_TYPES } from "@/lib/data/accounts";

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

export async function createAccount(formData: FormData) {
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
  if (!name || !type) throw new Error("Name and type are required");
  if (!isAccountType(type)) throw new Error("Invalid account type");

  const { error } = await supabase.from("accounts").insert({
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
    balance_updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  revalidatePath("/net-worth");
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
  if (!id || !name || !type) throw new Error("Name and type are required");
  if (!isAccountType(type)) throw new Error("Invalid account type");

  const { error } = await supabase
    .from("accounts")
    .update({ name, type, apy_pct, apr_pct, annual_contribution_limit, min_cash, icon })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/net-worth");
}

export async function updateAccountBalance(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const balance = Number(formData.get("balance") ?? 0);
  if (!id) throw new Error("Missing account id");

  const { error } = await supabase
    .from("accounts")
    .update({ balance, balance_updated_at: new Date().toISOString() })
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
