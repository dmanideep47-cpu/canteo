import { X } from 'lucide-react';

export default function Toast({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 lg:bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none px-4 max-w-[90vw]"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          aria-live="assertive"
          className="pointer-events-auto bg-[#111111] text-white px-5 py-3 rounded-full shadow-lg flex items-center gap-3 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 border border-[#222222]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
          <span className="leading-tight">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 -mr-1 text-[#8C8C8C] hover:text-white transition-colors focus:outline-none"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
