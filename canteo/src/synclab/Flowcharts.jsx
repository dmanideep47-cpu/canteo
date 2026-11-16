import React, { useState } from 'react';
import { ArrowDown, Code2, AlertTriangle, HelpCircle } from 'lucide-react';

const NODES_DATA = {
  producer: [
    { id: 'p1', label: '1. Create Order Ticket', posix: 'order = create_order()', canteen: 'Student decides on meal (e.g. Masala Dosa).', meaning: 'Process allocates private memory for order data.', effect: 'None on shared memory.', mistake: 'Writing into shared queue before checking permits.', ifRemoved: 'Buffer contains garbage data.' },
    { id: 'p2', label: '2. Acquire Empty Slot: wait(empty)', posix: 'sem_wait(&empty);', canteen: 'Student checks whether a free peg is available on the ticket rack.', meaning: 'Atomically decrements empty semaphore. Blocks if empty == 0.', effect: 'empty decrements by 1.', mistake: 'Acquiring mutex before wait(empty), causing deadlock if buffer is full!', ifRemoved: 'Buffer overflow: 6th order overwrites slot, causing memory corruption.' },
    { id: 'p3', label: '3. Enter Critical Section: wait(mutex)', posix: 'pthread_mutex_lock(&mutex);', canteen: 'Student steps up to counter to write on ticket board.', meaning: 'Claims exclusive lock on queue pointers.', effect: 'mutex: 1 → 0.', mistake: 'Omitting mutex: concurrent writers overwrite each other’s orders.', ifRemoved: 'Lost updates: two simultaneous submissions collide on the same slot.' },
    { id: 'p4', label: '4. Insert Order at tail pointer', posix: 'buffer[tail] = order;', canteen: 'Student pins ticket onto slot indicated by tail.', meaning: 'Stores order pointer into shared bounded array.', effect: 'buffer[tail] occupied.', mistake: 'Writing outside critical section.', ifRemoved: 'Order is lost without ever being stored.' },
    { id: 'p5', label: '5. Advance tail modulo 5', posix: 'tail = (tail + 1) % 5;', canteen: 'Student shifts pointer mark to next peg.', meaning: 'Circular indexing ensures memory is continuously recycled.', effect: 'tail advances modulo 5.', mistake: 'Omitting modulo: index exceeds array bounds (buffer overflow crash).', ifRemoved: 'Pointer exceeds bounds after 5th order.' },
    { id: 'p6', label: '6. Leave Critical Section: signal(mutex)', posix: 'pthread_mutex_unlock(&mutex);', canteen: 'Student steps away from counter.', meaning: 'Releases exclusive lock so other students or kitchen can enter.', effect: 'mutex: 0 → 1.', mistake: 'Holding mutex while waiting for kitchen preparation.', ifRemoved: 'Deadlock: queue is locked forever.' },
    { id: 'p7', label: '7. Signal Ready Order: signal(full)', posix: 'sem_post(&full);', canteen: 'Student rings kitchen bell indicating a new order is ready.', meaning: 'Increments full semaphore; awakens sleeping kitchen worker.', effect: 'full increments by 1.', mistake: 'Signaling full inside the mutex lock.', ifRemoved: 'Kitchen sleeps forever on wait(full), causing starvation.' },
  ],
  consumer: [
    { id: 'c1', label: '1. Acquire Ready Order: wait(full)', posix: 'sem_wait(&full);', canteen: 'Kitchen worker checks if order ticket exists on the counter.', meaning: 'Atomically decrements full semaphore. Blocks if full == 0.', effect: 'full decrements by 1.', mistake: 'Acquiring mutex before wait(full), blocking producers from depositing orders!', ifRemoved: 'Buffer underflow: consumer reads null/garbage memory from empty counter.' },
    { id: 'c2', label: '2. Enter Critical Section: wait(mutex)', posix: 'pthread_mutex_lock(&mutex);', canteen: 'Kitchen worker touches ticket rack to take order.', meaning: 'Claims exclusive access to shared read pointer.', effect: 'mutex: 1 → 0.', mistake: 'Omitting mutex: two workers take the exact same order.', ifRemoved: 'Duplicate claim fault: multiple workers prepare the same dish.' },
    { id: 'c3', label: '3. Remove Order at head pointer', posix: 'order = buffer[head];', canteen: 'Kitchen worker removes order ticket from head slot.', meaning: 'Copies order pointer out of shared queue.', effect: 'buffer[head] cleared.', mistake: 'Cooking food while still holding the mutex.', ifRemoved: 'Worker has no order reference.' },
    { id: 'c4', label: '4. Advance head modulo 5', posix: 'head = (head + 1) % 5;', canteen: 'Kitchen worker shifts read mark to next slot.', meaning: 'Circular indexing modulo 5.', effect: 'head advances modulo 5.', mistake: 'Index out of bounds without modulo.', ifRemoved: 'Worker repeatedly reads same slot.' },
    { id: 'c5', label: '5. Leave Critical Section: signal(mutex)', posix: 'pthread_mutex_unlock(&mutex);', canteen: 'Kitchen worker steps away from counter.', meaning: 'Releases lock so counter is accessible immediately.', effect: 'mutex: 0 → 1.', mistake: 'Forgetting to unlock mutex.', ifRemoved: 'Deadlock: entire system frozen.' },
    { id: 'c6', label: '6. Signal Free Counter Slot: signal(empty)', posix: 'sem_post(&empty);', canteen: 'Kitchen signals that a peg is now free for students.', meaning: 'Increments empty semaphore; awakens any blocked producer.', effect: 'empty increments by 1.', mistake: 'Signaling before removing ticket.', ifRemoved: 'Producers block forever once queue fills.' },
    { id: 'c7', label: '7. Cook Food (Outside Lock!)', posix: 'cook_food(order);', canteen: 'Worker cooks dish at stove concurrently with other operations.', meaning: 'Long-running task executed outside critical section.', effect: 'Dish prepared.', mistake: 'Cooking inside mutex: starves all other threads!', ifRemoved: 'Food is never cooked.' },
  ],
};

