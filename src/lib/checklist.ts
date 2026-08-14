import { formatMoney } from "@/lib/format";

const INVESTABLE_TYPES = new Set(["HSA", "401(k)", "Roth IRA", "Traditional IRA", "Taxable Brokerage"]);
const LOW_STORED_VALUE_THRESHOLD = 10;
// Flag once less than 10% of the limit remains, not just once it's blown past.
const LIMIT_PROXIMITY_FRACTION = 0.1;
const STALE_BALANCE_DAYS = 30;

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
  emoji: string;
  message: string;
  actionLabel: string;
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
}): ReviewItem[] {
  const items: ReviewItem[] = [];

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
          emoji: "🔎",
          message: `A ${formatMoney(amount)} charge on ${a.name} likely triggered an auto-sell`,
          actionLabel: "Review holdings",
          href: `/net-worth/${a.id}`,
        });
      } else if (a.is_system && a.hasHoldings && a.balance > 0) {
        // Un-invested cash sitting in a contribution-fed account with real
        // holdings usually means a contribution landed but hasn't been put
        // to work yet. Only worth surfacing once the cash-sleeve-too-low
        // case above doesn't already apply — that one's more urgent.
        items.push({
          id: `uninvested-${a.id}`,
          emoji: "🌱",
          message: `${formatMoney(a.balance)} contributed to your ${a.name} since you last updated positions`,
          actionLabel: "Review holdings",
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
            emoji: "🔄",
            message: `Update balance — your ${a.name} lump hasn't been refreshed in ${staleDays} days`,
            actionLabel: "Update balance",
            href: `/net-worth/${a.id}`,
          });
        }
      }
    }

    if (a.type === "Stored-value" && a.balance < LOW_STORED_VALUE_THRESHOLD) {
      items.push({
        id: `low-stored-${a.id}`,
        emoji: "💳",
        message: `Reload — ${a.name} is down to ${formatMoney(a.balance)}`,
        actionLabel: "Reload",
        href: "/expenses",
      });
    }

    if (a.annual_contribution_limit) {
      const contributed = params.contributedByAccount.get(a.id) ?? 0;
      const remaining = a.annual_contribution_limit - contributed;
      if (remaining < 0) {
        items.push({
          id: `over-limit-${a.id}`,
          emoji: "⚠️",
          message: `${a.name} is ${formatMoney(Math.abs(remaining))} over its ${formatMoney(a.annual_contribution_limit)} contribution limit`,
          actionLabel: "Review",
          href: `/net-worth/${a.id}`,
        });
      } else if (remaining <= a.annual_contribution_limit * LIMIT_PROXIMITY_FRACTION) {
        items.push({
          id: `near-limit-${a.id}`,
          emoji: "📈",
          message: `${a.name} has ${formatMoney(remaining)} left before its contribution limit`,
          actionLabel: "Review",
          href: `/net-worth/${a.id}`,
        });
      }
    }
  }

  if (params.bufferAccountName && params.bufferShortBy > 0) {
    items.push({
      id: "buffer-short",
      emoji: "🧹",
      message: `${params.bufferAccountName} is short ${formatMoney(params.bufferShortBy)} against what's been swept`,
      actionLabel: "Reconcile",
      href: "/sweep",
    });
  }

  return items;
}
