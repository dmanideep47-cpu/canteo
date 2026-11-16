import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';

console.log('--- REPRODUCTION TESTS FOR MULTI-CONSUMER BEHAVIOR ---');

// Test 1: One producer and one consumer
function test1() {
  console.log('\n[Test 1] 1 Producer, 1 Consumer');
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1); // P1
  engine.addConsumer(1); // C1
  let steps = 0;
  while (steps < 30) {
    const s = engine.snapshot();
    const ready = s.processes.filter(p => p.state === 'READY');
    if (!ready.length) {
      if (s.workers.some(w => w.state === 'PREPARING')) {
        engine.tickKitchen();
      } else {
        break;
      }
    } else {
      engine.step();
    }
    steps++;
  }
  const snap = engine.snapshot();
  console.log(`Finished after ${steps} steps. P1: ${snap.processes[0].state}, C1: ${snap.processes[1].state}, Occupancy: ${snap.occupancy}, Completed: ${snap.completedOrders.length}`);
}

// Test 2: One producer and three consumers
function test2() {
  console.log('\n[Test 2] 1 Producer, 3 Consumers');
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1); // P1
  engine.addConsumer(3); // C1, C2, C3
  let steps = 0;
  while (steps < 40) {
    const s = engine.snapshot();
    const ready = s.processes.filter(p => p.state === 'READY');
    if (!ready.length) {
      if (s.workers.some(w => w.state === 'PREPARING')) {
        engine.tickKitchen();
      } else {
        console.log(`Halted at step ${steps}: No ready processes, workers:`, s.workers.map(w => `${w.id}:${w.state}`).join(', '));
        console.log('Processes:', s.processes.map(p => `${p.id}:${p.state}(pc=${p.pc},wait=${p.waitingFor})`).join(', '));
        console.log('full semaphore:', s.full, 'waiters:', engine.full.waiters);
        break;
      }
    } else {
      engine.step();
    }
    steps++;
  }
}

// Test 3: One producer and eight consumers
function test3() {
  console.log('\n[Test 3] 1 Producer, 8 Consumers');
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(1); // P1
  engine.addConsumer(8); // C1..C8
  let steps = 0;
  while (steps < 60) {
    const s = engine.snapshot();
    const ready = s.processes.filter(p => p.state === 'READY');
    if (!ready.length) {
      if (s.workers.some(w => w.state === 'PREPARING')) {
        engine.tickKitchen();
      } else {
        console.log(`Halted at step ${steps}:`);
        console.log('Processes:', s.processes.map(p => `${p.id}:${p.state}(wait=${p.waitingFor})`).join(', '));
        console.log('full waiters:', engine.full.waiters);
        break;
      }
    } else {
      engine.step();
    }
    steps++;
  }
}

// Test 4: Three producers and eight consumers
function test4() {
  console.log('\n[Test 4] 3 Producers, 8 Consumers');
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addProducer(3); // P1, P2, P3
  engine.addConsumer(8); // C1..C8
  let steps = 0;
  while (steps < 100) {
    const s = engine.snapshot();
    const ready = s.processes.filter(p => p.state === 'READY');
    if (!ready.length) {
      if (s.workers.some(w => w.state === 'PREPARING')) {
        engine.tickKitchen();
      } else {
        console.log(`Halted at step ${steps}. Occupancy: ${s.occupancy}`);
        console.log('Processes:', s.processes.map(p => `${p.id}:${p.state}(wait=${p.waitingFor})`).join(', '));
        console.log('full waiters:', engine.full.waiters);
        break;
      }
    } else {
      engine.step();
    }
    steps++;
  }
}

// Test 5: Adding a producer after all consumers have blocked
function test5() {
  console.log('\n[Test 5] Adding a producer after all consumers have blocked');
  const engine = new ProducerConsumerEngine({ persistentConsumers: true });
  engine.addConsumer(3); // C1, C2, C3
  // Step until all consumers are blocked on full
  for (let i = 0; i < 10; i++) {
    const s = engine.snapshot();
    const ready = s.processes.filter(p => p.state === 'READY');
    if (!ready.length) break;
    engine.step();
  }
  let s = engine.snapshot();
  console.log('Before adding producer:', s.processes.map(p => `${p.id}:${p.state}(wait=${p.waitingFor})`).join(', '));
  console.log('full waiters:', engine.full.waiters);

  // Now add producer P1
  console.log('Adding producer P1...');
  engine.addProducer(1);
  s = engine.snapshot();
  console.log('After adding P1, ready:', s.processes.filter(p => p.state === 'READY').map(p => p.id));

  // Run steps until P1 finishes and unblocks a consumer
  for (let i = 0; i < 15; i++) {
    s = engine.snapshot();
    const ready = s.processes.filter(p => p.state === 'READY');
    if (!ready.length) {
      if (s.workers.some(w => w.state === 'PREPARING')) {
        engine.tickKitchen();
      } else {
        break;
      }
    } else {
      engine.step();
    }
  }
  s = engine.snapshot();
  console.log('Final state after P1 added:', s.processes.map(p => `${p.id}:${p.state}(wait=${p.waitingFor})`).join(', '));
  console.log('full waiters:', engine.full.waiters);
}

test1();
test2();
test3();
test4();
test5();

