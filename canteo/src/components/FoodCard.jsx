import SafeImage from './SafeImage';
import { Plus, Minus } from 'lucide-react';

export default function FoodCard({ item, quantity = 0, onAdd, onUpdateQuantity }) {
  const isAvailable = item.available !== false;

  return (
    <article
      className="canteo-panel group flex flex-col justify-between p-4 bg-white hover:border-[#D6D1C4] transition-all duration-150"
      aria-label={`${item.name} card`}
    >
      <div>
        {/* Proportional 4:3 image with clean fallback */}
        <div className="overflow-hidden rounded-lg mb-3 bg-[#FAF8F3] relative border border-[#E7E3D9]">
          <SafeImage
            src={item.imageUrl}
            alt={item.altText || item.name}
            aspectRatio="aspect-[4/3]"
            className={`transition-all duration-200 ${
              isAvailable
                ? 'group-hover:scale-[1.01]'
                : 'grayscale opacity-50'
            }`}
          />
          {!isAvailable && (
            <div className="absolute inset-0 bg-white/75 backdrop-blur-2xs flex items-center justify-center">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#B7382B] bg-[#FDF2F0] px-2.5 py-1 rounded border border-[#F8CBC6]">
                Unavailable
              </span>
            </div>
          )}
        </div>

        {/* Name, Category, Description */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-[#252A27] font-body tracking-tight leading-snug">
              {item.name}
            </h3>
            {item.category && (
              <span className="text-[10px] font-mono text-[#747B75] uppercase tracking-wider bg-[#FAF8F3] px-2 py-0.5 rounded shrink-0 border border-[#E7E3D9]">
                {item.category}
              </span>
            )}
          </div>
          <p className="text-xs text-[#747B75] line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        </div>
      </div>

      {/* Price & Cart Actions */}
      <div className="pt-3.5 mt-3 border-t border-[#E7E3D9] flex items-center justify-between">
        <div className="tabular-nums">
          <span className="text-sm font-semibold font-mono text-[#194D40]">
            ₹{item.price}
          </span>
        </div>

        <div>
          {quantity > 0 ? (
            <div className="flex items-center bg-[#FAF8F3] rounded-lg p-0.5 border border-[#E7E3D9]">
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                className="w-7 h-7 rounded-md bg-white text-[#252A27] flex items-center justify-center hover:bg-neutral-100 transition-colors focus:outline-none focus:ring-1 focus:ring-[#194D40] cursor-pointer shadow-2xs"
                aria-label={`Decrease ${item.name} quantity`}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-7 text-center text-xs font-semibold tabular-nums text-[#252A27]">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                className="w-7 h-7 rounded-md bg-[#194D40] text-white flex items-center justify-center hover:bg-[#123A32] transition-colors focus:outline-none focus:ring-1 focus:ring-[#C69A52] cursor-pointer shadow-2xs"
                aria-label={`Increase ${item.name} quantity`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!isAvailable}
              onClick={() => onAdd(item)}
              className="h-8 px-3 rounded-lg bg-[#194D40] hover:bg-[#123A32] disabled:bg-[#E7E3D9] disabled:text-[#959D96] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#C69A52] cursor-pointer shadow-2xs"
              aria-label={`Add ${item.name} to order (₹${item.price})`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2]" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
