import { useRevealOnScroll } from '../hooks/useRevealOnScroll';

const PRINCIPLES = [
  {
    num: '01',
    title: 'Bounded by design',
    description: 'The queue holds at most five waiting orders. Physical kitchen limits are enforced in state.',
  },
  {
    num: '02',
    title: 'Producers wait, not fail',
    description: 'A full queue blocks admission into a deterministic FIFO buffer until staff creates capacity.',
  },
  {
    num: '03',
    title: 'Consumers never guess',
    description: 'Kitchen workers take orders strictly when an order exists, eliminating underflow and stale reads.',
  },
  {
    num: '04',
    title: 'One critical section at a time',
    description: 'Binary mutex locking serializes mutations across all producers and consumer workers.',
  },
  {
    num: '05',
    title: 'Every action is visible',
    description: 'The event log surfaces synchronization transitions with exact sequence numbers and snapshots.',
  },
  {
    num: '06',
    title: 'Correct before pretty',
    description: 'Semaphore invariants (empty + full = 5) are verified after every single state dispatch.',
  },
];

export default function PrinciplesSection() {
  const [sectionRef, isVisible] = useRevealOnScroll(0.15);

  return (
    <section
      id="principles"
      ref={sectionRef}
      className={`py-16 lg:py-[120px] border-b border-[#E5E2DD] reveal-fade-up ${
        isVisible ? 'is-visible' : ''
      }`}
      aria-labelledby="principles-heading"
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* Left Column: Sticky Title & Overline (5 cols on lg) */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 text-left">
            <div className="text-[11px] font-body font-semibold uppercase tracking-[0.12em] text-[#6B6B6B] mb-3">
              PRINCIPLES
            </div>
            <h2
              id="principles-heading"
              className="font-display font-normal text-[#111111] tracking-[-0.02em] leading-[1.05] mb-4"
              style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}
            >
              Built the correct way.
            </h2>
            <p className="font-body text-[16px] text-[#6B6B6B] leading-[1.65] max-w-[40ch]">
              Classical Operating Systems primitives translated directly into clean, deterministic React state machines.
            </p>
          </div>

          {/* Right Column: 6 Rows Separated by Hairlines (7 cols on lg) */}
          <div className="lg:col-span-7 divide-y divide-[#E5E2DD] border-t border-b border-[#E5E2DD]">
            {PRINCIPLES.map((principle) => (
              <div
                key={principle.num}
                className="py-7 flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-8 text-left"
              >
                <span className="font-mono text-xs text-[#D97706] shrink-0 pt-0.5">
                  {principle.num}
                </span>
                <div>
                  <h3 className="text-[18px] font-semibold text-[#111111] mb-1.5 font-body tracking-tight">
                    {principle.title}
                  </h3>
                  <p className="text-[14px] text-[#5E5E5E] leading-[1.6]">
                    {principle.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
