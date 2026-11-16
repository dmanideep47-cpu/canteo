import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function runLiveDiagramAudit() {
  console.log('=== STARTING LIVE QUEUE DIAGRAM 10-POINT VERIFICATION ===');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-diagram-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9993',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9993/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    console.error('Edge failed to launch on 9993');
    process.exit(1);
  }

  const targets = await (await fetch('http://127.0.0.1:9993/json/list')).json();
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
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });

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
    console.log(`[SAVED] ${name}.png`);
  };

  const scrollToFlow = async () => {
    await evalCode(`
      const el = document.querySelector('.live-queue-flow-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    await wait(250);
  };

  const clearSession = async () => {
    await evalCode(`window.confirm = () => true;`);
    await evalCode(`
      const clearBtn = Array.from(document.querySelectorAll('.header-action-btn')).find(b => b.textContent.includes('Clear'));
      if (clearBtn) clearBtn.click();
    `);
    await wait(350);
  };

  for (let i = 0; i < 40; i++) {
    const ready = await evalCode(`return Boolean(document.querySelector('.live-queue-flow-section'));`);
    if (ready) break;
    await wait(200);
  }

  // -------------------------------------------------------------------------
  // 1. Entirely Empty Session
  // -------------------------------------------------------------------------
  await clearSession();
  await scrollToFlow();
  await capture('diagram-01-entirely-empty');

  // -------------------------------------------------------------------------
  // 2. One Queued Order (Front Annotation)
  // -------------------------------------------------------------------------
  await evalCode(`
    const pPlus = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus');
    if (pPlus) pPlus.click();
  `);
  await wait(300);
  for (let i = 0; i < 6; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(60);
  }
  await wait(400);
  await scrollToFlow();
  await capture('diagram-02-one-queued-order');

  // -------------------------------------------------------------------------
  // 3. Five Queued Orders (Full Queue Tray 5 of 5 occupied)
  // -------------------------------------------------------------------------
  await evalCode(`
    const pPlus = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus');
    if (pPlus) { pPlus.click(); pPlus.click(); pPlus.click(); pPlus.click(); }
  `);
  await wait(300);
  // Step through remaining 4 producers
  for (let i = 0; i < 28; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(60);
  }
  await wait(400);
  await scrollToFlow();
  await capture('diagram-03-five-queued-orders');

  // -------------------------------------------------------------------------
  // 4. Circular Wraparound (Front at slot 4 -> Back at slot 0/1)
  // -------------------------------------------------------------------------
  // Add 1 consumer to drain 4 orders, then add 2 producers to wrap around
  await evalCode(`
    const cPlus = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-plus');
    if (cPlus) cPlus.click();
  `);
  await wait(300);
  for (let i = 0; i < 24; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(60);
  }
  await wait(400);
  await scrollToFlow();
  await capture('diagram-04-circular-wraparound');

  // -------------------------------------------------------------------------
  // 5. Multiple Waiters (Producers Waiting for Capacity + Consumers Waiting for Orders)
  // -------------------------------------------------------------------------
  await clearSession();
  // Add 4 consumers on empty buffer -> all 4 wait for orders
  await evalCode(`
    const cPlus = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-plus');
    if (cPlus) { cPlus.click(); cPlus.click(); cPlus.click(); cPlus.click(); }
  `);
  await wait(300);
  for (let i = 0; i < 4; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(80);
  }
  await wait(400);
  await scrollToFlow();
  await capture('diagram-05-multiple-waiters');

  // -------------------------------------------------------------------------
  // 6. Concurrent Preparation (2 Consumers actively cooking with progress)
  // -------------------------------------------------------------------------
  await clearSession();
  await evalCode(`
    const pPlus = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus');
    const cPlus = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-plus');
    if (pPlus) { pPlus.click(); pPlus.click(); }
    if (cPlus) { cPlus.click(); cPlus.click(); }
  `);
  await wait(300);
  for (let i = 0; i < 22; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(70);
  }
  await wait(400);
  await scrollToFlow();
  await capture('diagram-06-concurrent-preparation');

  // -------------------------------------------------------------------------
  // 7. Recent Completions (Finished dishes with Total count)
  // -------------------------------------------------------------------------
  for (let i = 0; i < 18; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(70);
  }
  await wait(500);
  await scrollToFlow();
  await capture('diagram-07-recent-completions');

  // -------------------------------------------------------------------------
  // 8. Paused State Pill & View Details Toggle
  // -------------------------------------------------------------------------
  await evalCode(`
    const detailsBtn = document.querySelector('.lqf-details-btn');
    if (detailsBtn) detailsBtn.click();
  `);
  await wait(300);
  await scrollToFlow();
  await capture('diagram-08-paused-and-details');

  // -------------------------------------------------------------------------
  // 9. Narrow Layout (390px Mobile Responsive)
  // -------------------------------------------------------------------------
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await wait(500);
  await scrollToFlow();
  await capture('diagram-09-narrow-layout');

  // -------------------------------------------------------------------------
  // 10. Reduced Motion Emulation
  // -------------------------------------------------------------------------
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await wait(300);
  await capture('diagram-10-reduced-motion');

  console.log('=== ALL 10 AUDIT SCENARIOS COMPLETED ===');
  edge.kill();
  process.exit(0);
}

runLiveDiagramAudit().catch((err) => {
  console.error(err);
  process.exit(1);
});
