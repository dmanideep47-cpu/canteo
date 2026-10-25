import SafeImage from './SafeImage';
import { Plus, Minus } from 'lucide-react';

export default function FoodCard({ item, quantity = 0, onAdd, onUpdateQuantity }) {
  return (
    <div className="flex flex-col justify-between group">
      <div>
        {/* Image with rounded-xl, hover brightness 0.95 */}
        <div className="overflow-hidden rounded-xl mb-3.5 bg-[#F4EFEA]">
          <SafeImage
            src={item.imageUrl}
            alt={item.altText || item.name}
            aspectRatio="aspect-[4/3]"
            className="transition-all duration-300 group-hover:brightness-95 group-hover:scale-[1.02]"
            fallbackText={item.name}
          />
        </div>

        {/* Name and Price */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 text-left">
            <h3 className="text-[16px] font-semibold text-[#111111] font-body tracking-tight leading-snug">
              {item.name}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-normal text-[#6B6B6B] tabular-nums font-body">
                ₹{item.price}
              </span>
              <span className="text-[#E5E2DD]">·</span>
              <span className="text-[12px] font-mono text-[#8C8C8C]">
                {item.prepTime}
              </span>
            </div>
          </div>

          {/* Add Action: 40px Black Circle with White Plus */}
          <div className="shrink-0 pt-0.5">
            {quantity > 0 ? (
              <div className="flex items-center bg-white rounded-full p-0.5 border border-[#E5E2DD]">
                <button
                  onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                  className="w-8 h-8 rounded-full bg-[#FAF7F2] text-[#111111] flex items-center justify-center hover:bg-neutral-100 transition-colors focus:outline-none"
                  aria-label={`Decrease ${item.name} quantity`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-7 text-center text-xs font-semibold tabular-nums text-[#111111]">
                  {quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                  className="w-8 h-8 rounded-full bg-[#111111] text-white flex items-center justify-center hover:bg-[#1A1A1A] transition-colors focus:outline-none"
                  aria-label={`Increase ${item.name} quantity`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onAdd(item)}
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-[#111111] text-white flex items-center justify-center hover:bg-[#1A1A1A] transition-transform active:scale-[0.98] focus:outline-none"
                aria-label={`Add ${item.name} to cart (₹${item.price})`}
              >
                <Plus className="w-4 h-4 stroke-[2]" />
              </button>
            )}
          </div>
        </div>

        {/* Minimal one-line description */}
        <p className="text-[13px] text-[#5E5E5E] leading-relaxed line-clamp-2 mt-1.5 text-left">
          {item.description}
        </p>
      </div>
    </div>
  );
}
