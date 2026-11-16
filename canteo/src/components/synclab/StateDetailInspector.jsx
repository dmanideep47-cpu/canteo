import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { validateInvariants } from '../../logic/syncLabEngine';

export default function StateDetailInspector({ syncState }) {
  const inv = validateInvariants(syncState);

  return (
    <div className="bg-white border border-[#DDD9CF] rounded-2xl p-6 space-y-5 text-left shadow-xs font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-[#DDD9CF]">
        <div>
          <h3 className="font-sans font-bold text-sm text-[#172B3A]">
            Technical Registers & Invariant Verification
          </h3>
          <p className="text-xs text-[#647480] mt-0.5">
            Internal POSIX kernel states, wait queues, and mathematical invariant checks
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono font-semibold">
          {inv.isValid ? (
            <span className="text-[#237A57] bg-[#E6F3EA] px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#237A57]/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Invariants Satisfied
            </span>
          ) : (
            <span className="text-[#BC4141] bg-[#FBEAEA] px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#BC4141]/20">
              <AlertTriangle className="w-3.5 h-3.5" /> Invariant Violation
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        {/* Wait Queues */}
        <div className="p-3.5 rounded-xl bg-[#F6F4EE] border border-[#DDD9CF] space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#647480] tracking-wider block">
            FIFO Wait Queues
          </span>
          <div className="space-y-1 text-[#172B3A]">
            <div className="flex justify-between">
              <span className="text-[#647480]">wait(empty):</span>
              <strong className="text-[#E98570]">
                {syncState.waitQueues.empty.length > 0
                  ? `[${syncState.waitQueues.empty.join(', ')}]`
                  : '[] (Empty)'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#647480]">wait(full):</span>
              <strong className="text-[#087F8C]">
                {syncState.waitQueues.full.length > 0
                  ? `[${syncState.waitQueues.full.join(', ')}]`
                  : '[] (Empty)'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#647480]">wait(mutex):</span>
              <strong className="text-[#BC4141]">
                {syncState.waitQueues.mutex.length > 0
                  ? `[${syncState.waitQueues.mutex.join(', ')}]`
                  : '[] (Empty)'}
              </strong>
            </div>
          </div>
        </div>

        {/* Pointer Indices */}
        <div className="p-3.5 rounded-xl bg-[#F6F4EE] border border-[#DDD9CF] space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#647480] tracking-wider block">
            Circular Modulo Indices
          </span>
          <div className="space-y-1 text-[#172B3A]">
            <div className="flex justify-between">
              <span className="text-[#647480]">in pointer:</span>
              <strong className="text-[#E98570]">Index [{syncState.in}]</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#647480]">out pointer:</span>
              <strong className="text-[#087F8C]">Index [{syncState.out}]</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#647480]">in modulo step:</span>
              <span>(in + 1) % 5 = {(syncState.in + 1) % 5}</span>
            </div>
          </div>
        </div>

        {/* Life-cycle Totals */}
        <div className="p-3.5 rounded-xl bg-[#F6F4EE] border border-[#DDD9CF] space-y-2">
          <span className="text-[10px] uppercase font-bold text-[#647480] tracking-wider block">
            Item Flow Totals
          </span>
          <div className="space-y-1 text-[#172B3A]">
            <div className="flex justify-between">
              <span className="text-[#647480]">Items Produced:</span>
              <strong>{syncState.producedItems.length}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#647480]">Items Consumed:</span>
              <strong>{syncState.consumedItems.length}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#647480]">Net In-Flight:</span>
              <strong className="text-[#087F8C]">{syncState.occupancy}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

