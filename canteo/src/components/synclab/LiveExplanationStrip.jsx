import {
  ArrowRight,
  CheckCircle2,
  Lock,
  RotateCcw,
  Info,
  AlertTriangle,
  Key,
} from 'lucide-react';
import { generateEventExplanation } from '../../logic/syncLabEngine';

export default function LiveExplanationStrip({
  latestEvent,
  syncState,
  onInspectEvent,
}) {
  const explanation = generateEventExplanation(latestEvent, syncState);

  const getIcon = () => {
    switch (explanation.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-[#237A57] shrink-0" />;
      case 'warning':
        return <Lock className="w-4 h-4 text-[#B77912] shrink-0" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-[#BC4141] shrink-0" />;
      default:
        if (explanation.category.includes('MUTEX')) {
          return <Key className="w-4 h-4 text-[#087F8C] shrink-0" />;
        }
        if (explanation.category.includes('POINTER')) {
          return <RotateCcw className="w-4 h-4 text-[#E98570] shrink-0" />;
        }
        return <Info className="w-4 h-4 text-[#087F8C] shrink-0" />;
    }
  };

  const getPillStyle = () => {
    switch (explanation.type) {
      case 'success':
        return 'bg-[#E6F3EA] text-[#237A57] border-[#237A57]/30';
      case 'warning':
        return 'bg-[#FFF1D6] text-[#B77912] border-[#B77912]/40';
      case 'error':
        return 'bg-[#FBEAEA] text-[#BC4141] border-[#BC4141]/30';
      default:
        return 'bg-[#E1F2EF] text-[#087F8C] border-[#087F8C]/30';
    }
  };

  return (
    <div className="w-full bg-white border border-[#DDD9CF] rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs text-left font-sans">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {getIcon()}
        <span
          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border uppercase tracking-wider shrink-0 ${getPillStyle()}`}
        >
          {explanation.category}
        </span>
        <p className="text-xs text-[#172B3A] font-medium truncate sm:whitespace-normal">
          {explanation.text}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        {latestEvent && onInspectEvent && (
          <button
            onClick={() => onInspectEvent(latestEvent)}
            className="text-[11px] font-mono text-[#087F8C] hover:text-[#172B3A] font-medium flex items-center gap-1 transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-[#F6F4EE]"
            title="Open event details in inspector"
          >
            <span>Inspect Details</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
