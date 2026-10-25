import { useRevealOnScroll } from '../hooks/useRevealOnScroll';
import SafeImage from '../../components/SafeImage';

const SHOWCASE_ITEMS = [
  {
    id: 'showcase-dosa',
    title: 'Masala Dosa',
    category: 'Breakfast · ₹40',
    imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=800&auto=format&fit=crop&q=80',
    alt: 'Golden crispy Masala Dosa served with coconut chutney',
    aspect: 'aspect-[4/3]',
  },
  {
    id: 'showcase-thali',
    title: 'Meals Thali',
    category: 'Meals · ₹60',
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=800&auto=format&fit=crop&q=80',
    alt: 'Traditional South Indian thali with rice, sambar, and sides',
    aspect: 'aspect-[4/5]', // Taller middle image to break grid monotony
  },
  {
    id: 'showcase-coffee',
    title: 'Filter Coffee',
    category: 'Beverages · ₹15',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
    alt: 'Traditional frothy Indian filter coffee in a metal cup',
    aspect: 'aspect-[4/3]',
  },
];

export default function ShowcaseSection() {
  const [sectionRef, isVisible] = useRevealOnScroll(0.15);

  return (
    <section
      id="showcase"
      ref={sectionRef}
      className={`py-16 lg:py-[80px] border-b border-[#E5E2DD] reveal-fade-up ${
        isVisible ? 'is-visible' : ''
      }`}
      aria-labelledby="showcase-heading"
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="mb-12 md:mb-16 text-left">
          <div className="text-[11px] font-body font-semibold uppercase tracking-[0.12em] text-[#6B6B6B] mb-3">
            SHOWCASE
          </div>
          <h2
            id="showcase-heading"
            className="font-display font-normal text-[#111111] tracking-[-0.02em] leading-[1.05]"
            style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}
          >
            Canteen craft.
          </h2>
        </div>

        {/* Staggered 3-Photo Row: Middle Card is Taller */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {SHOWCASE_ITEMS.map((item) => (
            <div
              key={item.id}
              className="flex flex-col text-left group"
            >
              <div className="overflow-hidden rounded-xl border border-[#E5E2DD] bg-[#F4EFEA]">
                <SafeImage
                  src={item.imageUrl}
                  alt={item.alt}
                  aspectRatio={item.aspect}
                  className="group-hover:scale-[1.02] transition-transform duration-300"
                  fallbackText={item.title}
                />
              </div>
              <div className="pt-3 flex items-baseline justify-between text-left">
                <h3 className="font-semibold text-[15px] text-[#111111] font-body tracking-tight">
                  {item.title}
                </h3>
                <span className="font-mono text-xs text-[#6B6B6B] tabular-nums">
                  {item.category}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Showcase Italic Serif Caption: Strictly Left-Aligned, Never Centered */}
        <div className="mt-16 md:mt-20 text-left max-w-[62ch]">
          <p className="font-display italic text-[28px] sm:text-[32px] text-[#111111] leading-[1.2] tracking-tight">
            Real canteen food. Real concurrency. Zero lost orders.
          </p>
          <p className="text-[11px] text-[#6B6B6B] mt-3 font-mono uppercase tracking-[0.15em]">
            Modelled educational bounded-buffer guarantees strict order preservation.
          </p>
        </div>
      </div>
    </section>
  );
}
