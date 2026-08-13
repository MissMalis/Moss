export function EmptyState({
  emoji,
  title,
  hint,
}: {
  emoji: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-card-soft px-6 py-10 text-center">
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-[14px] text-ink-2">{title}</p>
      {hint && <p className="text-[12.5px] text-ink-3">{hint}</p>}
    </div>
  );
}
