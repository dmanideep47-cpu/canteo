import { Activity } from 'lucide-react';

export default function TimelineInspector({ events }) {
  return (
    <div className="bg-white border border-[#DDD9CF] rounded-2xl p-6 space-y-4 text-left shadow-xs font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-[#DDD9CF]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#087F8C]" />
          <h3 className="font-sans font-bold text-sm text-[#172B3A]">
            Execution Timeline Event Stream
          </h3>
        </div>
        <span className="font-mono text-xs text-[#647480]">
          {events.length} events logged
        </span>
      </div>

      <div className="space-y-2 font-mono text-xs max-h-[260px] overflow-y-auto pr-2">
        {events.map((evt) => (
          <div
            key={evt.id}
            className="p-2.5 rounded-xl bg-[#F6F4EE] border border-[#DDD9CF] flex items-start gap-3 text-[#172B3A]"
          >
            <span className="text-[#647480] font-semibold select-none shrink-0 w-8">
              #{evt.step}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${
                evt.threadId === 'C1'
                  ? 'bg-[#E1F2EF] text-[#087F8C]'
                  : evt.threadId === 'KERNEL'
                    ? 'bg-[#FBEAEA] text-[#BC4141]'
                    : 'bg-[#FBEAE4] text-[#E98570]'
              }`}
            >
              {evt.threadId}
            </span>
            <span className="flex-1 break-all font-sans text-xs">{evt.message}</span>
            <span className="text-[10px] text-[#647480] shrink-0 font-mono">{evt.timestamp}</span>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-center text-[#647480] py-6 text-xs font-sans">
            Simulation initialized. Press &ldquo;Play Simulation&rdquo; or &ldquo;Step&rdquo; to begin.
          </div>
        )}
      </div>
    </div>
  );
}

