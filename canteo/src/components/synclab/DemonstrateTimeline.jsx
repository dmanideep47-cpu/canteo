import { Clock } from 'lucide-react';

export default function DemonstrateTimeline({
  events = [],
  selectedStep = null,
  onSelectStep = () => {},
  totalExpectedSteps = 6,
}) {
  // Sort events by step number ascending
  const chronological = [...events].sort((a, b) => a.step - b.step);

  return (
    <div className="bg-white border border-[#DDD9CF] rounded-2xl p-4 sm:p-5 space-y-3 font-sans text-left shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDD9CF]/80 pb-2.5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#172B3A] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#087F8C]" />
            <span>Deterministic Thread Execution Timeline</span>
          </h4>
          <p className="text-[11px] text-[#647480] mt-0.5">
            Committed instruction order across threads. Click any step to inspect its exact before/after state proof.
          </p>
        </div>
        <div className="text-[11px] font-mono text-[#647480]">
          Committed Steps: <span className="font-bold text-[#172B3A]">{chronological.length}</span>
          {totalExpectedSteps && ` / ${totalExpectedSteps}`}
        </div>
      </div>

      {chronological.length === 0 ? (
        <div className="p-6 text-center text-xs text-[#647480] bg-[#FAF9F5] rounded-xl border border-dashed border-[#DDD9CF]">
          Timeline is empty. Press <span className="font-bold text-[#172B3A]">“Step 1 Instruction”</span> or <span className="font-bold text-[#172B3A]">“Auto Play”</span> to commit instructions.
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[500px] space-y-2">
            {/* Thread P1 Lane */}
            <div className="flex items-center gap-2">
              <div className="w-16 shrink-0 flex items-center gap-1.5 font-bold text-xs text-[#172B3A]">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>P1</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                {chronological.map((evt) => {
                  const isP1 = evt.threadId === 'P1';
                  const isSelected = selectedStep === evt.step;

                  if (!isP1) {
                    return (
                      <div
                        key={evt.step}
                        className="flex-1 min-w-[75px] h-10 rounded-xl bg-[#FAF9F5]/80 border border-dashed border-[#DDD9CF]/60 flex items-center justify-center text-[10px] text-[#A0AAB2]"
                      >
                        idle
                      </div>
                    );
                  }

                  return (
                    <button
                      key={evt.step}
                      onClick={() => onSelectStep(evt.step)}
                      className={`flex-1 min-w-[75px] h-10 px-2 rounded-xl border text-xs font-mono font-medium flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-300'
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-950 border-blue-200'
                      }`}
                      title={`Step #${evt.step}: ${evt.instruction}`}
                    >
                      <span className="text-[9px] font-bold opacity-80">#{evt.step}</span>
                      <span className="truncate max-w-[80px] font-bold text-[10px]">{evt.type}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thread P2 Lane */}
            <div className="flex items-center gap-2">
              <div className="w-16 shrink-0 flex items-center gap-1.5 font-bold text-xs text-[#172B3A]">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>P2</span>
              </div>
              <div className="flex items-center gap-2 flex-1">
                {chronological.map((evt) => {
                  const isP2 = evt.threadId === 'P2';
                  const isSelected = selectedStep === evt.step;
                  const isBlocked = evt.type === 'THREAD_BLOCKED';
                  const isLostUpdate = evt.isLostUpdate;

                  if (!isP2) {
                    return (
                      <div
                        key={evt.step}
                        className="flex-1 min-w-[75px] h-10 rounded-xl bg-[#FAF9F5]/80 border border-dashed border-[#DDD9CF]/60 flex items-center justify-center text-[10px] text-[#A0AAB2]"
                      >
                        idle
                      </div>
                    );
                  }

                  return (
                    <button
                      key={evt.step}
                      onClick={() => onSelectStep(evt.step)}
                      className={`flex-1 min-w-[75px] h-10 px-2 rounded-xl border text-xs font-mono font-medium flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? isLostUpdate || isBlocked
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-2 ring-rose-300'
                            : 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-300'
                          : isLostUpdate
                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-950 border-rose-300 font-bold'
                          : isBlocked
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-200'
                      }`}
                      title={`Step #${evt.step}: ${evt.instruction}`}
                    >
                      <span className="text-[9px] font-bold opacity-80">#{evt.step}</span>
                      <span className="truncate max-w-[80px] font-bold text-[10px]">
                        {isLostUpdate ? 'WRITE (Clobber)' : isBlocked ? 'BLOCKED' : evt.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
