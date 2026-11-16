import SafeImage from './SafeImage';

export default function QueueSlot({ index, order }) {
  const isOccupied = !!order;
  const slotNumber = String(index + 1).padStart(2, '0');

  if (!isOccupied) {
    return (
      <div className="p-4 flex flex-col items-center justify-center text-center min-h-[148px] bg-white rounded-xl border border-dashed border-[#E7E3D9] text-[#747B75]">
        <span className="font-mono text-[10px] text-[#747B75] mb-2 uppercase tracking-[0.15em] font-medium">
          Slot {slotNumber}
        </span>
        {/* 32px dashed circle */}
        <div className="w-8 h-8 rounded-full border border-dashed border-[#DCE8DF] flex items-center justify-center text-[10px] font-mono text-[#747B75] bg-[#FAF8F3]">
          {slotNumber}
        </div>
        <span className="font-mono text-[11px] text-[#747B75] mt-2 font-medium">
          Empty
        </span>
      </div>
    );
  }

  const firstItem = order.items && order.items[0];
  const itemsCount = order.items ? order.items.reduce((acc, i) => acc + i.quantity, 0) : 1;

  return (
    <div className="p-4 flex flex-col justify-between min-h-[148px] bg-white rounded-xl border border-[#194D40]/30 shadow-2xs text-left transition-all hover:border-[#194D40]">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-mono text-[10px] text-[#194D40] font-bold uppercase tracking-[0.15em]">
            Slot {slotNumber}
          </span>
          <span className="text-[10px] font-mono text-[#B8782E] bg-[#FCF5EC] px-1.5 py-0.5 rounded border border-[#F4DCBE] uppercase tracking-wider font-semibold">
            {order.status || 'WAITING'}
          </span>
        </div>

        {/* 48px photo thumb + mono ID + item title */}
        <div className="flex items-center gap-3 mb-2">
          {firstItem?.imageUrl ? (
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#FAF8F3] shrink-0 border border-[#E7E3D9]">
              <SafeImage
                src={firstItem.imageUrl}
                alt={firstItem.name}
                aspectRatio="aspect-square"
                fallbackText={order.id}
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#FAF8F3] border border-[#E7E3D9] flex items-center justify-center font-mono text-[11px] text-[#252A27] font-semibold shrink-0">
              ORD
            </div>
          )}

          <div className="min-w-0">
            <span className="font-mono font-bold text-xs text-[#252A27] block truncate">
              {order.id}
            </span>
            <span className="text-[11px] text-[#747B75] block truncate font-medium">
              {firstItem ? firstItem.name : 'Food Order'}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-[#E7E3D9] flex items-center justify-between font-mono text-[11px] text-[#747B75] tabular-nums">
        <span>{itemsCount} {itemsCount === 1 ? 'item' : 'items'}</span>
        <span className="font-bold text-[#194D40]">₹{order.total}</span>
      </div>
    </div>
  );
}
