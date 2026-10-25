import { useRevealOnScroll } from '../hooks/useRevealOnScroll';
import SafeImage from '../../components/SafeImage';
import { ArrowRight } from 'lucide-react';

const MASALA_DOSA_HERO_URL =
  'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&auto=format&fit=crop&q=80';

export default function HeroSection({ onLaunchPrototype, onOpenCaseStudy }) {
  const [sectionRef, isVisible] = useRevealOnScroll(0.1);

  return (
    <section
      ref={sectionRef}
      className={`pt-16 lg:pt-[120px] pb-16 lg:pb-[120px] border-b border-[#E5E2DD] reveal-fade-up relative ${
        isVisible ? 'is-visible' : ''
      }`}
      aria-label="Hero"
    >
      <div className="max-w-[1200px] xl:max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column: Headline and Content (7 cols on lg, strictly left-aligned) */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left">
            {/* Overline Label: 11px Inter Uppercase 0.12em Tracking */}
            <div className="text-[11px] font-body font-semibold uppercase tracking-[0.12em] text-[#6B6B6B] mb-6 flex items-center gap-2 text-left">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] inline-block" />
              <span>OS SYNCHRONIZATION PROTOTYPE</span>
            </div>

            {/* Hero H1: clamp(56px, 9vw, 120px), line-height 0.95, letter-spacing -0.03em */}
            <h1
              className="font-display text-[#111111] font-normal tracking-[-0.03em] leading-[0.95] mb-8 text-left"
              style={{ fontSize: 'clamp(56px, 9vw, 120px)' }}
            >
              One canteen.<br />Every order in sync.
            </h1>

            {/* Body: Inter 16px, line-height 1.65, color #6B6B6B, max-width 62ch, strictly left-aligned */}
            <p className="font-body text-[16px] text-[#6B6B6B] font-normal leading-[1.65] max-w-[62ch] mb-10 text-left">
              Canteo turns a college canteen into a living Operating Systems simulation. Students place orders, the kitchen processes them, and synchronization mechanisms protect the shared queue.
            </p>

            {/* Actions: Black pill button + Text link with amber hover underline */}
            <div className="flex flex-wrap items-center gap-6">
              <button
                onClick={() => onLaunchPrototype()}
                className="btn-editorial-primary"
                aria-label="Launch Prototype"
              >
                <span>Launch Prototype</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenCaseStudy}
                className="link-editorial py-2"
                aria-label="Read the Case Study"
              >
                <span>Read the case study →</span>
              </button>
            </div>
          </div>

          {/* Right Column: Masala Dosa Photo in 4:5 ratio, overlapping section below by -48px on desktop */}
          <div className="lg:col-span-5 order-last lg:order-none lg:-mb-12 lg:translate-y-12 z-10">
            <div className="relative bg-white border border-[#E5E2DD] rounded-xl p-2 overflow-hidden">
              <div className="overflow-hidden rounded-lg">
                <SafeImage
                  src={MASALA_DOSA_HERO_URL}
                  alt="Crispy Masala Dosa with Chutneys and Sambar"
                  aspectRatio="aspect-[4/5]"
                  className="transition-transform duration-500 hover:scale-[1.02]"
                  priority={true}
                  fallbackText="Masala Dosa"
                />
              </div>
              <div className="pt-3 pb-1 px-1 flex items-center justify-between text-xs font-mono text-[#6B6B6B] tabular-nums">
                <span className="font-medium text-[#111111]">MASALA DOSA · ₹40</span>
                <span className="text-[10px] tracking-[0.15em] uppercase text-[#D97706] font-semibold">
                  QUEUE READY
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
