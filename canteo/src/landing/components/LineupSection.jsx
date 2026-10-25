import { useRevealOnScroll } from '../hooks/useRevealOnScroll';
import SafeImage from '../../components/SafeImage';
import { UtensilsCrossed, ListOrdered, ChefHat, GitBranch } from 'lucide-react';

const LINEUP_CARDS = [
  {
    id: 'view-student-app',
    num: '01',
    tabKey: 'menu',
    title: 'Student App',
    icon: UtensilsCrossed,
    description: 'Browse the canteen menu, curate a cart, and place orders with instant FIFO queue accounting.',
    imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=600&auto=format&fit=crop&q=80',
    imageAlt: 'Student Menu Items',
  },
  {
    id: 'view-order-queue',
    num: '02',
    tabKey: 'orders',
    title: 'Order Queue',
    icon: ListOrdered,
    description: 'Track your order status on an interactive schematic campus map with real-time lifecycle stages.',
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    imageAlt: 'Order Tracking & Queueing',
  },
  {
    id: 'view-kitchen-dashboard',
    num: '03',
    tabKey: 'kitchen',
    title: 'Kitchen Dashboard',
    icon: ChefHat,
    description: 'Manage the 5-slot bounded buffer, worker preparation station, and pickup handoffs.',
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop&q=80',
    imageAlt: 'Kitchen Dashboard Buffer',
  },
  {
    id: 'view-sync-lab',
    num: '04',
    tabKey: 'synclab',
    title: 'Synchronization Lab',
    icon: GitBranch,
    description: 'Inspect counting semaphores, lock acquisition, live event logs, and the race-condition demo.',
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    imageAlt: 'Synchronization Semaphores',
  },
];

export default function LineupSection({ onSelectTab }) {
  const [sectionRef, isVisible] = useRevealOnScroll(0.15);

  return (
    <section
      id="lineup"
      ref={sectionRef}
      className={`py-16 lg:py-[80px] border-b border-[#E5E2DD] reveal-fade-up ${
        isVisible ? 'is-visible' : ''
      }`}
      aria-labelledby="lineup-heading"
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="mb-12 md:mb-16 text-left">
          <div className="text-[11px] font-body font-semibold uppercase tracking-[0.12em] text-[#6B6B6B] mb-3">
            EXPLORE
          </div>
          <h2
            id="lineup-heading"
            className="font-display font-normal text-[#111111] tracking-[-0.02em] leading-[1.05]"
            style={{ fontSize: 'clamp(36px, 5vw, 60px)' }}
          >
            Pick a view to explore.
          </h2>
        </div>

        {/* 2x2 Grid of Minimal Editorial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {LINEUP_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => onSelectTab(card.tabKey)}
                className="card-editorial p-6 flex flex-col justify-between cursor-pointer group rounded-xl"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTab(card.tabKey);
                  }
                }}
                aria-label={`Explore ${card.title}`}
              >
                <div>
                  {/* Header: Mono Number Top-Left, Raw Icon Top-Right */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-[#6B6B6B]">
                      {card.num}
                    </span>
                    <Icon className="w-4 h-4 text-[#6B6B6B] group-hover:text-[#111111] transition-colors stroke-[1.75]" />
                  </div>

                  {/* Thumbnail Image: scale 1.03 on hover inside overflow-hidden */}
                  <div className="mb-5 overflow-hidden rounded-lg bg-[#F4EFEA]">
                    <SafeImage
                      src={card.imageUrl}
                      alt={card.imageAlt}
                      aspectRatio="aspect-[16/9]"
                      className="group-hover:scale-[1.03] transition-transform duration-300"
                      fallbackText={card.title}
                    />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-[20px] font-semibold text-[#111111] mb-2 font-body tracking-tight leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-[14px] text-[#5E5E5E] leading-relaxed line-clamp-2">
                    {card.description}
                  </p>
                </div>

                {/* Bottom Left "Explore →" in Warm Amber */}
                <div className="mt-6 pt-4 border-t border-[#E5E2DD] flex justify-start">
                  <span className="text-xs font-semibold text-[#D97706] group-hover:underline transition-all">
                    Explore →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
