import { useState, useMemo } from 'react';
import { useApp } from '../app/AppContext';
import { MENU_ITEMS } from '../data/menuItems';
import SearchBar from '../components/SearchBar';
import CategoryChips from '../components/CategoryChips';
import FoodCard from '../components/FoodCard';
import CartSheet from '../components/CartSheet';
import { ArrowRight } from 'lucide-react';

export default function MenuScreen() {
  const {
    cart,
    cartItemsList,
    cartTotal,
    cartCount,
    addToCart,
    updateCartQuantity,
    placeOrder,
    state,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Search and Category filters working together
  const filteredItems = useMemo(() => {
    return MENU_ITEMS.filter((item) => {
      const matchesCategory =
        selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-full text-left">
      {/* Header with Title and Queue Slot Badge */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E2DD]">
        <div>
          <h1 className="text-2xl font-semibold font-body text-[#111111] tracking-tight">
            Menu
          </h1>
          <p className="text-xs text-[#5E5E5E] font-normal mt-0.5">
            Producer process: select items to submit orders into the 5-slot bounded buffer.
          </p>
        </div>

        {/* Live Queue Slot Badge: Minimal hairline pill */}
        <div className="flex items-center gap-2 bg-white border border-[#E5E2DD] px-3 py-1 rounded-full text-xs font-mono shrink-0 self-start sm:self-auto tabular-nums">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              state.empty === 0 ? 'bg-[#C0392B] animate-pulse' : 'bg-[#D97706]'
            }`}
          />
          <span className="font-medium text-[#111111]">{state.empty}/5</span>
          <span className="text-[#6B6B6B]">slots free</span>
        </div>
      </header>

      {/* Search and Category Filters */}
      <section className="space-y-4" aria-label="Menu Filters">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <CategoryChips
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </section>

      {/* Multi-Column Food Grid: 1 col on mobile, 2 col on tablet, 3 on desktop */}
      <main aria-label="Food Products">
        {filteredItems.length === 0 ? (
          <div className="py-24 text-center font-mono text-xs text-[#6B6B6B]">
            — nothing here yet —
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredItems.map((item) => {
              const qty = cart[item.id] ? cart[item.id].quantity : 0;
              return (
                <FoodCard
                  key={item.id}
                  item={item}
                  quantity={qty}
                  onAdd={addToCart}
                  onUpdateQuantity={updateCartQuantity}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar: Black pill with subtle shadow-lg */}
      {cartCount > 0 && (
        <div className="fixed bottom-20 lg:bottom-8 left-0 right-0 z-30 px-4 pointer-events-none">
          <div className="max-w-[460px] mx-auto pointer-events-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full h-12 bg-[#111111] text-white px-5 rounded-full shadow-lg flex items-center justify-between hover:bg-[#1A1A1A] transition-colors active:scale-[0.99] focus:outline-none"
              aria-label="View Cart"
            >
              <div className="flex items-center gap-2.5 text-xs font-medium tabular-nums">
                <span className="w-5 h-5 rounded-full bg-[#D97706] text-white flex items-center justify-center text-[10px] font-mono">
                  {cartCount}
                </span>
                <span>
                  {cartCount} {cartCount === 1 ? 'item' : 'items'} · ₹{cartTotal}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                <span>View Cart</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Cart Modal Sheet */}
      <CartSheet
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItemsList={cartItemsList}
        cartTotal={cartTotal}
        onUpdateQuantity={updateCartQuantity}
        onPlaceOrder={placeOrder}
        queueCapacityRemaining={state.empty}
      />
    </div>
  );
}
