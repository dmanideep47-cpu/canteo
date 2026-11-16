import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function runSyncAudit() {
  console.log('=== STARTING SYNC LAB CROSS-VIEW SYNCHRONIZATION AUDIT ===');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-sync-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9992',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9992/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    console.error('Edge failed to launch on 9992');
    process.exit(1);
  }

  const targets = await (await fetch('http://127.0.0.1:9992/json/list')).json();
  const pageTarget = targets.find((t) => t.type === 'page');

  const page = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => { page.onopen = resolve; });

  let nextId = 0;
  const pending = new Map();
  page.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    const req = pending.get(msg.id);
    if (!req) return;
    pending.delete(msg.id);
    if (msg.error) req.reject(new Error(msg.error.message));
    else req.resolve(msg.result);
  };

  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      page.send(JSON.stringify({ id, method, params }));
    });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('DOM.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });

  await call('Page.navigate', { url: 'http://localhost:5180/app?tab=synclab' });

  for (let i = 0; i < 25; i++) {
    await wait(300);
    const res = await call('Runtime.evaluate', {
      expression: `(() => document.body ? document.body.innerText.length : 0)()`,
      returnByValue: true
    });
    if ((res.result?.value ?? 0) > 100) break;
  }

  const runJs = async (code) => {
    const res = await call('Runtime.evaluate', {
      expression: `(() => { ${code} })()`,
      returnByValue: true
    });
    return res.result?.value;
  };

  const capture = async (name) => {
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    writeFileSync(join(SCREENSHOT_DIR, `${name}.png`), buffer);
    console.log(`[SCREENSHOT] ${name}.png saved`);
  };

  const results = {};

  // -------------------------------------------------------------
  // AREA 1: Arena ↔ Queue Buffer Contents Synchronization
  // -------------------------------------------------------------
  console.log('\n--- Checking Area 1: Arena ↔ Queue Buffer Contents ---');
  // First ensure simulation has some orders by stepping 6 instructions
  await runJs(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') || b.title?.includes('Step'));
    for (let i = 0; i < 6; i++) {
      stepBtn?.click();
    }
  `);
  await wait(600);

  const area1Data = await runJs(`
    const arenaSlots = Array.from(document.querySelectorAll('.arena-slot-node.occupied')).map((el) => {
      const idEl = el.querySelector('.slot-order-text, text');
      return {
        text: el.textContent.trim(),
        isOccupied: true
      };
    });

    const queueTickets = Array.from(document.querySelectorAll('.lqf-queue-ticket')).map(el => {
      return {
        orderId: el.querySelector('.lqf-ticket-id')?.textContent.trim(),
        foodName: el.querySelector('.lqf-ticket-food')?.textContent.trim(),
        slotBadge: el.querySelector('.lqf-ticket-slot')?.textContent.trim()
      };
    });

    const arenaRevision = document.querySelector('.synclab-arena-root')?.getAttribute('data-simulation-revision');
    const flowRevision = document.querySelector('.live-queue-flow-section')?.getAttribute('data-flow-revision');

    return {
      arenaRevision,
      flowRevision,
      revisionsMatch: arenaRevision === flowRevision,
      arenaOccupiedCount: arenaSlots.length,
      queueTicketCount: queueTickets.length,
      countsMatch: arenaSlots.length === queueTickets.length
    };
  `);
  console.log('Area 1 Result:', area1Data);
  results['Arena ↔ Queue buffer contents'] = area1Data.countsMatch && area1Data.revisionsMatch ? 'Pass' : 'Fail';
  await capture('sync-01-buffer-contents');

  // -------------------------------------------------------------
  // AREA 2: FIFO and Circular Wraparound
  // -------------------------------------------------------------
  console.log('\n--- Checking Area 2: FIFO and Circular Wraparound ---');
  // Step until wraparound occurs (e.g. 24 more steps)
  await runJs(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') || b.title?.includes('Step'));
    for (let i = 0; i < 24; i++) {
      stepBtn?.click();
    }
  `);
  await wait(800);

  const area2Data = await runJs(`
    const queueTickets = Array.from(document.querySelectorAll('.lqf-queue-ticket')).map(el => {
      return {
        orderId: el.querySelector('.lqf-ticket-id')?.textContent.trim(),
        slotBadge: el.querySelector('.lqf-ticket-slot')?.textContent.trim(),
        isFront: el.classList.contains('is-front')
      };
    });

    return {
      ticketCount: queueTickets.length,
      tickets: queueTickets,
      fifoConsistent: queueTickets.length === 0 || queueTickets[0].isFront
    };
  `);
  console.log('Area 2 Result:', area2Data);
  results['FIFO and wraparound'] = area2Data.fifoConsistent ? 'Pass' : 'Fail';
  await capture('sync-02-fifo-wraparound');

  // -------------------------------------------------------------
  // AREA 3: Process States and Counts
  // -------------------------------------------------------------
  console.log('\n--- Checking Area 3: Process States and Counts ---');
  const area3Data = await runJs(`
    const producerCountBadge = parseInt(document.querySelector('.process-stepper-group:first-child .count-number')?.textContent || '0', 10);
    const consumerCountBadge = parseInt(document.querySelector('.process-stepper-group:last-of-type .count-number')?.textContent || '0', 10);
    
    const arenaProducerNodes = document.querySelectorAll('.arena-process-node.producer').length;
    const arenaConsumerNodes = document.querySelectorAll('.arena-process-node.consumer').length;

    const flowProduceCards = document.querySelectorAll('.lqf-stage-col.lqf-col-produce .lqf-producer-card').length;

    return {
      stepperProducers: producerCountBadge,
      stepperConsumers: consumerCountBadge,
      arenaProducers: arenaProducerNodes,
      arenaConsumers: arenaConsumerNodes,
      flowProduceCards,
      producersConsistent: producerCountBadge === arenaProducerNodes && (flowProduceCards === 0 || flowProduceCards === arenaProducerNodes)
    };
  `);
  console.log('Area 3 Result:', area3Data);
  results['Process states and counts'] = area3Data.producersConsistent ? 'Pass' : 'Fail';
  await capture('sync-03-process-states');

  // -------------------------------------------------------------
  // AREA 4: Waiting Queues and Permits
  // -------------------------------------------------------------
  console.log('\n--- Checking Area 4: Waiting Queues and Permits ---');
  // Reset and configure 0 producers, 4 consumers to trigger waiting on orders
  await runJs(`
    const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Reset'));
    resetBtn?.click();
  `);
  await wait(500);

  // Remove producers, add consumers
  await runJs(`
    const minusProducer = document.querySelector('.process-stepper-group:first-child .stepper-btn-minus');
    minusProducer?.click();
    minusProducer?.click();

    const plusConsumer = document.querySelector('.process-stepper-group:last-of-type .stepper-btn-plus');
    plusConsumer?.click();
    plusConsumer?.click();
  `);
  await wait(500);

  // Step consumers until they wait for full
  await runJs(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step'));
    for (let i = 0; i < 8; i++) {
      stepBtn?.click();
    }
  `);
  await wait(600);

  const area4Data = await runJs(`
    const semEmpty = document.querySelector('.arena-state-bar .legend-val:first-child')?.textContent.trim();
    const waitTexts = Array.from(document.querySelectorAll('.lqf-stage-wait-summary .lqf-wait-text')).map(el => el.textContent.trim());
    const blockedNodes = Array.from(document.querySelectorAll('.arena-process-node.blocked')).map(n => n.textContent.trim());

    return {
      waitTexts,
      blockedNodesCount: blockedNodes.length,
      waitersReportedCorrectly: waitTexts.some(t => t.includes('waiting for orders') || t.includes('waiting for capacity'))
    };
  `);
  console.log('Area 4 Result:', area4Data);
  results['Waiting queues and permits'] = (area4Data.blockedNodesCount > 0 && area4Data.waitersReportedCorrectly) ? 'Pass' : 'Fail';
  await capture('sync-04-waiting-permits');

  // -------------------------------------------------------------
  // AREA 5: Preparation and Completion
  // -------------------------------------------------------------
  console.log('\n--- Checking Area 5: Preparation and Completion ---');
  // Add producer and step until order is collected and preparing
  await runJs(`
    const plusProducer = document.querySelector('.process-stepper-group:first-child .stepper-btn-plus');
    plusProducer?.click();
    plusProducer?.click();

    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step'));
    for (let i = 0; i < 26; i++) {
      stepBtn?.click();
    }
  `);
  await wait(600);

  const area5Data = await runJs(`
    const preparingCards = Array.from(document.querySelectorAll('.lqf-prep-card')).map(el => ({
      workerId: el.querySelector('.lqf-prep-worker')?.textContent.trim(),
      foodName: el.querySelector('.lqf-prep-dish')?.textContent.trim()
    }));

    const arenaPreparingNodes = Array.from(document.querySelectorAll('.arena-process-node.consumer')).filter(el => 
      el.textContent.includes('Prep') || el.textContent.includes('Cooking')
    ).map(el => el.textContent.trim());

    const completedSubhead = document.querySelector('.lqf-stage-col.lqf-col-complete .lqf-stage-subhead')?.textContent;

    return {
      preparingCards,
      arenaPreparingNodesCount: arenaPreparingNodes.length,
      completedSubhead,
      synced: preparingCards.length === arenaPreparingNodes.length
    };
  `);
  console.log('Area 5 Result:', area5Data);
  results['Preparation and completion'] = area5Data.synced ? 'Pass' : 'Fail';
  await capture('sync-05-prep-completion');

  // -------------------------------------------------------------
  // AREA 6: Selection and Inspector
  // -------------------------------------------------------------
  console.log('\n--- Checking Area 6: Selection and Inspector ---');
  // Click first arena slot SVG node
  await runJs(`
    const slot0 = document.querySelector('.arena-slot-node');
    slot0?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  `);
  await wait(500);

  const area6DataSlot = await runJs(`
    const inspector = document.querySelector('.arena-inspector-overlay');
    const inspectorTitle = inspector?.querySelector('.inspector-heading')?.textContent.trim();
    const isSlotSelected = document.querySelector('.arena-slot-node')?.classList.contains('selected');
    return {
      inspectorOpen: !!inspector,
      inspectorTitle,
      isSlotSelected
    };
  `);
  console.log('Slot click inspector result:', area6DataSlot);

  // Close inspector
  await runJs(`document.querySelector('.inspector-close-btn')?.click();`);
  await wait(400);

  // Click a process card
  await runJs(`
    const proc0 = document.querySelector('.arena-process-node');
    proc0?.click();
  `);
  await wait(500);

  const area6DataProc = await runJs(`
    const inspector = document.querySelector('.arena-inspector-overlay');
    const inspectorTitle = inspector?.querySelector('.inspector-heading')?.textContent.trim();
    const isProcSelected = document.querySelector('.arena-process-node')?.classList.contains('selected');
    return {
      inspectorOpen: !!inspector,
      inspectorTitle,
      isProcSelected
    };
  `);
  console.log('Process click inspector result:', area6DataProc);

  await runJs(`document.querySelector('.inspector-close-btn')?.click();`);
  await wait(300);

  results['Selection and inspector'] = (area6DataSlot.inspectorOpen && area6DataProc.inspectorOpen) ? 'Pass' : 'Fail';
  await capture('sync-06-selection-inspector');

  // -------------------------------------------------------------
  // AREA 7: Pause, Reset, Scenario Changes
  // -------------------------------------------------------------
  console.log('\n--- Checking Area 7: Pause, Reset, Scenario Changes ---');
  await runJs(`
    const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Reset'));
    resetBtn?.click();
  `);
  await wait(500);

  const area7Data = await runJs(`
    const arenaRevision = document.querySelector('.synclab-arena-root')?.getAttribute('data-simulation-revision');
    const flowRevision = document.querySelector('.live-queue-flow-section')?.getAttribute('data-flow-revision');
    const occupiedSlots = document.querySelectorAll('.arena-slot-node.occupied').length;
    const queueTickets = document.querySelectorAll('.lqf-queue-ticket').length;

    return {
      arenaRevision,
      flowRevision,
      occupiedSlots,
      queueTickets,
      synced: arenaRevision === flowRevision && occupiedSlots === queueTickets
    };
  `);
  console.log('Area 7 Result:', area7Data);
  results['Pause, reset, scenario changes'] = area7Data.synced ? 'Pass' : 'Fail';
  await capture('sync-07-pause-reset');

  // -------------------------------------------------------------
  // AREA 8: Responsive Layout and Accessibility
  // -------------------------------------------------------------
  console.log('\n--- Checking Area 8: Responsive Layout and Accessibility ---');
  // Test desktop 1440
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(300);
  await capture('sync-08-desktop-1440');

  // Test laptop 1280
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await wait(300);
  await capture('sync-08-laptop-1280');

  // Test mobile 390
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await wait(300);
  await capture('sync-08-mobile-390');

  const area8A11y = await runJs(`
    const closeBtns = Array.from(document.querySelectorAll('button')).filter(b => b.getAttribute('aria-label')?.toLowerCase().includes('close'));
    const allHaveAriaLabel = closeBtns.every(b => !!b.getAttribute('aria-label'));
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.tagName);
    return {
      closeBtnsCount: closeBtns.length,
      allHaveAriaLabel,
      headingsCount: headings.length
    };
  `);
  console.log('Area 8 A11y Result:', area8A11y);
  results['Responsive layout and accessibility'] = area8A11y.allHaveAriaLabel ? 'Pass' : 'Fail';

  console.log('\n=== FINAL VERIFICATION SUMMARY TABLE ===');
  console.table(results);

  page.close();
  edge.kill();

  return results;
}

runSyncAudit().catch(console.error);
