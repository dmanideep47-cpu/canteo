import { ProducerConsumerEngine } from '../src/synclab/engine/ProducerConsumerEngine.js';

const eng = new ProducerConsumerEngine({ persistentConsumers: true });
eng.addProducer(2); // P1, P2
eng.addConsumer(3); // C1, C2, C3

console.log('--- Initial State ---');
console.log('Processes:', eng.processes.map(p => p.id));

for (let i = 0; i < 40; i++) {
  const readyBefore = eng.processes.filter(p => p.state === 'READY' || p.state === 'RUNNING');
  if (readyBefore.length === 0) {
    const prep = eng.processes.filter(p => p.state === 'PREPARING');
    if (prep.length > 0) {
      eng.tickKitchen();
      console.log(`Step ${i+1}: Kitchen ticked. In prep: ${prep.map(p => p.id).join(', ')}`);
      continue;
    } else {
      console.log(`Step ${i+1}: Deadlock or all blocked/done. Ready: 0, Prep: 0`);
      break;
    }
  }
  const state = eng.step();
  const last = eng.lastInstruction;
  console.log(`Step ${i+1}: proc=${last?.processId} op=${last?.op} empty=${state.empty.value ?? state.empty} full=${state.full.value ?? state.full} occ=${state.buffer?.occupancy ?? 0} readyCount=${readyBefore.length}`);
}

console.log('--- Final Status ---');
console.log('Processes:', eng.processes.map(p => ({ id: p.id, state: p.state, pc: p.pc, wait: p.waitingFor })));
console.log('Workers:', eng.workers.map(w => ({ id: w.id, state: w.state, order: w.assignedOrderId, prep: `${w.preparationProgress}/${w.preparationDuration}` })));
console.log('Orders:', Object.values(eng.orders).map(o => ({ id: o.id, lifecycle: o.lifecycle })));

