import { SubNav } from "@/components/SubNav";

const TABS = [
  { href: "/expenses", label: "Recurring bills" },
  { href: "/expenses/categories", label: "Categories" },
  { href: "/expenses/log", label: "Log an expense" },
];

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-medium text-ink">Expenses</h1>
        <SubNav items={TABS} />
      </div>
      {children}
    </div>
  );
}
