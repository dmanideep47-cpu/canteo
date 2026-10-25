import { CATEGORIES } from '../data/menuItems';

export default function CategoryChips({ selectedCategory, onSelectCategory }) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
      role="tablist"
      aria-label="Food Categories"
    >
      {CATEGORIES.map((category) => {
        const isSelected = selectedCategory === category;
        return (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            role="tab"
            aria-selected={isSelected}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border focus:outline-none ${
              isSelected
                ? 'bg-[#111111] text-white border-[#111111]'
                : 'bg-white text-[#6B6B6B] border-[#E5E2DD] hover:border-[#111111] hover:text-[#111111]'
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
