import SafeImage from './SafeImage';

export default function QueueSlot({ index, order }) {
  const isOccupied = !!order;
  const slotNumber = String(index + 1).padStart(2, '0');

  if (!isOccupied) {
    return (
      <div className="p-4 flex flex-col items-center justify-center text-center min-h-[148px] bg-white text-[#6B6B6B]">
        <span className="font-mono text-[10px] text-[#8C8C8C] mb-2 uppercase tracking-[0.15em]">
          Slot {slotNumber}
        </span>
        {/* 32px dashed circle */}
        <div className="w-8 h-8 rounded-full border border-dashed border-[#D5D2CC] flex items-center justify-center text-[10px] font-mono text-[#A3A099]">
          {slotNumber}
        </div>
        <span className="font-mono text-[11px] text-[#A3A099] mt-2">
          Empty
        </span>
      </div>
    );
  }

  const firstItem = order.items && order.items[0];
  const itemsCount = order.items ? order.items.reduce((acc, i) => acc + i.quantity, 0) : 1;

  return (
    <div className="p-4 flex flex-col justify-between min-h-[148px] bg-white text-left transition-colors">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-mono text-[10px] text-[#D97706] font-semibold uppercase tracking-[0.15em]">
            Slot {slotNumber}
          </span>
          <span className="text-[10px] font-mono text-[#D97706] uppercase tracking-wider font-semibold">
            {order.status || 'WAITING'}
          </span>
        </div>

        {/* 48px photo thumb + mono ID + item title */}
        <div className="flex items-center gap-3 mb-2">
          {firstItem?.imageUrl ? (
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#F4EFEA] shrink-0 border border-[#E5E2DD]">
              <SafeImage
                src={firstItem.imageUrl}
                alt={firstItem.name}
                aspectRatio="aspect-square"
                fallbackText={order.id}
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#FAF7F2] border border-[#E5E2DD] flex items-center justify-center font-mono text-[11px] text-[#111111] font-semibold shrink-0">
              ORD
            </div>
          )}

          <div className="min-w-0">
            <span className="font-mono font-semibold text-xs text-[#111111] block truncate">
              {order.id}
            </span>
            <span className="text-[11px] text-[#5E5E5E] block truncate">
              {firstItem ? firstItem.name : 'Food Order'}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-[#F1EFEA] flex items-center justify-between font-mono text-[11px] text-[#6B6B6B] tabular-nums">
        <span>{itemsCount} {itemsCount === 1 ? 'item' : 'items'}</span>
        <span className="font-medium text-[#111111]">₹{order.total}</span>
      </div>
    </div>
  );
}
