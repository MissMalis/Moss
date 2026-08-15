import { listCategories } from "@/lib/data/recurring";
import { createCategory, updateCategory, deleteCategory } from "@/lib/actions/recurring";
import { IconPicker } from "@/components/IconPicker";
import { IconCircle } from "@/components/IconCircle";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { lucideKey } from "@/lib/icons";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT } from "@/lib/ui";

/** Rev 04 §6/Rev 05 §5: categories get their own page here, since they're used constantly while managing expenses. */
export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <div className={CARD}>
      <p className={CARD_HEADER}>Categories</p>

      {categories.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={lucideKey("tag")} title="No categories yet" hint="Add your first one below." />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <details key={c.id} className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border py-1 pl-2 pr-3 text-[13px] text-ink-2 hover:border-border-strong">
                <IconCircle value={c.emoji} label={c.name} color={c.color} variant="tinted" size="sm" />
                {c.name}
              </summary>
              <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-card p-3 shadow-lg">
                <form action={updateCategory} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <IconPicker name="emoji" label={c.name} defaultValue={c.emoji} />
                  <input name="name" defaultValue={c.name} className={`min-w-0 flex-1 ${INPUT}`} />
                  <button type="submit" className="text-[12.5px] text-ink-2 transition hover:text-ink">
                    Save
                  </button>
                </form>
                <div className="mt-2 flex justify-end">
                  <ConfirmDeleteButton action={deleteCategory} hiddenFields={{ id: c.id }} itemLabel={c.name} variant="link" />
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      <form action={createCategory} className="mt-4 flex items-end gap-2">
        <IconPicker name="emoji" label="New category" />
        <input name="name" placeholder="New category" required className={INPUT} />
        <button type="submit" className={BTN_SOLID}>
          Add category
        </button>
      </form>
    </div>
  );
}
