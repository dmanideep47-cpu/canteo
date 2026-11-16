import { X, AlertOctagon, Cpu } from 'lucide-react';

export default function EventEvidenceModal({ receipt, onClose }) {
  if (!receipt) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans text-left animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[#DDD9CF] rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#DDD9CF] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold bg-[#ECE9E1] text-[#172B3A] px-2 py-0.5 rounded">
                Turn / Step #{receipt.step}
              </span>
              <span
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                  receipt.threadId === 'P1'
                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                    : receipt.threadId === 'P2'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : 'bg-purple-100 text-purple-900 border border-purple-200'
                }`}
              >
                Thread {receipt.threadId}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                  receipt.withMutex
                    ? 'bg-teal-100 text-teal-900 border border-teal-200'
                    : 'bg-amber-100 text-amber-900 border border-amber-200'
                }`}
              >
                {receipt.withMutex ? 'With Mutex' : 'Without Mutex'}
              </span>
            </div>
            <h3 className="text-base font-bold text-[#172B3A] mt-1.5 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#087F8C]" />
              <span>{receipt.label}</span>
            </h3>
            {receipt.desc && <p className="text-xs text-[#647480] mt-0.5">{receipt.desc}</p>}
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#647480] hover:text-[#172B3A] hover:bg-[#ECE9E1] cursor-pointer"
            aria-label="Close evidence receipt"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Blocked / Ineligible Notice */}
        {receipt.executed === false && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-950 text-xs flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-200 px-2 py-0.5 rounded">
              Turn Ineligible / Blocked
            </span>
            <span>Thread was blocked or completed; no instruction executed and state remained unchanged.</span>
          </div>
        )}

        {/* Fault Alert if present */}
        {receipt.isFault && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-rose-950 text-xs flex items-start gap-2.5">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold uppercase tracking-wider block">Critical Race Fault Detected</span>
              <p className="mt-0.5 leading-relaxed">{receipt.explanation}</p>
            </div>
          </div>
        )}

        {/* Explanation */}
        {!receipt.isFault && (
          <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-xl p-3 text-xs leading-relaxed text-[#2D4554]">
            <span className="font-bold text-[#172B3A] block mb-1">Causal Explanation:</span>
            {receipt.explanation}
          </div>
        )}

        {/* State Deltas */}
        {receipt.deltas && receipt.deltas.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#172B3A]">
              Observed State Transitions
            </h4>
            <div className="bg-[#ECE9E1]/50 border border-[#DDD9CF] rounded-xl p-2.5 space-y-1 font-mono text-xs text-[#172B3A]">
              {receipt.deltas.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#087F8C]" />
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Before vs After Snapshots */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-xl p-3 text-xs space-y-1.5">
            <span className="font-bold text-[#647480] text-[10px] uppercase tracking-wider block">
              Before Instruction
            </span>
            {receipt.before?.shared !== undefined && (
              <div className="font-mono text-xs">
                Shared: <span className="font-bold text-[#172B3A]">{receipt.before.shared}</span>
              </div>
            )}
            {receipt.before?.occupancy !== undefined && (
              <div className="font-mono text-xs">
                Occupancy: <span className="font-bold text-[#172B3A]">{receipt.before.occupancy}/5</span>
              </div>
            )}
            {receipt.before?.in !== undefined && (
              <div className="font-mono text-xs">
                IN: {receipt.before.in} | OUT: {receipt.before.out}
              </div>
            )}
            <div className="font-mono text-[11px] text-[#647480]">
              Mutex: {receipt.before?.mutex === 1 ? 'Free (1)' : `Locked by ${receipt.before?.mutexOwner || 'thread'}`}
            </div>
            {receipt.before?.thread && (
              <div className="font-mono text-[11px] text-[#647480]">
                Local Read: {receipt.before.thread.localRead ?? receipt.before.thread.targetSlot ?? 'none'}
              </div>
            )}
          </div>

          <div className="bg-[#F0F8F8] border border-[#A6D6D9] rounded-xl p-3 text-xs space-y-1.5">
            <span className="font-bold text-[#087F8C] text-[10px] uppercase tracking-wider block">
              After Instruction
            </span>
            {receipt.after?.shared !== undefined && (
              <div className="font-mono text-xs">
                Shared: <span className="font-bold text-[#087F8C]">{receipt.after.shared}</span>
              </div>
            )}
            {receipt.after?.occupancy !== undefined && (
              <div className="font-mono text-xs">
                Occupancy: <span className="font-bold text-[#087F8C]">{receipt.after.occupancy}/5</span>
              </div>
            )}
            {receipt.after?.in !== undefined && (
              <div className="font-mono text-xs">
                IN: {receipt.after.in} | OUT: {receipt.after.out}
              </div>
            )}
            <div className="font-mono text-[11px] text-[#647480]">
              Mutex: {receipt.after?.mutex === 1 ? 'Free (1)' : `Locked by ${receipt.after?.mutexOwner || 'thread'}`}
            </div>
            {receipt.after?.thread && (
              <div className="font-mono text-[11px] text-[#087F8C]">
                Local Read: {receipt.after.thread.localRead ?? receipt.after.thread.targetSlot ?? 'none'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#DDD9CF] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#172B3A] text-white text-xs font-semibold rounded-xl hover:bg-[#203a4e] cursor-pointer"
          >
            Dismiss Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

