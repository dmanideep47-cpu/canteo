import { ArrowUpRight } from 'lucide-react';

export default function Navbar({ onLaunchPrototype }) {
  return (
    <header className="sticky top-0 z-40 bg-[#FAF7F2] border-b border-[#E5E2DD]">
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <a
          href="#"
          className="font-display text-[22px] text-[#111111] hover:opacity-80 transition-opacity tracking-tight"
          aria-label="Canteo Home"
        >
          Canteo
        </a>

        {/* Navigation Links & Action */}
        <nav className="flex items-center gap-6 md:gap-8" aria-label="Main Navigation">
          <div className="hidden sm:flex items-center gap-6 text-sm font-normal text-[#6B6B6B]">
            <a
              href="#lineup"
              className="hover:text-[#111111] transition-colors"
            >
              Apps
            </a>
            <a
              href="#principles"
              className="hover:text-[#111111] transition-colors"
            >
              Principles
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-[#111111] transition-colors"
            >
              <span>GitHub</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#6B6B6B]" />
            </a>
          </div>

          <button
            onClick={() => onLaunchPrototype()}
            className="h-9 px-4 rounded-full bg-[#111111] text-white text-xs font-medium hover:bg-[#1A1A1A] transition-colors active:scale-[0.98]"
            aria-label="Launch Prototype"
          >
            Launch Prototype
          </button>
        </nav>
      </div>
    </header>
  );
}
