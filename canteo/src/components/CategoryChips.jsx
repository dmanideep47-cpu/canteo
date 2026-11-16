const CATEGORIES = ['All', 'Breakfast', 'Meals', 'Snacks', 'Beverages'];

export default function CategoryChips({ selectedCategory, onSelectCategory }) {
  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
      role="tablist"
      aria-label="Menu categories"
    >
      {CATEGORIES.map((cat) => {
        const isSelected = selectedCategory === cat;
        return (
          <button
            key={cat}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectCategory(cat)}
            className={`h-7 px-3 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
              isSelected
                ? 'bg-[#194D40] text-white font-semibold shadow-2xs'
                : 'bg-white text-[#5A615B] border border-[#E7E3D9] hover:bg-[#FAF8F3] hover:text-[#252A27]'
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
