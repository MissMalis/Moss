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

/** Rev 06b v2 §4: grouped liability sub-loans — same pattern as holdings, but for debt. */
export async function createLiabilityLoan(formData: FormData) {
  const { supabase, user } = await requireUser();
  const account_id = String(formData.get("account_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const balance = Number(formData.get("balance") ?? 0);
  const apr_pctRaw = formData.get("apr_pct");
  const apr_pct = apr_pctRaw != null && apr_pctRaw !== "" ? Number(apr_pctRaw) : null;
  if (!account_id || !name) throw new Error("Account and name are required");

  const { error } = await supabase.from("liability_loans").insert({ user_id: user.id, account_id, name, balance, apr_pct });
  if (error) throw error;
  revalidatePath("/net-worth");
}

export async function updateLiabilityLoan(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const balance = Number(formData.get("balance") ?? 0);
  const apr_pctRaw = formData.get("apr_pct");
  const apr_pct = apr_pctRaw != null && apr_pctRaw !== "" ? Number(apr_pctRaw) : null;
  if (!id || !name) throw new Error("Name is required");

  const { error } = await supabase.from("liability_loans").update({ name, balance, apr_pct }).eq("id", id);
  if (error) throw error;
  revalidatePath("/net-worth");
}

export async function deleteLiabilityLoan(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing loan id");

  const { error } = await supabase.from("liability_loans").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/net-worth");
}
