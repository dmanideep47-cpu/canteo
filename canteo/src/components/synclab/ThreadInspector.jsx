import { User, ChefHat, Lock, AlertCircle } from 'lucide-react';
import { getThreadInstructions } from '../../logic/syncLabEngine';

export default function ThreadInspector({ syncState, selectedThreadId, onSelectThread }) {
  const threads = Object.values(syncState.threads);
  const activeThread = syncState.threads[selectedThreadId] || threads[0];
  const instructions = getThreadInstructions(activeThread, syncState);
  const currentInstruction = instructions[activeThread?.pc] || null;

  return (
    <div className="bg-[#121214] border border-[#232326] rounded-xl p-5 space-y-4 text-left">
      <div className="flex items-center justify-between pb-2 border-b border-[#232326]">
        <div>
          <h3 className="font-sans font-semibold text-sm text-[#F5F5F4]">
            Thread Execution Registers
          </h3>
          <p className="text-[11px] font-mono text-[#8A8A8E] mt-0.5">
            Individual thread status & local memory
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectThread(t.id)}
              className={`px-2.5 py-1 rounded font-mono text-xs font-semibold transition-all cursor-pointer ${
                selectedThreadId === t.id
                  ? 'bg-[#F59E0B] text-black'
                  : 'bg-[#18181B] text-[#A1A1AA] hover:text-white border border-[#27272A]'
              }`}
            >
              {t.id}
            </button>
          ))}
        </div>
      </div>

      {activeThread ? (
        <div className="space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#161618] border border-[#232326] p-2.5 rounded-lg space-y-1">
              <span className="text-[10px] text-[#8A8A8E] uppercase tracking-wider block">
                Thread Identity
              </span>
              <div className="font-bold text-[#F5F5F4] flex items-center gap-1.5">
                {activeThread.role === 'PRODUCER' ? (
                  <User className="w-3.5 h-3.5 text-[#F59E0B]" />
                ) : (
                  <ChefHat className="w-3.5 h-3.5 text-[#22C55E]" />
                )}
                {activeThread.name}
              </div>
            </div>

            <div className="bg-[#161618] border border-[#232326] p-2.5 rounded-lg space-y-1">
              <span className="text-[10px] text-[#8A8A8E] uppercase tracking-wider block">
                Execution Status
              </span>
              <div
                className={`font-bold flex items-center gap-1.5 ${
                  activeThread.status === 'BLOCKED'
                    ? 'text-[#EF4444]'
                    : activeThread.status === 'RUNNING'
                      ? 'text-[#F59E0B]'
                      : 'text-[#22C55E]'
                }`}
              >
                {activeThread.status === 'BLOCKED' && <Lock className="w-3 h-3 text-[#EF4444]" />}
                {activeThread.status}
              </div>
            </div>
          </div>

          <div className="bg-[#161618] border border-[#232326] p-3 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8A8A8E]">Program Counter (PC):</span>
              <span className="text-[#F59E0B] font-bold">Step {activeThread.pc + 1} / 8</span>
            </div>
            <div className="text-[11px] text-[#F5F5F4] bg-[#121214] p-2 rounded border border-[#27272A]">
              {currentInstruction ? currentInstruction.label : 'Idle'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#161618] border border-[#232326] p-2.5 rounded-lg">
              <span className="text-[10px] text-[#8A8A8E] uppercase tracking-wider block">
                Mutex Lock
              </span>
              <span className="font-bold text-white mt-1 block">
                {syncState.mutexOwner === activeThread.id ? (
                  <span className="text-[#22C55E]">HELD (Owner)</span>
                ) : (
                  <span className="text-[#71717A]">None</span>
                )}
              </span>
            </div>

            <div className="bg-[#161618] border border-[#232326] p-2.5 rounded-lg">
              <span className="text-[10px] text-[#8A8A8E] uppercase tracking-wider block">
                Local Order Item
              </span>
              <span className="font-bold text-white mt-1 block truncate">
                {activeThread.localItem ? (
                  <span className="text-[#F59E0B]">{activeThread.localItem.id}</span>
                ) : (
                  <span className="text-[#71717A]">Empty Register</span>
                )}
              </span>
            </div>
          </div>

          {activeThread.status === 'BLOCKED' && (
            <div className="bg-[#1C1214] border border-[#EF4444]/50 p-2.5 rounded-lg text-[#EF4444] text-[11px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#EF4444]" />
              <div>
                <strong>Suspension Cause:</strong> Thread blocked on{' '}
                <code>sem_wait(&{activeThread.waitingFor})</code>. Waiting for{' '}
                {activeThread.waitingFor === 'empty'
                  ? 'consumer to free a buffer slot'
                  : activeThread.waitingFor === 'full'
                    ? 'producer to publish an order'
                    : 'mutex lock release by ' + syncState.mutexOwner}
                .
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-[#71717A] text-center py-4">No thread selected</div>
      )}
    </div>
  );
}

