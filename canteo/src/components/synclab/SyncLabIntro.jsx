import { useState } from 'react';
import {
  ArrowRight,
  Cpu,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';

export default function SyncLabIntro({
  onOpenLab,
  orderSnapshot = null,
  onSimulateOrder = null,
  onReturnToOrder = null,
}) {
  // Section D: Isolated Mini Demonstration State
  // Initial state: 5 bays occupied [O1..O5], O6 waiting outside
  const [demoStep, setDemoStep] = useState(0); // 0: 5 full + O6 waiting, 1: Kitchen accepted O1, 2: O6 placed in Bay 0

  const initialDemoSlots = [
    { id: 'O1', name: 'Burrito Bowl', producer: 'P1' },
    { id: 'O2', name: 'Cold Brew', producer: 'P2' },
    { id: 'O3', name: 'Grilled Sandwich', producer: 'P1' },
    { id: 'O4', name: 'Salad Bowl', producer: 'P2' },
    { id: 'O5', name: 'Blueberry Muffin', producer: 'P1' },
  ];

  const handleAdvanceDemo = () => {
    if (demoStep === 0) {
      setDemoStep(1);
      setTimeout(() => {
        setDemoStep(2);
      }, 750);
    }
  };

  const handleResetDemo = () => {
    setDemoStep(0);
  };

  // Compute current display slots for Section D
  let currentDemoSlots = [...initialDemoSlots];
  let kitchenPlate = null;
  let o6Location = 'OUTSIDE_WAITING'; // 'OUTSIDE_WAITING' | 'ENTERING' | 'IN_BAY_0'
  let demoEmpty = 0;
  let demoFull = 5;

  if (demoStep === 1) {
    currentDemoSlots[0] = null;
    kitchenPlate = { id: 'O1', name: 'Burrito Bowl' };
    o6Location = 'ENTERING';
    demoEmpty = 1;
    demoFull = 4;
  } else if (demoStep === 2) {
    currentDemoSlots[0] = { id: 'O6', name: 'Espresso', producer: 'P1' };
    kitchenPlate = { id: 'O1', name: 'Burrito Bowl' };
    o6Location = 'IN_BAY_0';
    demoEmpty = 0;
    demoFull = 5;
  }

  return (
    <div className="w-full bg-[#F7F8FA] min-h-[calc(100vh-64px)] p-4 sm:p-6 lg:p-10 font-sans text-left selection:bg-[#167D8D] selection:text-white">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* ======================================================== */}
        {/* HERO HEADER & TOP LAB SHORTCUT                           */}
        {/* ======================================================== */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#DEE6E8]">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-[#E4F3F3] text-[#167D8D] px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5" />
              <span>Operating Systems Synchronization Lab</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#263843] tracking-tight">
              From Canteen Orders to OS Synchronization
            </h1>
            <p className="text-sm sm:text-base text-[#62747C] max-w-2xl leading-relaxed">
              See how producers, consumers, semaphores, and a mutex coordinate access to a shared queue.
            </p>
          </div>

          {/* Top Lab Shortcut */}
          <div className="shrink-0 flex items-center gap-2">
            {orderSnapshot && onReturnToOrder && (
              <button
                type="button"
                onClick={onReturnToOrder}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#DEE6E8] hover:border-[#263843] text-[#263843] text-xs font-semibold transition-all cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#62747C]" />
                <span>Return to my order</span>
              </button>
            )}
            <button
              type="button"
              onClick={orderSnapshot && onSimulateOrder ? () => onSimulateOrder(orderSnapshot) : onOpenLab}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#263843] hover:bg-black text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer group"
            >
              <span>{orderSnapshot ? 'Simulate this order in 3D' : 'Open 3D Lab with sample orders'}</span>
              <ArrowRight className="w-4 h-4 text-[#167D8D] group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* YOUR ORDER -> OS MODEL (IF ENTERED FROM AN ORDER)        */}
        {/* ======================================================== */}
        {orderSnapshot && (
          <section className="bg-[#F7F8FA] rounded-2xl border-2 border-[#167D8D] p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DEE6E8]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E4F3F3] text-[#167D8D] flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#263843]">
                    See how your order fits the OS model
                  </h2>
                  <p className="text-xs text-[#62747C]">
                    Teaching snapshot adapted from real order <strong>#{orderSnapshot.sourceOrderId}</strong>
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#DEE6E8] text-xs font-mono text-[#167D8D] font-semibold shrink-0 self-start sm:self-auto">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Non-sensitive teaching copy</span>
              </div>
            </div>

            {/* Order snapshot summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-white border border-[#DEE6E8] space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#62747C] font-bold block">
                  Source Reference
                </span>
                <span className="text-sm font-mono font-bold text-[#263843]">
                  Order #{orderSnapshot.sourceOrderId}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-[#DEE6E8] space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#62747C] font-bold block">
                  Ordered Items ({orderSnapshot.totalQuantity} items)
                </span>
                <span className="text-xs font-medium text-[#263843] truncate block" title={orderSnapshot.itemSummary}>
                  {orderSnapshot.itemSummary}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-[#DEE6E8] space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#167D8D] font-bold block">
                  Buffer Ticket Accounting
                </span>
                <span className="text-xs font-bold text-[#167D8D] block">
                  1 Buffer Slot = 1 Order Ticket
                </span>
              </div>
            </div>

            {/* Crucial concept callout */}
            <div className="p-4 rounded-xl bg-white border border-[#DEE6E8] text-xs leading-relaxed text-[#333333] space-y-2">
              <div className="flex items-center gap-2 text-[#167D8D] font-bold">
                <Info className="w-4 h-4 shrink-0" />
                <span>What one buffer slot represents:</span>
              </div>
              <p>
                <strong>One placed order = one order ticket in the shared buffer.</strong> An order containing {orderSnapshot.totalQuantity} food items is still <strong>ONE order ticket</strong> occupying <strong>ONE buffer slot</strong>. Do not confuse food quantity, number of customer orders, number of producer threads, or number of buffer slots.
              </p>
              <p className="text-[11px] text-[#62747C] italic">
                This is a teaching snapshot. Your actual order continues normally in the canteen kitchen.
              </p>
            </div>

            {/* Six-point architecture mapping */}
            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#263843] font-bold">
                Canteo Dining Operations → Operating Systems Mapping
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-white border border-[#DEE6E8] flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-[#F7F8FA] border border-[#DEE6E8] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">1</span>
                  <div>
                    <strong className="text-[#263843] block">Your submitted order</strong>
                    <span className="text-[#62747C]">Work assigned to a producer thread (Student Kiosk).</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#DEE6E8] flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-[#F7F8FA] border border-[#DEE6E8] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">2</span>
                  <div>
                    <strong className="text-[#263843] block">Producer thread (P1 or P2)</strong>
                    <span className="text-[#62747C]">Adds an order ticket token to the shared memory queue.</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#DEE6E8] flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-[#F7F8FA] border border-[#DEE6E8] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">3</span>
                  <div>
                    <strong className="text-[#263843] block">Five numbered bays (Slots 0–4)</strong>
                    <span className="text-[#62747C]">Educational bounded buffer with fixed capacity N = 5.</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#DEE6E8] flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-[#F7F8FA] border border-[#DEE6E8] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">4</span>
                  <div>
                    <strong className="text-[#263843] block">Kitchen worker (C1)</strong>
                    <span className="text-[#62747C]">Consumer thread that takes a queued ticket from buffer[out].</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#DEE6E8] flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-[#F7F8FA] border border-[#DEE6E8] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">5</span>
                  <div>
                    <strong className="text-[#263843] block">Mutex lock (mutex)</strong>
                    <span className="text-[#62747C]">Ensures only one thread accesses the buffer pointers at a time.</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#DEE6E8] flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-[#F7F8FA] border border-[#DEE6E8] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">6</span>
                  <div>
                    <strong className="text-[#263843] block">Semaphores (empty / full)</strong>
                    <span className="text-[#62747C]">Coordinate available capacity (empty) and ready meals (full).</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Explicit distinction disclaimer */}
            <div className="p-3.5 rounded-xl bg-[#FFF3D6] border border-[#8B6508]/40 text-xs text-[#8B6508] leading-relaxed">
              <strong>Explicit Concurrency Note:</strong> The five-slot capacity and instruction-level thread execution shown here belong to the lab model unless the actual backend implements them. Real orders persist in database tables; this simulator models memory-level POSIX primitives coordinating shared resources.
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onSimulateOrder && onSimulateOrder(orderSnapshot)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#263843] hover:bg-black text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
              >
                <span>Simulate this order in 3D</span>
                <ArrowRight className="w-4 h-4 text-[#167D8D]" />
              </button>

              {onReturnToOrder && (
                <button
                  type="button"
                  onClick={onReturnToOrder}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-white border border-[#DEE6E8] hover:border-[#263843] text-[#263843] text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-[#62747C]" />
                  <span>Return to my order</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenLab}
                className="w-full sm:w-auto text-xs text-[#62747C] hover:text-[#263843] font-medium underline underline-offset-4 cursor-pointer"
              >
                Or explore 3D lab with sample orders
              </button>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* SECTION A: THE SIMPLE CANTEEN STORY                      */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl border border-[#DEE6E8] p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F7F8FA] border border-[#DEE6E8] flex items-center justify-center text-sm font-bold font-mono text-[#167D8D]">
              A
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#263843]">
              The Simple Canteen Story
            </h2>
          </div>

          <p className="text-sm sm:text-base text-[#333333] leading-relaxed">
            Imagine a bustling university canteen. Multiple students stand at automated ordering kiosks submitting lunch orders.
            A physical service pass-through counter connects the kiosks to the kitchen staff, but space is limited:
            <strong> exactly five order bays</strong> can hold food trays at the same time.
          </p>

          {/* 3-Step Flow Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-[#A94D36]">Step 1</span>
              <h3 className="font-bold text-sm text-[#263843]">Students Submit Orders</h3>
              <p className="text-xs text-[#62747C] leading-relaxed">
                Students create orders at self-service kiosks and prepare trays for the service counter.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-[#167D8D]">Step 2</span>
              <h3 className="font-bold text-sm text-[#263843]">5 Shared Counter Bays</h3>
              <p className="text-xs text-[#62747C] leading-relaxed">
                A shared FIFO buffer holds up to 5 orders at once. Bays are arranged in a circular modulo queue.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-[#237A57]">Step 3</span>
              <h3 className="font-bold text-sm text-[#263843]">Kitchen Accepts Trays</h3>
              <p className="text-xs text-[#62747C] leading-relaxed">
                Chefs remove the oldest order from the counter to prepare and serve meals.
              </p>
            </div>
          </div>

          {/* Plain Language Rule Alert */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm leading-relaxed space-y-1">
              <div>
                <strong className="font-bold">What One Buffer Item Represents:</strong> One placed order = one order ticket in the shared buffer. An order containing 2 coffees and 1 sandwich represents <strong>ONE order ticket</strong> in <strong>ONE buffer slot</strong>.
              </div>
              <div className="text-xs text-amber-900/80">
                Do not confuse food quantity, number of customer orders, number of producer threads, or the 5 buffer slots.
              </div>
            </div>
          </div>

          {/* Notice about simulated orders */}
          <div className="text-xs text-[#62747C] font-mono flex items-center gap-2 pt-1 border-t border-[#DEE6E8]">
            <span className="w-2 h-2 rounded-full bg-[#167D8D]" />
            <span>Notice: These are simulated lab orders, separate from live Canteo orders.</span>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION B: CONNECT TO OS CONCEPTS MAPPING GRID           */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl border border-[#DEE6E8] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F7F8FA] border border-[#DEE6E8] flex items-center justify-center text-sm font-bold font-mono text-[#167D8D]">
                B
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#263843]">
                Connect to Operating Systems Concepts
              </h2>
            </div>
            <span className="text-xs font-mono bg-[#F7F8FA] text-[#62747C] px-3 py-1 rounded-full border border-[#DEE6E8]">
              Classical Bounded-Buffer Problem
            </span>
          </div>

          <p className="text-sm sm:text-base text-[#333333] leading-relaxed">
            In Operating Systems, multiple concurrent threads frequently share memory. Without synchronization, concurrent writes cause data corruption, missed items, and crashes.
            Here is how every physical part of the Canteen apparatus maps to an essential OS concurrency concept:
          </p>

          {/* Mapping Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* 1. Producer */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-[#A94D36] uppercase">Canteen Element</span>
                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#DEE6E8] text-[#62747C]">Thread</span>
              </div>
              <h3 className="font-bold text-sm text-[#263843]">Student Order Kiosks (P1, P2)</h3>
              <div className="pt-1 border-t border-[#DEE6E8]">
                <span className="text-[11px] font-mono font-bold text-[#167D8D] block">OS Concept:</span>
                <strong className="text-xs font-bold text-[#263843] block">Producer Thread</strong>
                <p className="text-[11px] text-[#62747C] mt-0.5 leading-relaxed">
                  Generates items and places them into shared memory. Blocks when buffer has no space.
                </p>
              </div>
            </div>

            {/* 2. Consumer */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-[#167D8D] uppercase">Canteen Element</span>
                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#DEE6E8] text-[#62747C]">Thread</span>
              </div>
              <h3 className="font-bold text-sm text-[#263843]">Kitchen Counter (C1)</h3>
              <div className="pt-1 border-t border-[#DEE6E8]">
                <span className="text-[11px] font-mono font-bold text-[#167D8D] block">OS Concept:</span>
                <strong className="text-xs font-bold text-[#263843] block">Consumer Thread</strong>
                <p className="text-[11px] text-[#62747C] mt-0.5 leading-relaxed">
                  Removes items from shared memory and processes them. Blocks when buffer is empty.
                </p>
              </div>
            </div>

            {/* 3. Bounded Buffer */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-[#263843] uppercase">Canteen Element</span>
                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#DEE6E8] text-[#62747C]">Memory</span>
              </div>
              <h3 className="font-bold text-sm text-[#263843]">5 Counter Bays (0 to 4)</h3>
              <div className="pt-1 border-t border-[#DEE6E8]">
                <span className="text-[11px] font-mono font-bold text-[#167D8D] block">OS Concept:</span>
                <strong className="text-xs font-bold text-[#263843] block">Bounded Buffer (N = 5)</strong>
                <p className="text-[11px] text-[#62747C] mt-0.5 leading-relaxed">
                  Fixed-size circular array in shared memory. Never silently resizes or overwrites.
                </p>
              </div>
            </div>

            {/* 4. empty Semaphore */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-[#167D8D] uppercase">Canteen Element</span>
                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#DEE6E8] text-[#62747C]">Semaphore</span>
              </div>
              <h3 className="font-bold text-sm text-[#263843]">Available Bays Counter</h3>
              <div className="pt-1 border-t border-[#DEE6E8]">
                <span className="text-[11px] font-mono font-bold text-[#167D8D] block">OS Concept:</span>
                <strong className="text-xs font-bold font-mono text-[#263843] block">empty (Counting Semaphore)</strong>
                <p className="text-[11px] text-[#62747C] mt-0.5 leading-relaxed">
                  Initial value: 5. Producers execute <code className="font-mono bg-white px-1 py-0.2 rounded border text-[10px]">sem_wait(&empty)</code> before placing an order.
                </p>
              </div>
            </div>

            {/* 5. full Semaphore */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-[#D97706] uppercase">Canteen Element</span>
                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#DEE6E8] text-[#62747C]">Semaphore</span>
              </div>
              <h3 className="font-bold text-sm text-[#263843]">Occupied Bays Counter</h3>
              <div className="pt-1 border-t border-[#DEE6E8]">
                <span className="text-[11px] font-mono font-bold text-[#167D8D] block">OS Concept:</span>
                <strong className="text-xs font-bold font-mono text-[#263843] block">full (Counting Semaphore)</strong>
                <p className="text-[11px] text-[#62747C] mt-0.5 leading-relaxed">
                  Initial value: 0. Consumers execute <code className="font-mono bg-white px-1 py-0.2 rounded border text-[10px]">sem_wait(&full)</code> before removing an order.
                </p>
              </div>
            </div>

            {/* 6. Mutex */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-[#237A57] uppercase">Canteen Element</span>
                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-[#DEE6E8] text-[#62747C]">Lock</span>
              </div>
              <h3 className="font-bold text-sm text-[#263843]">Service Turnstile / Gate</h3>
              <div className="pt-1 border-t border-[#DEE6E8]">
                <span className="text-[11px] font-mono font-bold text-[#167D8D] block">OS Concept:</span>
                <strong className="text-xs font-bold font-mono text-[#263843] block">mutex (Mutual Exclusion)</strong>
                <p className="text-[11px] text-[#62747C] mt-0.5 leading-relaxed">
                  Binary lock (1 = Free, 0 = Locked). Guarantees only one thread accesses the buffer slots at a time.
                </p>
              </div>
            </div>
          </div>

          {/* Explicit Concurrency Architecture Note */}
          <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] text-xs text-[#62747C] leading-relaxed flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#167D8D] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#263843]">Instruction-Level Interleaving:</strong> Two producer threads (P1, P2) and one consumer thread (C1) model real instruction interleaving and context switching inside an educational engine without launching native OS threads.
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION C: THREE QUESTIONS THE LAB ANSWERS               */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl border border-[#DEE6E8] p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F7F8FA] border border-[#DEE6E8] flex items-center justify-center text-sm font-bold font-mono text-[#167D8D]">
              C
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#263843]">
              Three Questions the Lab Answers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Q1 */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-2">
              <div className="w-6 h-6 rounded-full bg-[#263843] text-white text-xs font-bold flex items-center justify-center font-mono">
                1
              </div>
              <h3 className="font-bold text-sm text-[#263843]">
                What happens when the queue is full?
              </h3>
              <p className="text-xs text-[#62747C] leading-relaxed">
                When all 5 bays are occupied, the <code className="font-mono bg-white px-1 rounded border text-[10px]">empty</code> semaphore equals 0.
                The next producer blocks cleanly and waits outside the buffer. It cannot overwrite existing orders.
              </p>
            </div>

            {/* Q2 */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-2">
              <div className="w-6 h-6 rounded-full bg-[#263843] text-white text-xs font-bold flex items-center justify-center font-mono">
                2
              </div>
              <h3 className="font-bold text-sm text-[#263843]">
                What happens when the queue is empty?
              </h3>
              <p className="text-xs text-[#62747C] leading-relaxed">
                When no orders are waiting, the <code className="font-mono bg-white px-1 rounded border text-[10px]">full</code> semaphore equals 0.
                The kitchen blocks and sleeps until a producer places an item and signals the semaphore.
              </p>
            </div>

            {/* Q3 */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-2">
              <div className="w-6 h-6 rounded-full bg-[#263843] text-white text-xs font-bold flex items-center justify-center font-mono">
                3
              </div>
              <h3 className="font-bold text-sm text-[#263843]">
                Why is a mutex needed if we have semaphores?
              </h3>
              <p className="text-xs text-[#62747C] leading-relaxed">
                Semaphores count capacity, but inserting an item requires reading the <code className="font-mono bg-white px-1 rounded border text-[10px]">in</code> index, writing to the slot, and incrementing the index. Without a mutex, two producers can write into the same slot!
              </p>
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION D: THE SIXTH ORDER INTERACTIVE DIAGRAM           */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl border border-[#DEE6E8] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F7F8FA] border border-[#DEE6E8] flex items-center justify-center text-sm font-bold font-mono text-[#167D8D]">
                D
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#263843]">
                Interactive Demonstration: The Sixth Order
              </h2>
            </div>
            <span className="text-xs font-mono text-[#62747C] bg-[#F7F8FA] px-3 py-1 rounded-full border border-[#DEE6E8]">
              Backpressure Mechanics
            </span>
          </div>

          <p className="text-sm sm:text-base text-[#333333] leading-relaxed">
            Try this isolated mini-demonstration: All five buffer bays are full with orders <strong>[O1]</strong> through <strong>[O5]</strong>.
            A sixth order <strong>[O6]</strong> has arrived. Notice where it is waiting, and click the button to see what lets it enter.
          </p>

          {/* Interactive Stage */}
          <div className="bg-[#F7F8FA] border border-[#DEE6E8] rounded-2xl p-5 sm:p-6 space-y-6">
            {/* Top State Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#DEE6E8]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#263843] uppercase tracking-wider font-mono">
                  Buffer Capacity: N = 5
                </span>
                <span className="text-xs text-[#62747C] font-mono">
                  empty: <strong className="text-[#167D8D]">{demoEmpty}</strong> · full: <strong className="text-[#D97706]">{demoFull}</strong>
                </span>
              </div>

              {/* Reset Demo button */}
              {demoStep > 0 && (
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="inline-flex items-center gap-1.5 text-xs text-[#62747C] hover:text-[#263843] font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Demo</span>
                </button>
              )}
            </div>

            {/* Main Visual: 5 Buffer Bays + Outside Waiting Producer + Kitchen Counter */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Left: Blocked Producer P1 holding O6 (outside the buffer!) */}
              <div className="lg:col-span-3 p-4 rounded-xl border border-dashed transition-all text-center space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-amber-700">Outside Buffer</span>
                  <span className="text-[9px] font-mono bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                    {o6Location === 'IN_BAY_0' ? 'ADMITTED' : 'BLOCKED'}
                  </span>
                </div>

                <div className="text-xs font-bold text-[#263843]">Producer P1</div>

                {o6Location !== 'IN_BAY_0' ? (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 space-y-1 animate-pulse">
                    <div className="text-xs font-mono font-bold text-amber-900">[O6] Espresso</div>
                    <div className="text-[10px] text-amber-800">
                      {o6Location === 'OUTSIDE_WAITING' ? 'Waiting for capacity permit' : 'Moving to Bay 0...'}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-50 border border-[#DEE6E8] text-[11px] text-[#62747C]">
                    Order O6 placed into buffer. Producer is ready.
                  </div>
                )}
              </div>

              {/* Center: 5 Shared Buffer Bays */}
              <div className="lg:col-span-6 bg-white p-4 rounded-xl border border-[#DEE6E8] space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#62747C]">
                  <span>Shared 5-Bay Bounded Buffer</span>
                  <span className="font-mono text-[#167D8D]">
                    {demoStep === 1 ? '4/5 Occupied (Bay 0 free)' : '5/5 Occupied'}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {currentDemoSlots.map((slot, idx) => (
                    <div
                      key={`demo-slot-${idx}`}
                      className={`p-2 rounded-lg border text-center transition-all min-h-[72px] flex flex-col justify-between ${
                        slot
                          ? slot.id === 'O6'
                            ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200'
                            : 'bg-[#F7F8FA] border-[#DEE6E8]'
                          : 'bg-emerald-50/50 border-dashed border-emerald-300'
                      }`}
                    >
                      <span className="text-[9px] font-mono font-bold text-[#62747C] block">
                        Bay {idx}
                      </span>
                      {slot ? (
                        <div className="space-y-0.5">
                          <span className="text-xs font-mono font-bold text-[#263843] block">
                            {slot.id}
                          </span>
                          <span className="text-[9px] text-[#62747C] truncate block">
                            {slot.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          FREE
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Kitchen Consumer */}
              <div className="lg:col-span-3 p-4 rounded-xl bg-white border border-[#DEE6E8] text-center space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-[#167D8D]">Consumer C1</span>
                  <span className="text-[9px] font-mono bg-[#E4F3F3] text-[#167D8D] px-1.5 py-0.5 rounded font-bold">
                    Kitchen
                  </span>
                </div>

                <div className="text-xs font-bold text-[#263843]">Kitchen Pickup</div>

                {kitchenPlate ? (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 space-y-1">
                    <div className="text-xs font-mono font-bold text-emerald-900">
                      [{kitchenPlate.id}] {kitchenPlate.name}
                    </div>
                    <div className="text-[10px] text-emerald-700">Accepted & Served</div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#DEE6E8] text-[11px] text-[#62747C]">
                    Kitchen paused. Ready to accept orders.
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Control & Explanation Banner */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-[#62747C] leading-relaxed">
                {demoStep === 0 && (
                  <span>
                    The queue is saturated. Click the button to let the kitchen accept an order and release capacity.
                  </span>
                )}
                {demoStep === 1 && (
                  <span className="text-[#167D8D] font-semibold">
                    Kitchen accepts O1 from Bay 0! <code className="font-mono text-xs">signal(&empty)</code> unblocks waiting Producer P1...
                  </span>
                )}
                {demoStep === 2 && (
                  <span className="text-emerald-800 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Producer P1 enters Bay 0 with O6. Capacity was strictly preserved at N = 5!</span>
                  </span>
                )}
              </div>

              {demoStep === 0 && (
                <button
                  type="button"
                  onClick={handleAdvanceDemo}
                  className="px-4 py-2 rounded-xl bg-[#167D8D] hover:bg-[#076b76] text-white text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  Let the kitchen accept one order →
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* SECTION E: WHAT TO LOOK FOR IN 3D                        */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl border border-[#DEE6E8] p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F7F8FA] border border-[#DEE6E8] flex items-center justify-center text-sm font-bold font-mono text-[#167D8D]">
              E
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#263843]">
              What to Look For in the 3D Simulation
            </h2>
          </div>

          <p className="text-sm sm:text-base text-[#333333] leading-relaxed">
            When you open the 3D lab, you will see a mechanical tabletop apparatus with physical stations and tokens.
            Here is a visual roadmap of what each station represents:
          </p>

          {/* Visual Legend Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Producer Kiosks */}
            <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#A94D36]" />
                <span className="text-xs font-bold text-[#263843]">Kiosks (P1, P2)</span>
              </div>
              <p className="text-[11px] text-[#62747C] leading-relaxed">
                Located on the left. Watch them prepare trays and highlight when active or blocked.
              </p>
            </div>

            {/* 2. Arc Bays & Pointers */}
            <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#167D8D]" />
                <span className="text-xs font-bold text-[#263843]">5 Bays & Pointers</span>
              </div>
              <p className="text-[11px] text-[#62747C] leading-relaxed">
                Conveyor arc holding food trays. The Coral IN pointer shows next write; Teal OUT shows next read.
              </p>
            </div>

            {/* 3. Mutex Gate */}
            <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#237A57]" />
                <span className="text-xs font-bold text-[#263843]">Mutex Turnstile</span>
              </div>
              <p className="text-[11px] text-[#62747C] leading-relaxed">
                Front center gate. Turns green and opens when free; turns red and closes when locked by a thread.
              </p>
            </div>

            {/* 4. Kitchen Consumer */}
            <div className="p-3.5 rounded-xl bg-[#F7F8FA] border border-[#DEE6E8] space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#167D8D]" />
                <span className="text-xs font-bold text-[#263843]">Kitchen Counter (C1)</span>
              </div>
              <p className="text-[11px] text-[#62747C] leading-relaxed">
                Located on the right. Removes orders from OUT pointer bay and releases capacity permits.
              </p>
            </div>
          </div>

          {/* Color Tokens Key */}
          <div className="pt-3 border-t border-[#DEE6E8] flex flex-wrap items-center gap-4 text-xs font-mono text-[#62747C]">
            <span className="font-bold text-[#263843]">Color Key:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A94D36]" />
              <span>Coral: IN Pointer / Producer P1</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D97706]" />
              <span>Amber: Producer P2 / Blocked Waiting</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#167D8D]" />
              <span>Teal: OUT Pointer / Kitchen C1</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#237A57]" />
              <span>Emerald: Free Mutex / Available Slots</span>
            </span>
          </div>
        </section>

        {/* ======================================================== */}
        {/* BOTTOM PRIMARY CALL TO ACTION                            */}
        {/* ======================================================== */}
        <div className="bg-[#263843] text-white rounded-2xl p-6 sm:p-10 shadow-lg text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 text-[#167D8D] px-3.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider">
            Ready to explore?
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
            Launch the Interactive 3D Canteen Apparatus
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Start with one order, then try six to see why a producer waits. Step instruction-by-instruction, orbit in 3D, and inspect thread states.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={orderSnapshot && onSimulateOrder ? () => onSimulateOrder(orderSnapshot) : onOpenLab}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#167D8D] hover:bg-[#076b76] text-white text-sm sm:text-base font-bold shadow-md transition-all cursor-pointer group"
            >
              <span>{orderSnapshot ? 'Simulate this order in 3D' : 'Open Interactive 3D Lab with sample orders'}</span>
              <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
            </button>
            {orderSnapshot && onReturnToOrder && (
              <button
                type="button"
                onClick={onReturnToOrder}
                className="inline-flex items-center gap-1.5 px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-slate-300" />
                <span>Return to my order</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
