import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function CaseStudyModal({ isOpen, onClose, onLaunchPrototype }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-study-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[760px] max-h-[85vh] bg-[#FAF7F2] border border-[#E5E2DD] rounded-xl overflow-y-auto p-6 sm:p-10 text-[#111111] animate-in fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-6 border-b border-[#E5E2DD]">
          <div>
            <div className="font-mono-editorial text-[#6B6B6B] mb-2">
              CASE STUDY · ARCHITECTURAL SPECIFICATION
            </div>
            <h2 id="case-study-title" className="font-display text-3xl sm:text-4xl text-[#111111]">
              Modeling Concurrency in a College Canteen
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#E5E2DD] text-[#6B6B6B] hover:text-[#111111] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-6 space-y-6 text-sm md:text-base leading-relaxed text-[#6B6B6B]">
          <div>
            <h3 className="font-body font-semibold text-[#111111] text-lg mb-2">
              The Synchronization Challenge
            </h3>
            <p>
              In computer systems, when multiple processes share memory without coordination, data races occur. The classical Bounded-Buffer Producer-Consumer problem models how producers and consumers synchronize over finite storage.
            </p>
          </div>

          {/* Semaphore Table */}
          <div className="bg-white border border-[#E5E2DD] rounded-xl p-5 space-y-3 font-mono text-xs">
            <div className="font-bold text-[#111111] font-body text-sm">
              State Invariant Matrix (Buffer Capacity = 5)
            </div>
            <div className="grid grid-cols-3 gap-3 text-center border-t border-[#F1EFEA] pt-3">
              <div>
                <span className="text-[#6B6B6B] block">empty</span>
                <span className="text-base font-black text-[#111111]">5</span>
                <span className="text-[10px] text-[#6B6B6B] block">Free slots</span>
              </div>
              <div>
                <span className="text-[#6B6B6B] block">full</span>
                <span className="text-base font-black text-[#111111]">0</span>
                <span className="text-[10px] text-[#6B6B6B] block">Occupied slots</span>
              </div>
              <div>
                <span className="text-[#6B6B6B] block">mutex</span>
                <span className="text-base font-black text-[#D97706]">1</span>
                <span className="text-[10px] text-[#6B6B6B] block">Unlocked</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-body font-semibold text-[#111111] text-lg mb-2">
              Handling Capacity Exceeded (FIFO Blocked Producers)
            </h3>
            <p>
              When a 6th student submits an order while the buffer is saturated, standard software often crashes or silently drops the request. Canteo preserves strict correctness: the order is stored in a deterministic FIFO blocked queue. When kitchen staff dequeue an order, the oldest blocked order is atomically admitted into the queue in the exact same transition.
            </p>
          </div>

          <div>
            <h3 className="font-body font-semibold text-[#111111] text-lg mb-2">
              Race Condition Prevention
            </h3>
            <p>
              The Sync Lab includes an interactive demonstration where two kitchen staff concurrently access a shared order without a mutex lock. The application demonstrates the resulting stale-read update anomaly and contrasts it with synchronized serial execution.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-6 border-t border-[#E5E2DD] flex items-center justify-between">
          <span className="text-xs text-[#6B6B6B]">
            Interactive prototype ready to test.
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-editorial-outline px-4 py-2.5 text-xs font-semibold"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onLaunchPrototype();
              }}
              className="btn-editorial-primary px-5 py-2.5 text-xs font-semibold"
            >
              Launch Prototype
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
