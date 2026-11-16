import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function inspectCurrentLayout() {
  console.log('=== INSPECTING CURRENT LIVE QUEUE FLOW LAYOUT ===');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-inspect-' + Date.now());

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

  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    page.send(JSON.stringify({ id, method, params }));
  });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('DOM.enable');

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

  // 1. Desktop 1440px
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: 'http://localhost:5180/app?tab=synclab' });
  await wait(1800);

  // Set up an interesting active state with orders in buffer, prep, completed
  await evalCode(`window.confirm = () => true;`);
  await evalCode(`
    const clearBtn = Array.from(document.querySelectorAll('.header-action-btn')).find(b => b.textContent.includes('Clear'));
    if (clearBtn) clearBtn.click();
  `);
  await wait(400);

  // Add 3 producers and 2 consumers
  await evalCode(`
    const pPlus = document.querySelector('.process-stepper-group[aria-label="Producer Controls"] .stepper-btn-plus');
    const cPlus = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"] .stepper-btn-plus');
    if (pPlus) { pPlus.click(); pPlus.click(); pPlus.click(); }
    if (cPlus) { cPlus.click(); cPlus.click(); }
  `);
  await wait(400);

  // Step 20 times to produce orders, dequeue, cook
  for (let i = 0; i < 20; i++) {
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(70);
  }
  await wait(500);

  await scrollToFlow();
  await capture('inspect-current-1440');

  // 2. Laptop 1280px
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait(400);
  await scrollToFlow();
  await capture('inspect-current-1280');

  // 3. Mobile 390px
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await wait(400);
  await scrollToFlow();
  await capture('inspect-current-390');

  console.log('=== INSPECTION COMPLETE ===');
  edge.kill();
  process.exit(0);
}

inspectCurrentLayout().catch((err) => {
  console.error(err);
  process.exit(1);
});
