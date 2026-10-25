import { useEffect } from 'react';
import { X, Plus, Minus, ShoppingBag, ArrowRight, AlertTriangle } from 'lucide-react';
import SafeImage from './SafeImage';

export default function CartSheet({
  isOpen,
  onClose,
  cartItemsList,
  cartTotal,
  onUpdateQuantity,
  onPlaceOrder,
  queueCapacityRemaining,
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isBufferFull = queueCapacityRemaining === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-heading"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[500px] bg-[#FAF7F2] rounded-t-xl sm:rounded-xl p-6 sm:p-8 max-h-[85vh] flex flex-col border border-[#E5E2DD] animate-in slide-in-from-bottom duration-200 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E2DD]">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-4 h-4 text-[#111111]" />
            <h2 id="cart-heading" className="text-lg font-semibold font-body text-[#111111]">
              Your Cart
            </h2>
            <span className="text-[11px] font-mono bg-white border border-[#E5E2DD] text-[#6B6B6B] px-2 py-0.5 rounded-full tabular-nums">
              {cartItemsList.length} {cartItemsList.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#E5E2DD] text-[#6B6B6B] hover:text-[#111111] focus:outline-none"
            aria-label="Close cart"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bounded Queue Availability Banner */}
        <div
          className={`mt-4 p-3 rounded-lg text-xs font-mono flex items-center justify-between border tabular-nums ${
            isBufferFull
              ? 'bg-white text-[#C0392B] border-[#C0392B]'
              : 'bg-white text-[#D97706] border-[#E5E2DD]'
          }`}
        >
          <div className="flex items-center gap-2">
            {isBufferFull && <AlertTriangle className="w-3.5 h-3.5 text-[#C0392B] shrink-0" />}
            <span>
              {isBufferFull
                ? 'Buffer full: order waiting for a free slot'
                : `Buffer capacity free (${queueCapacityRemaining} slots available)`}
            </span>
          </div>
          <span className="font-semibold">{5 - queueCapacityRemaining}/5</span>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto py-4 divide-y divide-[#E5E2DD]">
          {cartItemsList.map(({ item, quantity }) => (
            <div key={item.id} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-[#E5E2DD] bg-[#F1EFEA]">
                  <SafeImage
                    src={item.imageUrl}
                    alt={item.name}
                    aspectRatio="aspect-square"
                    fallbackText={item.name}
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-[#111111] truncate">
                    {item.name}
                  </h4>
                  <p className="text-xs text-[#6B6B6B] font-mono mt-0.5 tabular-nums">
                    ₹{item.price} each · Subtotal: ₹{item.price * quantity}
                  </p>
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center bg-white rounded-full p-0.5 border border-[#E5E2DD] shrink-0">
                <button
                  onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                  className="w-7 h-7 rounded-full bg-[#FAF7F2] text-[#111111] flex items-center justify-center hover:bg-neutral-200 transition-colors focus:outline-none"
                  aria-label={`Decrease ${item.name} quantity`}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 text-center text-xs font-semibold tabular-nums text-[#111111]">
                  {quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                  className="w-7 h-7 rounded-full bg-[#111111] text-white flex items-center justify-center hover:bg-[#1A1A1A] transition-colors focus:outline-none"
                  aria-label={`Increase ${item.name} quantity`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing Subtotals & Place Order Button */}
        <div className="pt-4 border-t border-[#E5E2DD] space-y-3 bg-[#FAF7F2] tabular-nums">
          <div className="flex items-center justify-between text-xs text-[#6B6B6B]">
            <span>Items Subtotal</span>
            <span className="font-mono text-[#111111]">₹{cartTotal}</span>
          </div>
          <div className="flex items-center justify-between text-base font-semibold text-[#111111]">
            <span>Total</span>
            <span className="font-mono text-lg text-[#111111]">₹{cartTotal}</span>
          </div>

          <button
            onClick={() => {
              onPlaceOrder();
              onClose();
            }}
            disabled={cartItemsList.length === 0}
            className="w-full h-12 rounded-full bg-[#111111] hover:bg-[#1A1A1A] text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:pointer-events-none focus:outline-none"
          >
            <span>Place Order</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
