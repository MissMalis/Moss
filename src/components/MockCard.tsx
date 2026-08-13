export function MockCard({
  name,
  last4,
  network,
  color,
}: {
  name: string;
  last4?: string | null;
  network?: string | null;
  color?: string;
}) {
  return (
    <div
      className="flex h-[150px] w-[240px] flex-col justify-between rounded-2xl p-5 text-bg shadow-none"
      style={{ background: color ?? "#1C1A17" }}
    >
      <div className="flex items-start justify-between">
        <span className="font-display text-[16px] font-medium">moss</span>
        <span className="text-[11px] uppercase tracking-wide opacity-70">{network ?? "card"}</span>
      </div>
      <div>
        <p className="text-[13px] tracking-[0.15em] opacity-80">
          •••• •••• •••• {last4 ?? "----"}
        </p>
        <p className="mt-1 text-[13px]">{name}</p>
      </div>
    </div>
  );
}
