import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function runBrowserVerification() {
  console.log('=== STARTING SIMPLIFIED LIVE QUEUE FLOW VERIFICATION ===');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-lqf-clean-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9991',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9991/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    console.error('Edge failed to launch on 9991');
    process.exit(1);
  }

  const targets = await (await fetch('http://127.0.0.1:9991/json/list')).json();
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

  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    page.send(JSON.stringify({ id, method, params }));
  });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('DOM.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });

  await call('Page.navigate', { url: 'http://localhost:5180/app?tab=synclab' });
  await wait(1800);

  const evalCode = async (expr) => {
    const res = await call('Runtime.evaluate', { expression: `(() => { ${expr} })()`, returnByValue: true });
    return res.result?.value;
  };

  const capture = async (name) => {
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    writeFileSync(join(SCREENSHOT_DIR, `${name}.png`), buffer);
    console.log(`[SAVED SCREENSHOT] ${name}.png`);
  };

  const scrollToFlow = async () => {
    await evalCode(`
      const el = document.querySelector('.live-queue-flow-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    await wait(300);
  };

  for (let i = 0; i < 40; i++) {
    const ready = await evalCode(`return Boolean(document.querySelector('.live-queue-flow-section'));`);
    if (ready) break;
    await wait(250);
  }

  console.log('SyncLab and LiveQueueFlow loaded.');

  // =========================================================================
  // 1. EMPTY SESSION SCREENSHOT
  // =========================================================================
  await evalCode(`window.confirm = () => true;`);
  await evalCode(`
    const clearBtn = Array.from(document.querySelectorAll('.header-action-btn')).find(b => b.textContent.includes('Clear'));
    if (clearBtn) clearBtn.click();
  `);
  await wait(500);
  await scrollToFlow();
  await capture('lqf-simplified-01-empty');

  // =========================================================================
  // 2. TWO QUEUED ORDERS SCREENSHOT
  // =========================================================================
  // Add 2 producers and advance them until they produce into slot 0 and slot 1
  await evalCode(`
    const pPlus = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus');
    if (pPlus) { pPlus.click(); pPlus.click(); }
  `);
  await wait(400);

  // Step P1 and P2 through production
  for (let i = 0; i < 14; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(80);
  }
  await wait(500);
  await scrollToFlow();
  await capture('lqf-simplified-02-queued-orders');

  // =========================================================================
  // 3. MULTIPLE WAITING CONSUMERS SCREENSHOT
  // =========================================================================
  // Clear or drain, then add 3 consumers without any orders to produce waiting
  await evalCode(`
    const clearBtn = Array.from(document.querySelectorAll('.header-action-btn')).find(b => b.textContent.includes('Clear'));
    if (clearBtn) clearBtn.click();
  `);
  await wait(400);

  await evalCode(`
    const cPlus = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-plus');
    if (cPlus) { cPlus.click(); cPlus.click(); cPlus.click(); }
  `);
  await wait(300);

  // Step C1, C2, C3 so they block waiting for orders
  for (let i = 0; i < 3; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(100);
  }
  await wait(400);

  // Also click "Details" to show the expandable breakdown in screenshot
  await evalCode(`
    const detailsBtn = document.querySelector('.lqf-waiting-summary-block .lqf-inline-link-btn');
    if (detailsBtn) detailsBtn.click();
  `);
  await wait(300);
  await scrollToFlow();
  await capture('lqf-simplified-03-waiting-consumers');

  // =========================================================================
  // 4. CONCURRENT PREPARATION SCREENSHOT
  // =========================================================================
  // Reset and add 2 producers and 2 consumers
  await evalCode(`
    const clearBtn = Array.from(document.querySelectorAll('.header-action-btn')).find(b => b.textContent.includes('Clear'));
    if (clearBtn) clearBtn.click();
  `);
  await wait(400);

  await evalCode(`
    const pPlus = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus');
    const cPlus = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-plus');
    if (pPlus) { pPlus.click(); pPlus.click(); }
    if (cPlus) { cPlus.click(); cPlus.click(); }
  `);
  await wait(400);

  // Step until both consumers dequeue and enter PREPARING
  for (let i = 0; i < 22; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(80);
  }
  await wait(500);
  await scrollToFlow();
  await capture('lqf-simplified-04-concurrent-prep');

  // =========================================================================
  // 5. RECENT COMPLETIONS SCREENSHOT
  // =========================================================================
  // Advance playback or tick steps to let kitchen preparation complete
  for (let i = 0; i < 18; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(80);
  }
  // If still preparing, step more
  for (let i = 0; i < 12; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(80);
  }
  await wait(600);
  await scrollToFlow();
  await capture('lqf-simplified-05-recent-completions');

  // =========================================================================
  // 6. NARROW-SCREEN MOBILE LAYOUT SCREENSHOT
  // =========================================================================
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await wait(500);
  await scrollToFlow();
  await capture('lqf-simplified-06-narrow-screen');

  console.log('=== VERIFICATION COMPLETED SUCCESSFULLY ===');
  edge.kill();
  process.exit(0);
}

runBrowserVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
