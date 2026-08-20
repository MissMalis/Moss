import { createClient } from "@/lib/supabase/server";
import { lucideKey } from "@/lib/icons";

type Client = Awaited<ReturnType<typeof createClient>>;

const DEBT_PAYMENT_CATEGORY = { name: "Debt payment", emoji: lucideKey("coins"), color: "#8a6a3a" };

/**
 * Rev 10 §6.2: the system category every loan payment (Bill or Move
 * money) files under — a Bill uses the id directly as its category_id;
 * a Move-money paydown never creates a purchase (see createTransfer), so
 * this just guarantees the category itself exists for the Categories
 * page and the ring's transfers-table read to resolve a color/icon
 * against. Created lazily (idempotent upsert) the first time any user
 * makes a liability payment, since it has to exist for every real user,
 * not just the demo seed. `is_system` blocks deletion (see
 * lib/actions/recurring.ts's deleteCategory) so callers can always rely
 * on the name existing once a payment has been made.
 */
export async function ensureDebtPaymentCategory(supabase: Client, userId: string): Promise<{ id: string; name: string }> {
  const { data, error } = await supabase
    .from("categories")
    .upsert(
      { user_id: userId, name: DEBT_PAYMENT_CATEGORY.name, emoji: DEBT_PAYMENT_CATEGORY.emoji, color: DEBT_PAYMENT_CATEGORY.color, is_system: true },
      { onConflict: "user_id,name", ignoreDuplicates: false },
    )
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Rev 10 §5.3: a liability's true balance lives on its sub-loan(s), not
 * `accounts.balance` (same fact already established by Sweep's
 * payOffCard) — pay down the primary (earliest) loan; a liability
 * typically has exactly one, and if it somehow has several the first
 * absorbs the payment. `accounts.balance` is kept in sync too since a
 * couple of read paths (Wallet, the no-loans fallback on the detail page)
 * use it directly.
 */
export async function reduceLiabilityBalance(supabase: Client, liabilityAccountId: string, amount: number): Promise<void> {
  const { data: loans, error: loansErr } = await supabase
    .from("liability_loans")
    .select("id, balance")
    .eq("account_id", liabilityAccountId)
    .order("created_at")
    .limit(1);
  if (loansErr) throw loansErr;
  const primaryLoan = loans?.[0];

  if (primaryLoan) {
    const { error } = await supabase
      .from("liability_loans")
      .update({ balance: Math.max(0, primaryLoan.balance - amount) })
      .eq("id", primaryLoan.id);
    if (error) throw error;
  }

  const { data: account, error: acctErr } = await supabase.from("accounts").select("balance").eq("id", liabilityAccountId).single();
  if (acctErr) throw acctErr;
  const { error: updErr } = await supabase
    .from("accounts")
    .update({ balance: Math.max(0, (account.balance ?? 0) - amount) })
    .eq("id", liabilityAccountId);
  if (updErr) throw updErr;
}
