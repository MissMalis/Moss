// Hand-written to match supabase/schema.sql. Regenerate with
// `supabase gen types typescript` once the project is linked, if preferred.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Row<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      settings: Row<{
        user_id: string;
        bank: string;
        biz_shift: "none" | "prior" | "next";
        cash_app_card_id: string | null;
        gemini_key_set: boolean;
        market_key_set: boolean;
        created_at: string;
      }>;
      accounts: Row<{
        id: string;
        user_id: string;
        name: string;
        type:
          | "Cash"
          | "HYSA"
          | "Stored-value"
          | "HSA"
          | "Roth IRA"
          | "Traditional IRA"
          | "401(k)"
          | "Taxable Brokerage"
          | "Liabilities";
        balance: number;
        is_system: boolean;
        system_key: string | null;
        starting_contributed: number;
        is_forbidden_money: boolean;
        reconciled_balance: number | null;
        apy_pct: number | null;
        annual_contribution_limit: number | null;
        created_at: string;
      }>;
      holdings: Row<{
        id: string;
        user_id: string;
        account_id: string | null;
        symbol: string;
        qty: number;
        cost_basis: number;
        current_price: number;
        buy_date: string | null;
        created_at: string;
      }>;
      income_sources: Row<{
        id: string;
        user_id: string;
        name: string;
        net_per_check: number;
        freq: "biweekly" | "semimonthly" | "weekly" | "monthly" | "one-off";
        anchor_date: string | null;
        sm_day1: number;
        sm_day2: number;
        state: string | null;
        created_at: string;
      }>;
      deductions: Row<{
        id: string;
        user_id: string;
        income_source_id: string | null;
        name: string;
        amount: number;
        employer_match: number;
        target_account_key: string | null;
        tax_treatment: "pre_tax" | "post_tax";
        created_at: string;
      }>;
      categories: Row<{
        id: string;
        user_id: string;
        name: string;
        emoji: string | null;
        sort_order: number;
        created_at: string;
      }>;
      recurring_items: Row<{
        id: string;
        user_id: string;
        name: string;
        category_id: string | null;
        amount: number;
        is_variable: boolean;
        day_of_month: number;
        interval_type: "dom" | "days" | "weeks";
        active: boolean;
        created_at: string;
      }>;
      recurring_occurrences: Row<{
        id: string;
        user_id: string;
        recurring_item_id: string;
        occ_date: string;
        skipped: boolean;
        override_amount: number | null;
        posted: boolean;
        actual_amount: number | null;
        created_at: string;
      }>;
      purchases: Row<{
        id: string;
        user_id: string;
        name: string;
        amount: number;
        spent_on: string;
        category: string;
        payment_source: "checking" | "investing" | "stored_value";
        source_account_id: string | null;
        created_at: string;
      }>;
      pay_periods: Row<{
        id: string;
        user_id: string;
        income_source_id: string | null;
        pay_date: string;
        window_start: string;
        window_end: string;
        net_income: number | null;
        rollover_in: number | null;
        earmarked_total: number | null;
        auto_reserved: number | null;
        purchases_total: number | null;
        safe_to_spend: number | null;
        closed: boolean;
        snapshot: Json | null;
        created_at: string;
      }>;
      net_worth_snapshots: Row<{
        id: string;
        user_id: string;
        account_id: string;
        snapshot_date: string;
        contributed: number;
        market_value: number;
        created_at: string;
      }>;
      cards: Row<{
        id: string;
        user_id: string;
        name: string;
        last4: string | null;
        network: string | null;
        color: string;
        base_multiplier: number;
        created_at: string;
      }>;
      card_category_multipliers: Row<{
        id: string;
        user_id: string;
        card_id: string;
        category_id: string;
        multiplier: number;
        created_at: string;
      }>;
      card_charges: Row<{
        id: string;
        user_id: string;
        card_id: string;
        category_id: string | null;
        name: string;
        amount: number;
        spent_on: string;
        swept: boolean;
        swept_at: string | null;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      set_user_secret: {
        Args: { secret_name: string; secret_value: string };
        Returns: void;
      };
      get_user_secret: {
        Args: { secret_name: string };
        Returns: string | null;
      };
      delete_user_secret: {
        Args: { secret_name: string };
        Returns: void;
      };
    };
  };
}
