import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-final-profile-' + Date.now());
  await mkdir(profileDir, { recursive: true });

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9899',
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
      const res = await fetch('http://127.0.0.1:9899/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    edge.kill();
    throw new Error('Failed to connect to Edge debugging port 9899');
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

  const targets = await (await fetch('http://127.0.0.1:9899/json/list')).json();
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
    await wait(350);
    const shot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(join(outDir, `${name}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${name}.png (${width}x${height})`);
  };

  const scrollToTop = async () => {
    await evaluate(`
      (() => {
        const scroller = document.querySelector('main.overflow-y-auto') || document.documentElement;
        if (scroller) scroller.scrollTop = 0;
      })()
    `);
    await wait(300);
  };

  const scrollToEl = async (selector, offset = 40) => {
    const numOffset = typeof offset === 'number' ? offset : 40;
    await evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        const scroller = document.querySelector('main.overflow-y-auto') || document.documentElement;
        if (el && scroller) {
          const rect = el.getBoundingClientRect();
          scroller.scrollTop = scroller.scrollTop + rect.top - ${numOffset};
        }
      })()
    `);
    await wait(400);
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
    console.log(`Navigated to section [${secNumber}]: ${label}`);
    await wait(500);
    await scrollToTop();
  };

  // --- CAPTURE SECTION 01: SYSTEM OVERVIEW ---
  console.log('Capturing Section 01 System Overview...');
  await clickSection('01');
  await screenshot('review-01-system-overview-1440', 1440, 900);
  await screenshot('review-01-system-overview-1280', 1280, 800);

  // --- CAPTURE SECTION 02: PRODUCER-CONSUMER SIMULATOR (EMPTY) ---
  console.log('Capturing Section 02 Empty State...');
  await clickSection('02');
  await screenshot('review-02-simulator-empty-1440', 1440, 900);
  await screenshot('review-02-simulator-empty-1280', 1280, 800);

  // --- RUN SIMULATION & CAPTURE ACTIVE BUFFER & WORKSPACE ---
  console.log('Adding processes and running active simulation...');
  await evaluate(`
    (() => {
      const addProd = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Producer'));
      const addCons = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Consumer'));
      if (addProd) { addProd.click(); addProd.click(); addProd.click(); }
      if (addCons) { addCons.click(); }
    })()
  `);
  await wait(400);

  // Advance 8 steps
  await evaluate(`
    (() => {
      const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step Instruction'));
      if (stepBtn) {
        for (let i = 0; i < 8; i++) stepBtn.click();
      }
    })()
  `);
  await wait(500);

  console.log('Capturing Section 02 Active State...');
  await scrollToTop();
  await screenshot('review-02-simulator-active-1440', 1440, 900);
  await screenshot('review-02-simulator-active-1280', 1280, 800);

  // Capture Semaphore Resources & Integrity panel
  console.log('Capturing Semaphore & Integrity panel...');
  await scrollToEl('.sl-resource-integrity-grid', 60);
  await screenshot('review-02-simulator-semaphores-1440', 1440, 900);

  // Capture Process Execution Trace
  console.log('Capturing Process Execution Trace...');
  await scrollToEl('.sl-timeline-card', 20);
  await screenshot('review-02-execution-trace-1440', 1440, 900);
  await screenshot('review-02-execution-trace-1280', 1280, 800);

  // Step more to test long history (advance 10 more instructions)
  console.log('Testing long history progression...');
  await evaluate(`
    (() => {
      const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step Instruction'));
      if (stepBtn) {
        for (let i = 0; i < 10; i++) stepBtn.click();
      }
    })()
  `);
  await wait(500);
  await scrollToEl('.sl-timeline-card', 20);
  await screenshot('review-02-execution-trace-long-1440', 1440, 900);

  // --- CAPTURE SECTION 03: SYNCHRONIZATION LAB ---
  console.log('Capturing Section 03 Synchronization Lab...');
  await clickSection('03');
  await screenshot('review-03-synclab-1440', 1440, 900);
  await screenshot('review-03-synclab-1280', 1280, 800);

  // --- CAPTURE SECTION 04: RACE CONDITION LAB ---
  console.log('Capturing Section 04 Race Condition Lab...');
  await clickSection('04');
  await screenshot('review-04-racelab-1440', 1440, 900);
  await screenshot('review-04-racelab-1280', 1280, 800);

  // --- CAPTURE SECTION 05: SOLUTION & ANALYSIS (FLOWCHARTS) ---
  console.log('Capturing Section 05 Flowcharts...');
  await clickSection('05');
  await screenshot('review-05-flowcharts-1440', 1440, 900);
  await screenshot('review-05-flowcharts-1280', 1280, 800);

  // --- CAPTURE RESPONSIVE TABLET & MOBILE ---
  console.log('Capturing Responsive Tablet (1024x768) and Mobile (390x844)...');
  await clickSection('02');
  await scrollToTop();
  await screenshot('review-responsive-tablet-1024', 1024, 768);
  await screenshot('review-responsive-mobile-390', 390, 844, true);

  // Scroll to trace on tablet & mobile
  await scrollToEl('.sl-timeline-card', 20);
  await screenshot('review-responsive-tablet-trace-1024', 1024, 768);
  await screenshot('review-responsive-mobile-trace-390', 390, 844, true);

  console.log('All review screenshots captured successfully!');
  edge.kill();
}

run().catch((err) => {
  console.error('Run failed:', err);
  process.exit(1);
});

