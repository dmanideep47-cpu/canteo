import { useRevealOnScroll } from '../hooks/useRevealOnScroll';
import { ArrowRight } from 'lucide-react';

export default function CtaFooter({ onLaunchPrototype }) {
  const [sectionRef, isVisible] = useRevealOnScroll(0.15);

  return (
    <footer
      ref={sectionRef}
      className={`py-16 lg:py-[120px] bg-[#FAF7F2] reveal-fade-up ${
        isVisible ? 'is-visible' : ''
      }`}
      aria-labelledby="cta-heading"
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 text-left">
        <div className="max-w-[700px] mb-16 md:mb-20">
          <div className="text-[11px] font-body font-semibold uppercase tracking-[0.12em] text-[#6B6B6B] mb-4">
            OPEN SOURCE
          </div>

          {/* Giant Serif Headline */}
          <h2
            id="cta-heading"
            className="font-display leading-[0.95] text-[#111111] font-normal tracking-[-0.03em] mb-6"
            style={{ fontSize: 'clamp(48px, 6vw, 72px)' }}
          >
            Build it with us.
          </h2>

          <p className="font-body text-[16px] text-[#6B6B6B] leading-[1.65] mb-8 max-w-[62ch] text-left">
            Explore the prototype, inspect the synchronization event logs, and experience the bounded-buffer problem in real time.
          </p>

          <button
            onClick={() => onLaunchPrototype()}
            className="btn-editorial-primary"
            aria-label="Launch Prototype"
          >
            <span>Launch Prototype</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Hairline Divider & 12px Mono Line at the very bottom */}
        <div className="pt-8 border-t border-[#E5E2DD] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-[12px] text-[#6B6B6B]">
          <p>
            Canteo — College Canteen Ordering & Live Queue Tracking.
          </p>
          <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-wider text-[#6B6B6B]">
            <span>React 19</span>
            <span>·</span>
            <span>Tailwind v4</span>
            <span>·</span>
            <span>Bounded Buffer (N=5)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
