// Rev 07 #4/Rev 08 #12: "Paid with" lists the user's actual payable
// accounts with identifying detail (name + masked last4) instead of
// generic payment-source type names. Pure — the account/card rows are
// already fetched by the caller (expenses/page.tsx).

import { formatLast4 } from "@/lib/format";

export type PaymentSource = "checking" | "investing" | "stored_value" | "rewards_card";

export interface PayableAccountLike {
  id: string;
  name: string;
  type: string;
  last4: string | null;
  debit_card_last4: string | null;
  is_forbidden_money: boolean;
}

export interface PayableCardLike {
  id: string;
  name: string;
  last4: string | null;
  account_id: string | null;
}

export interface PayableAccountOption {
  id: string;
  label: string;
  paymentSource: PaymentSource;
  sourceAccountId: string | null;
  cardId: string | null;
}

function mask(last4: string | null): string {
  const masked = formatLast4(last4);
  return masked ? ` ${masked}` : "";
}

/** Only accounts that can actually pay for something — checking/savings, HSA, a linked credit card, or prepaid/transit. */
export function buildPayableAccounts(accounts: PayableAccountLike[], cards: PayableCardLike[]): PayableAccountOption[] {
  const cardByAccountId = new Map(cards.filter((c) => c.account_id).map((c) => [c.account_id!, c]));
  const options: PayableAccountOption[] = [];

  for (const a of accounts) {
    if (a.is_forbidden_money) continue;

    if (a.type === "Checking" || a.type === "Savings" || a.type === "Cash") {
      options.push({ id: a.id, label: `${a.name}${mask(a.last4)}`, paymentSource: "checking", sourceAccountId: a.id, cardId: null });
    } else if (a.type === "HSA") {
      options.push({ id: a.id, label: `${a.name}${mask(a.debit_card_last4)}`, paymentSource: "investing", sourceAccountId: a.id, cardId: null });
    } else if (a.type === "Stored-value") {
      options.push({ id: a.id, label: `${a.name}${mask(a.last4)}`, paymentSource: "stored_value", sourceAccountId: a.id, cardId: null });
    } else if (a.type === "Credit card") {
      const card = cardByAccountId.get(a.id);
      if (card) {
        options.push({ id: a.id, label: `${card.name}${mask(card.last4)}`, paymentSource: "rewards_card", sourceAccountId: null, cardId: card.id });
      }
    }
  }

  return options;
}
