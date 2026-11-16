import { X, ArrowRight, Minus, Plus, AlertCircle, ShoppingBag } from 'lucide-react';
import SafeImage from './SafeImage';

export default function CartSheet({
  isOpen,
  onClose,
  cartItemsList = [],
  cartTotal = 0,
  onUpdateQuantity,
  onPlaceOrder,
  queueCapacityRemaining = 5,
}) {
  if (!isOpen) return null;

  const isBufferFull = queueCapacityRemaining <= 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-sheet-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-8">
        <div className="w-screen max-w-md bg-white shadow-xl flex flex-col border-l border-[#E7E3D9] text-left">
          {/* Header */}
          <div className="p-5 border-b border-[#E7E3D9] flex items-center justify-between">
            <div>
              <h2
                id="cart-sheet-title"
                className="text-lg font-semibold font-body text-[#252A27] tracking-tight"
              >
                Order Summary
              </h2>
              <p className="text-[11px] text-[#747B75] font-mono mt-0.5">
                Target: 5-Slot Bounded Shared Buffer
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#747B75] hover:text-[#252A27] hover:bg-[#FAF8F3] transition-colors cursor-pointer"
              aria-label="Close cart sheet"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Buffer Capacity Warning if Full */}
          {isBufferFull && (
            <div className="bg-[#FCF6EC] border-b border-[#F6DFBD] p-3.5 flex items-start gap-2.5 text-xs text-[#B37122]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B37122]" />
              <div>
                <span className="font-semibold block">Queue is saturated (0/5 slots available)</span>
                <span className="leading-relaxed">
                  Submitting will place this order into the operating system wait queue (<code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded border border-[#F6DFBD]">sem_wait(&amp;empty)</code>) until a kitchen consumer retrieves a ticket.
                </span>
              </div>
            </div>
          )}

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {cartItemsList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#959D96]">
                <ShoppingBag className="w-9 h-9 text-[#C69A52] mb-2 opacity-60" />
                <p className="text-sm font-semibold text-[#252A27] font-body">Your cart is empty</p>
                <p className="text-xs text-[#747B75] mt-1 font-body">
                  Select dishes from the menu to prepare an order.
                </p>
              </div>
            ) : (
              cartItemsList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-[#FAF8F3] rounded-lg border border-[#E7E3D9]"
                >
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-white shrink-0 border border-[#E7E3D9]">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.name}
                      aspectRatio="aspect-square"
                      className="object-cover w-full h-full"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-[#252A27] truncate">
                      {item.name}
                    </h4>
                    <span className="text-xs font-mono font-bold text-[#194D40] block mt-0.5 tabular-nums">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center bg-white rounded-md p-0.5 border border-[#E7E3D9] shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-[#FAF8F3] text-[#252A27] flex items-center justify-center hover:bg-neutral-100 transition-colors cursor-pointer"
                      aria-label={`Decrease ${item.name}`}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold tabular-nums text-[#252A27]">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-[#194D40] text-white flex items-center justify-center hover:bg-[#123A32] transition-colors cursor-pointer"
                      aria-label={`Increase ${item.name}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with Total and Submit Button */}
          {cartItemsList.length > 0 && (
            <div className="p-5 border-t border-[#E7E3D9] bg-[#FAF8F3] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#747B75] font-medium">Subtotal Amount</span>
                <span className="font-mono font-bold text-sm text-[#252A27] tabular-nums">
                  ₹{cartTotal}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  onPlaceOrder();
                  onClose();
                }}
                className="w-full h-11 rounded-lg bg-[#194D40] hover:bg-[#123A32] text-white text-xs font-medium flex items-center justify-center gap-2 transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#C69A52] cursor-pointer shadow-sm"
              >
                <span>Submit Order to Bounded Queue</span>
                <ArrowRight className="w-4 h-4 text-[#C69A52]" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
