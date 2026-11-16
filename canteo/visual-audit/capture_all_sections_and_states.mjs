import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-test-profile-' + Date.now());
  await mkdir(profileDir, { recursive: true });

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9888',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  edge.on('error', (err) => console.error('Edge spawn error:', err));

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9888/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch { }
  }

  if (!browser) {
    edge.kill();
    throw new Error('Failed to connect to Edge debugging port 9888');
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

  await send('Target.createTarget', { url: 'http://localhost:5173/app?tab=synclab' });
  await wait(1500);

  const targets = await (await fetch('http://127.0.0.1:9888/json/list')).json();
  const target = targets.find((item) => item.type === 'page' && (item.url.includes('/app?tab=synclab') || item.url.includes('localhost:5173')));
  if (!target) {
    edge.kill();
    throw new Error('App target not found');
  }

  const page = new WebSocket(target.webSocketDebuggerUrl);
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
  await call('DOM.enable');
  await call('Runtime.enable');

  const evaluate = async (expression) => (await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;

  const outDir = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
  const screenshot = async (name, width = 1440, height = 900, mobile = false) => {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
    await wait(400);
    const shot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(join(outDir, `${name}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${name}.png (${width}x${height})`);
  };

  const scrollToEl = async (selector, offset = 40) => {
    await evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        const scroller = document.querySelector('main.overflow-y-auto') || document.documentElement;
        if (el && scroller) {
          const rect = el.getBoundingClientRect();
          const currentScroll = scroller.scrollTop;
          scroller.scrollTop = currentScroll + rect.top - ${offset};
        } else if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      })()
    `);
    await wait(400);
  };

  const scrollToTop = async () => {
    await evaluate(`
      const scroller = document.querySelector('main.overflow-y-auto') || document.querySelector('.synclab-shell')?.parentElement || window;
      if (scroller.scrollTo) scroller.scrollTo(0, 0);
      else scroller.scrollTop = 0;
    `);
    await wait(300);
  };

  // Wait for React to render nav buttons
  for (let i = 0; i < 40; i++) {
    const count = await evaluate(`document.querySelectorAll('.sl-section-nav button').length`);
    if (count > 0) break;
    await wait(200);
  }

  const clickSection = async (secNumber) => {
    await scrollToTop();
    const label = await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.sl-section-nav button')).find(b => b.textContent.includes('${secNumber}'));
        if (btn) { btn.click(); return btn.textContent; }
        return 'NOT_FOUND';
      })()
    `);
    console.log(`Clicked section [${secNumber}]: ${label}`);
    await wait(600);
    await scrollToTop();
  };

  // 1. Initial State: Simulator Top (Empty buffer, semaphores 5/0/1)
  console.log('Capturing: audit-state-01-simulator-empty');
  await clickSection('02');
  await screenshot('audit-state-01-simulator-empty', 1440, 900);

  // 2. Add producers and consumer, execute some instructions
  console.log('Running simulation actions...');
  await evaluate(`
    const addProd = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Producer'));
    const addCons = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Consumer'));
    if (addProd) { addProd.click(); addProd.click(); }
    if (addCons) { addCons.click(); }
  `);
  await wait(400);

  // Step 6 instructions
  await evaluate(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step Instruction'));
    if (stepBtn) {
      for (let i = 0; i < 6; i++) stepBtn.click();
    }
  `);
  await wait(500);

  // 2. Active Run: Buffer with item, worker preparing
  console.log('Capturing: audit-state-02-simulator-active-run');
  await scrollToEl('.sl-buffer-stage', 'center');
  await screenshot('audit-state-02-simulator-active-run', 1440, 900);

  // 3. Semaphores and Integrity panel
  console.log('Capturing: audit-state-03-semaphores-and-integrity');
  await scrollToEl('.sl-resource-integrity-grid', 'start');
  await screenshot('audit-state-03-semaphores-and-integrity', 1440, 900);

  // 4. Execution Analysis (Timeline & Occupancy)
  console.log('Capturing: audit-state-04-execution-analysis');
  await scrollToEl('.sl-timeline-card', 20);
  await screenshot('audit-state-04-execution-analysis', 1440, 900);

  // 5. Section 01 System Model
  console.log('Capturing: audit-section-01-system-model');
  await clickSection('01');
  await wait(400);
  await screenshot('audit-section-01-system-model', 1440, 900);

  // 6. Section 03 Race Condition Laboratory
  console.log('Capturing: audit-section-03-race-laboratory');
  await clickSection('03');
  await wait(400);
  await screenshot('audit-section-03-race-laboratory', 1440, 900);

  // 7. Section 04 Synchronization Solution
  console.log('Capturing: audit-section-04-solution');
  await clickSection('04');
  await wait(400);
  await screenshot('audit-section-04-solution', 1440, 900);

  // 8. Section 05 Flowcharts
  console.log('Capturing: audit-section-05-flowcharts');
  await clickSection('05');
  await wait(400);
  await screenshot('audit-section-05-flowcharts', 1440, 900);

  // 9. Back to Simulator for Responsive checks
  await clickSection('02');

  // Tablet 1024x768
  console.log('Capturing: audit-responsive-1024x768');
  await screenshot('audit-responsive-1024x768', 1024, 768);

  // Mobile 390x844
  console.log('Capturing: audit-responsive-390x844');
  await screenshot('audit-responsive-390x844', 390, 844, true);

  // 10. Verify other tabs and Landing page
  console.log('Capturing other tabs: Menu, Orders, Kitchen, Landing...');
  // Menu tab
  await call('Page.navigate', { url: 'http://localhost:5173/app?tab=menu' });
  await wait(1000);
  await screenshot('audit-screen-menu', 1440, 900);

  // Orders tab
  await call('Page.navigate', { url: 'http://localhost:5173/app?tab=orders' });
  await wait(1000);
  await screenshot('audit-screen-orders', 1440, 900);

  // Kitchen tab
  await call('Page.navigate', { url: 'http://localhost:5173/app?tab=kitchen' });
  await wait(1000);
  await screenshot('audit-screen-kitchen', 1440, 900);

  // Landing page
  await call('Page.navigate', { url: 'http://localhost:5173/' });
  await wait(1200);
  await screenshot('audit-screen-landing', 1440, 900);

  console.log('All comprehensive audit screenshots captured successfully.');
  edge.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error in capture run:', err);
  process.exit(1);
});
