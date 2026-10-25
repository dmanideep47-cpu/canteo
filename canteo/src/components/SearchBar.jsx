import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B6B6B]">
        <Search className="w-4 h-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search meals, snacks, beverages..."
        className="w-full pl-10 pr-10 py-2.5 bg-[#FAF7F2] text-sm text-[#111111] placeholder-[#8C8C8C] rounded-full border border-[#E5E2DD] focus:border-[#111111] focus:bg-white focus:outline-none transition-colors"
        aria-label="Search food"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#6B6B6B] hover:text-[#111111]"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
