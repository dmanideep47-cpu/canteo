import { CheckCircle2, AlertOctagon, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

export default function LiveVerificationPanel({ invariants = [], title = 'Live Invariant Verification', subtitle = null }) {
  if (!invariants || invariants.length === 0) {
    return null;
  }

  const violationCount = invariants.filter((i) => i.status === 'VIOLATION').length;
  const passCount = invariants.filter((i) => i.status === 'PASS').length;
  const inProgressCount = invariants.filter((i) => i.status === 'IN_PROGRESS').length;

  return (
    <div className="bg-[#FAF9F5] border border-[#DDD9CF] rounded-2xl p-4 shadow-2xs font-sans text-left space-y-3">
      <div className="flex items-center justify-between border-b border-[#DDD9CF]/80 pb-2.5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#172B3A] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#087F8C]" />
            <span>{title}</span>
          </h4>
          {subtitle && <p className="text-[11px] text-[#647480] mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {violationCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] bg-rose-100 text-rose-800 border border-rose-300">
              <AlertOctagon className="w-3 h-3" />
              <span>{violationCount} Violation{violationCount > 1 ? 's' : ''}</span>
            </span>
          ) : inProgressCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] bg-blue-50 text-blue-800 border border-blue-200">
              <Clock className="w-3 h-3 text-blue-600" />
              <span>{passCount} Verified ({inProgressCount} Evaluating)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3 h-3" />
              <span>{passCount} Verified</span>
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {invariants.map((inv) => {
          const isViolation = inv.status === 'VIOLATION';
          const isWarn = inv.status === 'WARN';
          const isInProgress = inv.status === 'IN_PROGRESS';

          return (
            <div
              key={inv.id}
              className={`p-2.5 rounded-xl border text-xs transition-all ${
                isViolation
                  ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                  : isWarn
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : isInProgress
                  ? 'bg-slate-50 border-slate-300 text-slate-800'
                  : 'bg-white border-[#DDD9CF] text-[#172B3A]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-bold">
                  {isViolation ? (
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  ) : isWarn ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  ) : isInProgress ? (
                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span>{inv.name}</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                    isViolation
                      ? 'bg-rose-200/80 text-rose-900 border border-rose-400'
                      : isWarn
                      ? 'bg-amber-200/80 text-amber-900 border border-amber-400'
                      : isInProgress
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {inv.status}
                </span>
              </div>

              {inv.formula && (
                <div className="mt-1 font-mono text-[10px] text-[#647480] bg-[#ECE9E1]/60 px-1.5 py-0.5 rounded inline-block">
                  {inv.formula}
                </div>
              )}

              <p className="mt-1 text-[11px] leading-relaxed text-[#2D4554]">
                {inv.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

