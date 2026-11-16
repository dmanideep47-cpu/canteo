import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="w-3.5 h-3.5 text-[#747B75]" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter dishes by name..."
        className="w-full h-9 pl-9 pr-8 bg-white border border-[#E7E3D9] rounded-lg text-xs text-[#252A27] placeholder-[#959D96] focus:outline-none focus:border-[#194D40] focus:ring-1 focus:ring-[#194D40] transition-all font-body"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#747B75] hover:text-[#252A27] cursor-pointer"
          aria-label="Clear search query"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
