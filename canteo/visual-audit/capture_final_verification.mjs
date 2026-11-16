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
    '--remote-debugging-port=9333',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9333/json/version');
      if (res.ok) { browser = await res.json(); break; }
    } catch {}
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

  await send('Target.createTarget', { url: 'http://127.0.0.1:5173/app?tab=synclab' });
  await wait(800);

  const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
  const target = targets.find((item) => item.type === 'page' && item.url.includes('/app?tab=synclab'));

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

  const scrollToSelector = async (selector) => {
    await evaluate(`
      (() => {
        const el = document.querySelector('${selector}');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      })()
    `);
    await wait(350);
  };

  const screenshot = async (filename, width = 1440, height = 900, mobile = false) => {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
    await wait(400);
    const shot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(new URL(`./${filename}.png`, import.meta.url), Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${filename}.png (${width}x${height})`);
  };

  await wait(1500);

  // 1. Initial state
  await scrollToSelector('.sl-analysis-section');
  await screenshot('audit-final-01-initial-1440x900', 1440, 900);

  // 2. Full queue scenario
  await evaluate(`
    const select = document.querySelector('.sl-scenario-row select');
    if (select) {
      select.value = 'full-queue';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const loadBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Load scenario'));
      loadBtn?.click();
    }
  `);
  await wait(600);
  await scrollToSelector('.sl-analysis-section');
  await screenshot('audit-final-02-full-queue-1440x900', 1440, 900);

  // 3. Blocked producer (Add P6 and step it)
  await evaluate(`
    const addProducerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Producer'));
    addProducerBtn?.click();
  `);
  await wait(300);
  await evaluate(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step instruction'));
    stepBtn?.click();
  `);
  await wait(500);
  await scrollToSelector('.sl-analysis-section');
  await screenshot('audit-final-03-blocked-producer-1440x900', 1440, 900);

  // 4. Blocked consumer (Reset, add consumer on empty buffer, step it)
  await evaluate(`
    const resetBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Reset'));
    resetBtn?.click();
  `);
  await wait(500);
  await evaluate(`
    const addConsumerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Consumer'));
    addConsumerBtn?.click();
  `);
  await wait(300);
  await evaluate(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step instruction'));
    stepBtn?.click();
  `);
  await wait(500);
  await scrollToSelector('.sl-analysis-section');
  await screenshot('audit-final-04-blocked-consumer-1440x900', 1440, 900);

  // 5. Mutex contention (Add 2 producers P1 and P2, step P1 into critical section, step P2 to wait(mutex))
  await evaluate(`
    const addProducerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Producer'));
    addProducerBtn?.click(); // P1
    addProducerBtn?.click(); // P2
  `);
  await wait(300);
  await evaluate(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step instruction'));
    // Step P1: waitEmpty, waitMutex (acquires mutex)
    stepBtn?.click();
    stepBtn?.click();
  `);
  await wait(400);
  await evaluate(`
    // Now step P2: waitEmpty, waitMutex (P2 blocks on mutex held by P1!)
    const stepProcessBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step Process') || b.textContent.includes('Step instruction'));
    // We can click step instruction twice
    stepProcessBtn?.click();
    stepProcessBtn?.click();
  `);
  await wait(500);
  await scrollToSelector('.sl-analysis-section');
  await screenshot('audit-final-05-mutex-contention-1440x900', 1440, 900);

  // 6. Draining & Independent Kitchen Preparation
  await evaluate(`
    // Run several instructions so P1 finishes insert and releases mutex, consumer claims order and begins PREPARING
    const runBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Run') && !b.textContent.includes('Clear'));
    if (runBtn) runBtn.click();
  `);
  await wait(1800);
  await evaluate(`
    const pauseBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Pause'));
    if (pauseBtn) pauseBtn.click();
  `);
  await wait(500);
  await scrollToSelector('.sl-analysis-section');
  await screenshot('audit-final-06-draining-cooking-1440x900', 1440, 900);

  // 7. Historical Inspection (Navigate backward in history, show selected sample)
  await evaluate(`
    const analysisSection = document.querySelector('.sl-analysis-section');
    analysisSection?.focus();
    const prevBtn = analysisSection?.querySelector('button[title*="Previous"]');
    for (let i = 0; i < 8; i++) {
      prevBtn?.click();
    }
  `);
  await wait(500);
  // Expand details
  await evaluate(`
    const details = document.querySelector('.sl-analysis-details');
    if (details) details.open = true;
  `);
  await wait(300);
  await scrollToSelector('.sl-step-explanation-card');
  await screenshot('audit-final-07-historical-inspection-1440x900', 1440, 900);

  // 8. Desktop 1280x720
  await scrollToSelector('.sl-analysis-section');
  await screenshot('audit-final-08-desktop-1280x720', 1280, 720);

  // 9. Tablet 1024x768
  await screenshot('audit-final-09-tablet-1024x768', 1024, 768);

  // 10. Mobile 390x844
  await screenshot('audit-final-10-mobile-390x844', 390, 844, true);

  console.log('All 10 final verification screenshots captured successfully!');
  edge.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

