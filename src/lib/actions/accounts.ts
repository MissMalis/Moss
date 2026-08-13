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

export async function createAccount(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const balance = Number(formData.get("balance") ?? 0);
  const is_system = formData.get("is_system") === "on";
  const system_key = String(formData.get("system_key") ?? "").trim() || null;
  if (!name || !type) throw new Error("Name and type are required");
  if (!isAccountType(type)) throw new Error("Invalid account type");

  const { error } = await supabase
    .from("accounts")
    .insert({ user_id: user.id, name, type, balance, is_system, system_key });
  if (error) throw error;
  revalidatePath("/net-worth");
}

export async function updateAccountBalance(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const balance = Number(formData.get("balance") ?? 0);
  if (!id) throw new Error("Missing account id");

  const { error } = await supabase.from("accounts").update({ balance }).eq("id", id);
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
