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
  const is_system = formData.get("is_system") === "on";
  const system_key = is_system ? slugify(name) : null;
  const apy_pctRaw = formData.get("apy_pct");
  const apy_pct = apy_pctRaw != null && apy_pctRaw !== "" ? Number(apy_pctRaw) : null;
  const annualLimitRaw = formData.get("annual_contribution_limit");
  const annual_contribution_limit =
    annualLimitRaw != null && annualLimitRaw !== "" ? Number(annualLimitRaw) : null;
  if (!name || !type) throw new Error("Name and type are required");
  if (!isAccountType(type)) throw new Error("Invalid account type");

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name,
    type,
    balance,
    starting_contributed,
    is_system,
    system_key,
    apy_pct,
    annual_contribution_limit,
  });
  if (error) throw error;
  revalidatePath("/portfolio");
}

export async function updateAccountBalance(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const balance = Number(formData.get("balance") ?? 0);
  if (!id) throw new Error("Missing account id");

  const { error } = await supabase.from("accounts").update({ balance }).eq("id", id);
  if (error) throw error;
  revalidatePath("/portfolio");
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
  revalidatePath("/portfolio");
}

export async function deleteAccount(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing account id");

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/portfolio");
}
