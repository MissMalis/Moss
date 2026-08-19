import { listCategories } from "@/lib/data/recurring";
import { listPurchasesInRange } from "@/lib/data/income";
import { listBudgets } from "@/lib/data/budgets";
import { computeBudgetProgress } from "@/lib/budgets";
import { BudgetTracker } from "@/components/BudgetTracker";

function currentMonthWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

/**
 * Rev 09 §1.2: Budget moved into its own Transactions sub-tab (was a
 * grid-mate on the Bills & expenses page). Engine still the pre-Rev09
 * checking-purchases-only model here — the consume-the-earmark rewrite
 * (§3) lands as its own pass.
 */
export default async function BudgetTab() {
  const { start, end } = currentMonthWindow();
  const [categories, monthPurchases, budgetRows] = await Promise.all([
    listCategories(),
    listPurchasesInRange(start, end),
    listBudgets(),
  ]);
  const budgetProgress = computeBudgetProgress(budgetRows, monthPurchases);

  return <BudgetTracker budgets={budgetProgress} categories={categories} />;
}
