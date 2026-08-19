import { SubNav } from "@/components/SubNav";

// Rev 08 #11: "Log an expense" tab removed — redundant now that
// "+ Log an expense" is a popup button on the bills page itself.
// Rev 09 §1.2: page renamed Transactions, now 4 sub-tabs — Income and
// Budget moved in here (Income was its own top-level nav page; Budget
// used to share the Bills & expenses tab). Bills & expenses stays default.
const TABS = [
  { href: "/expenses", label: "Bills & expenses" },
  { href: "/expenses/income", label: "Income" },
  { href: "/expenses/budget", label: "Budget" },
  { href: "/expenses/categories", label: "Categories" },
];

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-medium text-ink">Transactions</h1>
        <SubNav items={TABS} />
      </div>
      {children}
    </div>
  );
}