export default function Flowcharts() {
  const [activeTab, setActiveTab] = useState('producer');
  const [selectedNodeId, setSelectedNodeId] = useState('p2');

  const nodes = NODES_DATA[activeTab];
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Tab Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`sl2-nav-tab ${activeTab === 'producer' ? 'active' : ''}`}
            onClick={() => { setActiveTab('producer'); setSelectedNodeId('p2'); }}
          >
            Student Producer Protocol
          </button>
          <button
            className={`sl2-nav-tab ${activeTab === 'consumer' ? 'active' : ''}`}
            onClick={() => { setActiveTab('consumer'); setSelectedNodeId('c1'); }}
          >
            Kitchen Consumer Protocol
          </button>
        </div>
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--black-400)' }}>
          Click any flowchart step to inspect POSIX invariants
        </span>
      </div>

      {/* Main Flowchart & Node Inspector Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Flowchart Sequence Column */}
        <div className="sl2-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          {nodes.map((n, i) => {
            const isSelected = selectedNodeId === n.id;
            const isCritical = n.label.includes('Critical') || n.label.includes('Insert') || n.label.includes('Remove') || n.label.includes('Advance');

            return (
              <React.Fragment key={n.id}>
                <div
                  className={`sl2-concept-card ${isSelected ? 'active-node' : ''}`}
                  style={{
                    width: '100%',
                    maxWidth: '420px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--producer)' : isCritical ? 'var(--critical-border)' : 'var(--white-300)',
                    backgroundColor: isSelected ? 'var(--producer-bg)' : isCritical ? 'var(--critical-bg)' : 'var(--white-0)',
                    boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    borderLeft: isCritical ? '4px solid var(--critical)' : '4px solid var(--producer)',
                  }}
                  onClick={() => setSelectedNodeId(n.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--black-900)' }}>{n.label}</span>
                    <code style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--black-500)' }}>
                      {n.posix}
                    </code>
                  </div>
                </div>
                {i < nodes.length - 1 && <ArrowDown size={14} color="var(--black-400)" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Node Inspector Panel */}
        <div className="sl2-card">
          <div className="sl2-card-header">
            <span className="sl2-card-title">
              <Code2 size={14} /> STEP INSPECTOR: {selectedNode.label}
            </span>
          </div>

          <div className="sl2-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span className="sl2-insp-card-label">POSIX C INSTRUCTION</span>
              <div style={{ backgroundColor: 'var(--black-900)', color: '#60A5FA', padding: '10px 14px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '12.5px', marginTop: '4px' }}>
                {selectedNode.posix}
              </div>
            </div>

            <div>
              <span className="sl2-insp-card-label">CANTEEN SYSTEM ANALOGY</span>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--black-700)', lineHeight: 1.5 }}>
                {selectedNode.canteen}
              </p>
            </div>

            <div>
              <span className="sl2-insp-card-label">OPERATING SYSTEM MEANING & EFFECT</span>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--black-700)', lineHeight: 1.5 }}>
                {selectedNode.meaning}
              </p>
              <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--consumer)', marginTop: '4px' }}>
                State Effect: {selectedNode.effect}
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--waiting-bg)', border: '1px solid var(--waiting-border)', padding: '10px 12px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--waiting)', textTransform: 'uppercase' }}>
                <AlertTriangle size={13} /> COMMON STUDENT MISTAKE
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#92400E', lineHeight: 1.4 }}>
                {selectedNode.mistake}
              </p>
            </div>

            <div style={{ backgroundColor: 'var(--error-bg)', border: '1px solid var(--error-border)', padding: '10px 12px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--error)', textTransform: 'uppercase' }}>
                <HelpCircle size={13} /> WHAT HAPPENS IF THIS STEP IS REMOVED?
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#B91C1C', lineHeight: 1.4 }}>
                {selectedNode.ifRemoved}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

