import { IconCircle } from "@/components/IconCircle";

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-card-soft px-6 py-10 text-center">
      <IconCircle value={icon} label={title} variant="tinted" size="lg" />
      <p className="text-[14px] text-ink-2">{title}</p>
      {hint && <p className="text-[12.5px] text-ink-3">{hint}</p>}
    </div>
  );
}
