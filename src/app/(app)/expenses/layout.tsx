import { SubNav } from "@/components/SubNav";

// Rev 08 #11: "Log an expense" tab removed — redundant now that
// "+ Log an expense" is a popup button on the bills page itself.
const TABS = [
  { href: "/expenses", label: "Recurring bills" },
  { href: "/expenses/categories", label: "Categories" },
];

export default function ExpensesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-medium text-ink">Bills & expenses</h1>
        <SubNav items={TABS} />
      </div>
      {children}
    </div>
  );
}
