import { useState, useMemo } from 'react';
import { useApp } from '../app/AppContext';
import { MENU_ITEMS } from '../data/menuItems';
import SearchBar from '../components/SearchBar';
import CategoryChips from '../components/CategoryChips';
import FoodCard from '../components/FoodCard';
import CartSheet from '../components/CartSheet';
import { ArrowRight, ShoppingBag, AlertTriangle } from 'lucide-react';

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
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-left">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#E7E3D9]">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold font-body text-[#181A19] tracking-tight">
            Canteen Menu
          </h1>
          <p className="text-xs text-[#6B726C] mt-1 max-w-2xl leading-relaxed">
            Fresh campus meals prepared to order in strict FIFO sequence.
          </p>
        </div>

        {/* Bounded Queue Capacity Card */}
        <div className="bg-white border border-[#E5E2DA] p-3 rounded-xl flex items-center gap-4 shrink-0 shadow-2xs">
          <div className="text-left font-mono">
            <div className="text-[10px] text-[#6B726C]">Queue Capacity</div>
            <div className="text-base font-bold text-[#181A19] tabular-nums mt-0.5">
              {state.empty} <span className="text-xs font-normal text-[#6B726C]">of 5 slots free</span>
            </div>
          </div>
          <div className="h-8 w-px bg-[#E5E2DA]" />
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                state.empty === 0 ? 'bg-[#B91C1C]' : 'bg-[#15803D]'
              }`}
            />
            <span className="text-[11px] font-semibold text-[#181A19]">
              {state.empty === 0 ? 'Queue Full' : 'Available'}
            </span>
          </div>
        </div>
      </div>

      {/* Capacity Warning Banner when Full */}
      {state.empty === 0 && (
        <div className="p-3.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl flex items-center justify-between gap-3 text-xs text-[#B45309]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#B45309]" />
            <span>
              <strong>Queue is currently at maximum capacity (5/5 orders active).</strong> New orders will be queued as soon as kitchen staff take an order from the buffer.
            </span>
          </div>
          <span className="font-mono text-[10px] bg-white border border-[#FDE68A] px-2 py-0.5 rounded font-bold shrink-0 text-[#B45309]">
            sem_wait(&amp;empty)
          </span>
        </div>
      )}

      {/* Search and Category Filters */}
      <section className="space-y-3.5" aria-label="Menu Filters">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <div className="text-xs font-mono text-[#747B75] self-end sm:self-auto">
            Showing {filteredItems.length} of {MENU_ITEMS.length} dishes
          </div>
        </div>
        <CategoryChips
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </section>

      {/* Multi-Column Food Grid */}
      <main aria-label="Food Products">
        {filteredItems.length === 0 ? (
          <div className="py-20 text-center font-mono text-xs text-[#747B75] bg-white rounded-xl border border-[#E7E3D9] p-8 max-w-md mx-auto">
            <ShoppingBag className="w-8 h-8 text-[#C69A52] mx-auto mb-2 opacity-70" />
            <p className="text-sm font-semibold text-[#252A27] font-body">No matching food items</p>
            <p className="text-xs text-[#747B75] mt-1 font-body">
              Try adjusting your search query or switching categories.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
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

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-20 lg:bottom-8 left-0 right-0 z-30 px-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full h-12 bg-[#194D40] hover:bg-[#123A32] text-white px-5 rounded-xl shadow-lg flex items-center justify-between transition-all active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#C69A52] cursor-pointer border border-[#154237]"
              aria-label="View Cart"
            >
              <div className="flex items-center gap-2.5 text-xs font-medium tabular-nums">
                <span className="w-5 h-5 rounded-md bg-[#C69A52] text-white flex items-center justify-center text-[10px] font-mono font-bold">
                  {cartCount}
                </span>
                <span>
                  {cartCount} {cartCount === 1 ? 'item' : 'items'} · ₹{cartTotal}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                <span>Review &amp; Place Order</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C69A52]" />
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
