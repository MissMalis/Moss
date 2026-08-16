import { formatMoney } from "@/lib/format";
import { lucideKey } from "@/lib/icons";

const INVESTABLE_TYPES = new Set(["HSA", "401(k)", "Roth IRA", "Traditional IRA", "Taxable Brokerage"]);
const LOW_STORED_VALUE_THRESHOLD = 10;
// Flag once less than 10% of the limit remains, not just once it's blown past.
const LIMIT_PROXIMITY_FRACTION = 0.1;
const STALE_BALANCE_DAYS = 30;
// Rev 06b §4: a raise usually means a salary change too — nudge for this
// long after the paycheck amount actually changes.
const INCOME_CHANGE_REVIEW_WINDOW_DAYS = 14;

export interface ReviewAccountLike {
  id: string;
  name: string;
  type: string;
  balance: number;
  annual_contribution_limit: number | null;
  min_cash: number | null;
  is_system: boolean;
  balance_updated_at: string | null;
  hasHoldings: boolean;
}

export interface ReviewItem {
  id: string;
  /** "lucide:<key>" — rev 05 §1.2, no emoji anywhere in the UI. */
  icon: string;
  /** Line 1 on Dashboard's Alerts card — the task, e.g. "Update balance". */
  actionLabel: string;
  /** Line 2 — the detail. Never repeats actionLabel (no em-dash joining the two). */
  message: string;
  href: string;
}

function daysSince(fromISO: string, todayISO: string): number {
  const from = new Date(fromISO).getTime();
  const today = new Date(todayISO + "T00:00:00").getTime();
  return Math.floor((today - from) / 86_400_000);
}

/**
 * Rev 02 §6 / Rev 03 dataset: a "Needs review" checklist of things worth a
 * second look, built entirely from state Moss already tracks.
 */
export function buildReviewChecklist(params: {
  accounts: ReviewAccountLike[];
  contributedByAccount: Map<string, number>;
  recentInvestingChargeByAccount: Map<string, number>;
  bufferAccountName: string | null;
  bufferShortBy: number;
  todayISO: string;
  /** Most recent income-amount-change date (created_at), if any. */
  lastIncomeChangeISO?: string | null;
}): ReviewItem[] {
  const items: ReviewItem[] = [];

  // §4: cross-alert — a paycheck change usually means a salary change too,
  // so nudge toward reviewing 401(k) salary/contribution settings on
  // whichever account(s) actually model a match. Keyed by the change's own
  // date so a later raise re-surfaces even if this one was dismissed.
  const has401k = params.accounts.some((a) => a.type === "401(k)");
  if (has401k && params.lastIncomeChangeISO) {
    const daysAgo = daysSince(params.lastIncomeChangeISO, params.todayISO);
    if (daysAgo >= 0 && daysAgo <= INCOME_CHANGE_REVIEW_WINDOW_DAYS) {
      items.push({
        id: `income-changed-${params.lastIncomeChangeISO.slice(0, 10)}`,
        icon: lucideKey("wallet"),
        actionLabel: "Review 401(k) settings",
        message: `Your paycheck amount changed ${daysAgo === 0 ? "today" : `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`} — check salary and contribution % on your 401(k)`,
        href: "/net-worth",
      });
    }
  }

  for (const a of params.accounts) {
    if (INVESTABLE_TYPES.has(a.type)) {
      // A cash sleeve under its configured minimum (default: zero) means a
      // charge against it likely exceeded available cash, which usually
      // means the custodian auto-sold holdings to cover it. Report the
      // actual triggering charge when we know it, not just the shortfall.
      const floor = a.min_cash ?? 0;
      if (a.balance < floor) {
        const trigger = params.recentInvestingChargeByAccount.get(a.id);
        const amount = trigger ?? Math.abs(floor - a.balance);
        items.push({
          id: `oversold-${a.id}`,
          icon: lucideKey("search"),
          actionLabel: "Review holdings",
          message: `A ${formatMoney(amount)} charge on ${a.name} likely triggered an auto-sell`,
          href: `/net-worth/${a.id}`,
        });
      } else if (a.is_system && a.hasHoldings && a.balance > 0) {
        // Un-invested cash sitting in a contribution-fed account with real
        // holdings usually means a contribution landed but hasn't been put
        // to work yet. Only worth surfacing once the cash-sleeve-too-low
        // case above doesn't already apply — that one's more urgent.
        items.push({
          id: `uninvested-${a.id}`,
          icon: lucideKey("leaf"),
          actionLabel: "Review holdings",
          message: `${formatMoney(a.balance)} contributed to your ${a.name} since you last updated positions`,
          href: `/net-worth/${a.id}`,
        });
      }

      // A contribution-fed account whose value depends on a hand-maintained
      // number (a lump balance, or a holding with no public ticker priced
      // manually) only ever reflects reality if it gets refreshed.
      if (a.is_system && a.balance_updated_at) {
        const staleDays = daysSince(a.balance_updated_at, params.todayISO);
        if (staleDays >= STALE_BALANCE_DAYS) {
          items.push({
            id: `stale-balance-${a.id}`,
            icon: lucideKey("refresh-cw"),
            actionLabel: "Update balance",
            message: `Update balance — your ${a.name} lump hasn't been refreshed in ${staleDays} days`,
            href: `/net-worth/${a.id}`,
          });
        }
      }
    }

    if (a.type === "Stored-value" && a.balance < LOW_STORED_VALUE_THRESHOLD) {
      items.push({
        id: `low-stored-${a.id}`,
        icon: lucideKey("credit-card"),
        actionLabel: "Reload",
        message: `Reload — ${a.name} is down to ${formatMoney(a.balance)}`,
        href: "/expenses",
      });
    }

    if (a.annual_contribution_limit) {
      const contributed = params.contributedByAccount.get(a.id) ?? 0;
      const remaining = a.annual_contribution_limit - contributed;
      if (remaining < 0) {
        items.push({
          id: `over-limit-${a.id}`,
          icon: lucideKey("alert-triangle"),
          actionLabel: "Review",
          message: `${a.name} is ${formatMoney(Math.abs(remaining))} over its ${formatMoney(a.annual_contribution_limit)} contribution limit`,
          href: `/net-worth/${a.id}`,
        });
      } else if (remaining <= a.annual_contribution_limit * LIMIT_PROXIMITY_FRACTION) {
        items.push({
          id: `near-limit-${a.id}`,
          icon: lucideKey("trending-up"),
          actionLabel: "Review",
          message: `${a.name} has ${formatMoney(remaining)} left before its contribution limit`,
          href: `/net-worth/${a.id}`,
        });
      }
    }
  }

  if (params.bufferAccountName && params.bufferShortBy > 0) {
    items.push({
      id: "buffer-short",
      icon: lucideKey("arrow-left-right"),
      actionLabel: "Reconcile",
      message: `${params.bufferAccountName} is short ${formatMoney(params.bufferShortBy)} against what's been swept`,
      href: "/sweep",
    });
  }

  return items;
}
