import { listCategories } from "@/lib/data/recurring";
import { createCategory, updateCategory, deleteCategory } from "@/lib/actions/recurring";
import { EmojiPicker } from "@/components/EmojiPicker";
import { IconGlyph } from "@/components/IconGlyph";
import { EmptyState } from "@/components/EmptyState";
import { BTN_SOLID, CARD, CARD_HEADER, INPUT, LINK_QUIET } from "@/lib/ui";

/** Rev 04 §6: categories get their own page here, since they're used constantly while managing expenses. */
export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <div className={CARD}>
      <p className={CARD_HEADER}>Categories</p>

      {categories.length === 0 ? (
        <div className="mt-3">
          <EmptyState emoji="🏷️" title="No categories yet" hint="Add your first one below." />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <details key={c.id} className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[13px] text-ink-2 hover:border-border-strong">
                <IconGlyph value={c.emoji} fallback="🏷️" className="text-[13px]" />
                {c.name}
              </summary>
              <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-card p-3 shadow-lg">
                <form action={updateCategory} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <EmojiPicker name="emoji" defaultValue={c.emoji} />
                  <input name="name" defaultValue={c.name} className={`min-w-0 flex-1 ${INPUT}`} />
                  <button type="submit" className={LINK_QUIET}>
                    Save
                  </button>
                </form>
                <form action={deleteCategory} className="mt-2">
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className={LINK_QUIET}>
                    Remove
                  </button>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}

      <form action={createCategory} className="mt-4 flex items-end gap-2">
        <EmojiPicker name="emoji" />
        <input name="name" placeholder="New category" required className={INPUT} />
        <button type="submit" className={BTN_SOLID}>
          Add category
        </button>
      </form>
    </div>
  );
}
