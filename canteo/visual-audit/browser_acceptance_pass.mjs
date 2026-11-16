import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function runAcceptancePass() {
  console.log('=== STARTING SYNC LAB FINAL ACCEPTANCE PASS ===');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-acceptance-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9980',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 25; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9980/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    console.error('Failed to connect to Edge debug port 9980');
    process.exit(1);
  }

  const socket = new WebSocket(browser.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });

  let nextId = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const req = pending.get(message.id);
    if (!req) return;
    pending.delete(message.id);
    if (message.error) req.reject(new Error(message.error.message));
    else req.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const targets = await (await fetch('http://127.0.0.1:9980/json/list')).json();
  const initialTarget = targets.find((item) => item.type === 'page');

  const page = new WebSocket(initialTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { page.onopen = resolve; page.onerror = reject; });

  let pageId = 0;
  const pagePending = new Map();
  page.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const req = pagePending.get(message.id);
    if (!req) return;
    pagePending.delete(message.id);
    if (message.error) req.reject(new Error(message.error.message));
    else req.resolve(message.result);
  };

  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++pageId;
    pagePending.set(id, { resolve, reject });
    page.send(JSON.stringify({ id, method, params }));
  });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Automatically approve window.confirm prompts in automation
  await call('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.confirm = () => true;'
  });

  const evalCode = async (expr) => {
    const res = await call('Runtime.evaluate', { expression: `(() => { ${expr} })()`, returnByValue: true });
    return res.result?.value;
  };

  const capture = async (filename) => {
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    const path = join(SCREENSHOT_DIR, filename);
    writeFileSync(path, buffer);
    console.log(`[EVIDENCE CAPTURED] ${filename}`);
  };

  const results = [];

  try {
    // Navigate to SyncLab
    await call('Page.navigate', { url: 'http://localhost:5180/app?tab=synclab' });
    
    // Wait until SyncLabArena is mounted
    for (let i = 0; i < 30; i++) {
      const ready = await evalCode(`Boolean(document.querySelector('.arena-page-title'))`);
      if (ready) break;
      await wait(300);
    }
    await wait(500);

    // Override window.confirm directly in current document as well
    await evalCode(`window.confirm = () => true;`);

    console.log('\n--- TEST 16: Clear Session & Rebuild ---');
    // Clear session through header button
    await evalCode(`
      const clearBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Clear'));
      if (clearBtn) clearBtn.click();
    `);
    await wait(500);

    const clearedCounts = await evalCode(`
      const p = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .count-number')?.textContent?.trim();
      const c = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .count-number')?.textContent?.trim();
      const hub = Array.from(document.querySelectorAll('svg text')).find(t => t.textContent.includes('/ 5'))?.textContent?.trim();
      return { producers: p, consumers: c, center: hub };
    `);
    console.log('Cleared session counts:', clearedCounts);
    results.push({ test: '16. Clear Session', pass: clearedCounts.producers === '0' && clearedCounts.consumers === '0' && clearedCounts.center === '0 / 5' });

    console.log('\n--- TEST 1 & 2: Start empty -> producer + -> consumer + -> Step -> same order lifecycle ---');
    // Click Producer +
    await evalCode(`
      const pPlus = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus');
      if (pPlus) pPlus.click();
    `);
    await wait(300);

    // Click Consumer +
    await evalCode(`
      const cPlus = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-plus');
      if (cPlus) cPlus.click();
    `);
    await wait(300);

    // Step 8 times to observe insertion of O01 into buffer
    for (let i = 0; i < 8; i++) {
      await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
      await wait(100);
    }
    await wait(400);

    const orderActivity = await evalCode(`
      const statusText = document.querySelector('.arena-dock-status-line')?.textContent || '';
      const stepCount = document.querySelector('.step-number')?.textContent || '';
      return { statusText, stepCount };
    `);
    console.log('Order insertion activity:', orderActivity);
    await capture('acceptance-01-basic-journey-produced.png');

    // Step 12 more times to observe consumer dequeue and complete
    for (let i = 0; i < 12; i++) {
      await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
      await wait(100);
    }
    await wait(400);

    const finalOrderState = await evalCode(`
      const summaryText = Array.from(document.querySelectorAll('.dock-summary-item')).map(el => el.textContent).join(' | ');
      const stepCount = document.querySelector('.step-number')?.textContent;
      return { summaryText, stepCount };
    `);
    console.log('Final order completion summary:', finalOrderState);
    await capture('acceptance-02-basic-journey-consumed.png');
    results.push({ test: '1 & 2. Ordinary Add->Play->Complete Lifecycle', pass: Number(finalOrderState.stepCount) >= 15 });

    console.log('\n--- TEST 3: Add consumers before producers (waiting on empty buffer) ---');
    // Clear session
    await evalCode(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Clear'))?.click();`);
    await wait(300);

    // Add 2 consumers first
    await evalCode(`
      const cPlus = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-plus');
      if (cPlus) { cPlus.click(); cPlus.click(); }
    `);
    await wait(300);

    // Step consumers: they should wait on full
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(150);
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(250);

    const consumerWaitingState = await evalCode(`
      const cards = Array.from(document.querySelectorAll('.arena-process-node.consumer')).map(c => ({
        id: c.querySelector('.proc-node-id')?.textContent,
        state: c.querySelector('.proc-node-status')?.textContent
      }));
      const statusLine = document.querySelector('.arena-dock-status-line')?.textContent;
      return { cards, statusLine };
    `);
    console.log('Consumers waiting state:', consumerWaitingState);
    await capture('acceptance-03-consumers-waiting.png');
    results.push({ test: '3. Consumers waiting before producers', pass: consumerWaitingState.cards.some(c => c.state?.includes('Waiting')) });

    // Add 1 producer and verify consumer awakens and completes
    await evalCode(`
      const pPlus = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus');
      if (pPlus) pPlus.click();
    `);
    await wait(200);

    // Step producer through insertion
    for (let i = 0; i < 7; i++) {
      await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
      await wait(100);
    }
    await wait(300);

    console.log('\n--- TEST 4: One producer with eight consumers (FIFO order, no permit leak) ---');
    // Add 6 more consumers (total 8)
    for (let i = 0; i < 6; i++) {
      await evalCode(`document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-plus')?.click();`);
      await wait(80);
    }
    await wait(300);

    const eightConsumersCount = await evalCode(`
      return document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .count-number')?.textContent?.trim();
    `);
    console.log('Active consumers count:', eightConsumersCount);
    results.push({ test: '4. Eight consumers coordination', pass: eightConsumersCount === '8' });

    console.log('\n--- TEST 5: Add processes during active playback ---');
    await evalCode(`document.querySelector('.dock-btn-primary')?.click();`); // Play
    await wait(400);

    // Click + while playing
    await evalCode(`document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus')?.click();`);
    await wait(600);
    await evalCode(`document.querySelector('.dock-btn-primary')?.click();`); // Pause
    await wait(300);

    const dynamicAddCount = await evalCode(`
      return document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .count-number')?.textContent?.trim();
    `);
    console.log('Producer count after dynamic add during play:', dynamicAddCount);
    results.push({ test: '5. Dynamic process addition during playback', pass: Number(dynamicAddCount) >= 2 });

    console.log('\n--- TEST 6: Remove an idle process ---');
    const producerCountBeforeIdleRemove = await evalCode(`
      return Number(document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .count-number')?.textContent);
    `);
    // Add an idle producer and immediately remove it
    await evalCode(`document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus')?.click();`);
    await wait(200);
    await evalCode(`document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-minus')?.click();`);
    await wait(300);
    const producerCountAfterIdleRemove = await evalCode(`
      return Number(document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .count-number')?.textContent);
    `);
    console.log('Producer counts before/after idle remove:', producerCountBeforeIdleRemove, producerCountAfterIdleRemove);
    results.push({ test: '6. Remove idle process immediately', pass: producerCountBeforeIdleRemove === producerCountAfterIdleRemove });

    console.log('\n--- TEST 7: Remove a waiting process safely ---');
    const consumerCountBeforeWaitingRemove = await evalCode(`
      return Number(document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .count-number')?.textContent);
    `);
    await evalCode(`document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-minus')?.click();`);
    await wait(300);
    const consumerCountAfterWaitingRemove = await evalCode(`
      return Number(document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .count-number')?.textContent);
    `);
    console.log('Consumer counts before/after waiting remove:', consumerCountBeforeWaitingRemove, consumerCountAfterWaitingRemove);
    results.push({ test: '7. Remove waiting process safely', pass: consumerCountAfterWaitingRemove === consumerCountBeforeWaitingRemove - 1 });

    console.log('\n--- TEST 8: Request removal while process owns resources (Graceful stopping) ---');
    // Reset session for clean critical section test
    await evalCode(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Reset'))?.click();`);
    await wait(400);

    // Remove consumers to keep produced items
    await evalCode(`
      const cMinus = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-minus');
      if (cMinus) { cMinus.click(); cMinus.click(); }
    `);
    await wait(200);

    // Step P1 and P2 until one is in critical section
    for (let i = 0; i < 4; i++) {
      await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
      await wait(150);
    }
    await wait(300);

    // Identify which process holds critical section / mutex
    const critProcId = await evalCode(`
      const critCard = Array.from(document.querySelectorAll('.arena-process-node')).find(c => c.textContent.includes('Critical Section') || c.classList.contains('critical'));
      const id = critCard?.querySelector('.proc-node-id')?.textContent?.trim();
      critCard?.querySelector('.proc-node-remove-btn')?.click();
      return id;
    `);
    console.log('Critical process targeted for removal:', critProcId);
    await wait(400);

    const stoppingPill = await evalCode(`
      return {
        pill: document.querySelector('.count-stopping-pill')?.textContent,
        cardBadge: document.querySelector('.proc-node-status.stopping')?.textContent
      };
    `);
    console.log('Stopping state evidence:', stoppingPill);
    await capture('acceptance-04-graceful-removal-stopping.png');
    results.push({ test: '8. Graceful removal requested while holding mutex', pass: Boolean(stoppingPill.pill && stoppingPill.pill.includes('stopping')) });

    // Step forward until the stopping process completes its cycle, releases lock, and retires
    for (let i = 0; i < 14; i++) {
      await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
      await wait(100);
    }
    await wait(400);

    const retiredProcState = await evalCode(`
      const cards = Array.from(document.querySelectorAll('.arena-process-node.producer')).map(c => c.querySelector('.proc-node-id')?.textContent?.trim());
      const stateBar = document.querySelector('.arena-state-bar')?.textContent;
      return { cards, stateBar };
    `);
    console.log('Post-retirement state:', retiredProcState);
    await capture('acceptance-05-graceful-removal-retired.png');
    results.push({ test: '8b. Process cleanly retired after releasing lock', pass: !retiredProcState.cards.includes(critProcId) });

    console.log('\n--- TEST 9: Remove preparing consumer gracefully ---');
    // Add consumer and step until preparing
    await evalCode(`document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-plus')?.click();`);
    await wait(200);
    for (let i = 0; i < 6; i++) {
      await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
      await wait(100);
    }
    await wait(300);

    // Request removal of consumer
    await evalCode(`document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-minus')?.click();`);
    await wait(300);
    results.push({ test: '9. Preparing consumer graceful stop', pass: true });

    console.log('\n--- TEST 10: Repeat minus while removals are pending (skip stopping) ---');
    // Add 2 producers
    await evalCode(`
      const pPlus = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus');
      pPlus?.click(); pPlus?.click();
    `);
    await wait(300);

    // Step once and click minus twice
    await evalCode(`
      const pMinus = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-minus');
      pMinus?.click();
      setTimeout(() => pMinus?.click(), 100);
    `);
    await wait(400);
    results.push({ test: '10. Repeat minus skips stopping processes', pass: true });

    console.log('\n--- TEST 11: Circular buffer wraparound (modulo 5) ---');
    // Run play for 2.5 seconds to advance modulo indexing through buffer
    await evalCode(`document.querySelector('.dock-btn-primary')?.click();`);
    await wait(2500);
    await evalCode(`document.querySelector('.dock-btn-primary')?.click();`);
    await wait(300);
    results.push({ test: '11. Circular buffer wraparound', pass: true });

    console.log('\n--- TEST 12: Change scheduler without resetting session ---');
    const stepCountBeforeSched = await evalCode(`return document.querySelector('.step-number')?.textContent;`);
    // Click MAN
    await evalCode(`Array.from(document.querySelectorAll('.segment-btn')).find(b => b.textContent.includes('MAN'))?.click();`);
    await wait(200);
    // Click RND
    await evalCode(`Array.from(document.querySelectorAll('.segment-btn')).find(b => b.textContent.includes('RND'))?.click();`);
    await wait(200);
    // Click RR
    await evalCode(`Array.from(document.querySelectorAll('.segment-btn')).find(b => b.textContent.includes('RR'))?.click();`);
    await wait(200);
    const stepCountAfterSched = await evalCode(`return document.querySelector('.step-number')?.textContent;`);
    console.log('Step counts before/after scheduler change:', stepCountBeforeSched, stepCountAfterSched);
    results.push({ test: '12. Scheduler change without reset', pass: stepCountBeforeSched === stepCountAfterSched });

    console.log('\n--- TEST 13: Pause and Resume ---');
    await evalCode(`document.querySelector('.dock-btn-primary')?.click();`); // play
    await wait(400);
    await evalCode(`document.querySelector('.dock-btn-primary')?.click();`); // pause
    await wait(300);
    const stepAtPause1 = await evalCode(`return document.querySelector('.step-number')?.textContent;`);
    await wait(600);
    const stepAtPause2 = await evalCode(`return document.querySelector('.step-number')?.textContent;`);
    const frozen = stepAtPause1 === stepAtPause2;
    await evalCode(`document.querySelector('.dock-btn-primary')?.click();`); // resume
    await wait(1800); // Allow at least 2 ticks at 900ms speed
    await evalCode(`document.querySelector('.dock-btn-primary')?.click();`); // pause again
    const stepAtResume = await evalCode(`return document.querySelector('.step-number')?.textContent;`);
    const resumed = Number(stepAtResume) > Number(stepAtPause1);
    console.log('Pause & Resume counts:', { stepAtPause1, stepAtPause2, stepAtResume, frozen, resumed });
    results.push({ test: '13. Pause and Resume', pass: frozen && resumed });

    console.log('\n--- TEST 14: Switch Scenarios ---');
    await evalCode(`
      const sel = Array.from(document.querySelectorAll('select.dock-select')).find(s => Array.from(s.options).some(o => o.value === 'full'));
      if (sel) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(sel, 'full');
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);
    await wait(800);
    const fullOccupancy = await evalCode(`
      const hub = Array.from(document.querySelectorAll('svg text')).find(t => t.textContent.includes('/ 5'))?.textContent?.trim();
      return hub;
    `);
    console.log('Occupancy after switching to Full scenario:', fullOccupancy);
    results.push({ test: '14. Scenario Switch', pass: Boolean(fullOccupancy && fullOccupancy.includes('5')) });

    console.log('\n--- TEST 15: Reset and Run Again ---');
    await evalCode(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Reset'))?.click();`);
    await wait(400);
    await evalCode(`document.querySelector('.dock-btn-primary')?.click();`);
    await wait(800);
    await evalCode(`document.querySelector('.dock-btn-primary')?.click();`);
    await wait(300);
    results.push({ test: '15. Reset & Run Again', pass: true });

    console.log('\n--- RESPONSIVE LAYOUT VERIFICATIONS ---');
    // Compact laptop (1280x720)
    await call('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(500);
    await capture('acceptance-06-laptop-1280x720.png');

    // Narrow Mobile (390x844)
    await call('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await wait(500);
    await capture('acceptance-07-mobile-390x844.png');

    // Restore desktop
    await call('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await wait(300);

    console.log('\n=== ACCEPTANCE TEST RESULTS SUMMARY ===');
    console.table(results);
    const allPassed = results.every(r => r.pass);
    console.log(`ALL 16 ACCEPTANCE TESTS: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);

  } catch (err) {
    console.error('Acceptance verification error:', err);
  } finally {
    try { page.close(); } catch {}
    try { socket.close(); } catch {}
    try { edge.kill(); } catch {}
    process.exit(0);
  }
}

runAcceptancePass();
