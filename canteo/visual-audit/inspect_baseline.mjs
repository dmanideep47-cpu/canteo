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

  edge.on('error', (err) => console.error('Edge spawn error:', err));

  // Wait for debugger port
  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9333/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    edge.kill();
    throw new Error('Failed to connect to Edge debugging port 9333');
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
  if (!target) throw new Error('App target not found');

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

  const screenshot = async (name, width = 1440, height = 900, mobile = false) => {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
    await wait(400);
    const shot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(new URL(`./${name}.png`, import.meta.url), Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${name}.png (${width}x${height})`);
  };

  await wait(1500);

  // Scroll to execution analysis
  await evaluate(`
    const el = document.querySelector('.sl-analysis-section');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  `);
  await wait(500);

  // State 1: Initial state
  console.log('--- State 1: Initial State ---');
  await screenshot('audit-01-initial-1440x900', 1440, 900);

  // State 2: Fill queue (5 producers producing)
  console.log('--- State 2: Full Queue ---');
  await evaluate(`
    // Add 5 producers and run until full
    const addProducerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Producer'));
    for (let i = 0; i < 5; i++) {
      addProducerBtn?.click();
    }
  `);
  await wait(300);

  // Step instructions until all 5 orders are queued
  await evaluate(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') || b.title?.includes('Step'));
    // Or run instructions directly if there's a button
    // Let's click "Run instructions" or step multiple times
    const runBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Run') && !b.textContent.includes('Clear'));
    if (runBtn) {
      runBtn.click();
    }
  `);
  await wait(1500);
  // Pause if running
  await evaluate(`
    const pauseBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Pause'));
    if (pauseBtn) pauseBtn.click();
  `);
  await wait(500);

  await screenshot('audit-02-full-queue-1440x900', 1440, 900);

  // State 3: Blocked producer (Add 6th producer)
  console.log('--- State 3: Blocked Producer ---');
  await evaluate(`
    const addProducerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Producer'));
    addProducerBtn?.click();
  `);
  await wait(300);
  await evaluate(`
    const stepNextBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step instruction') || b.textContent.includes('Step'));
    stepNextBtn?.click();
  `);
  await wait(500);
  await screenshot('audit-03-blocked-producer-1440x900', 1440, 900);

  // State 4: Blocked consumer, draining queue, preparation
  console.log('--- State 4: Adding consumers to drain and cook ---');
  await evaluate(`
    const addConsumerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Consumer'));
    addConsumerBtn?.click();
    addConsumerBtn?.click();
  `);
  await wait(300);
  await evaluate(`
    const runBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Run') && !b.textContent.includes('Clear'));
    if (runBtn) runBtn.click();
  `);
  await wait(2000);
  await evaluate(`
    const pauseBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Pause'));
    if (pauseBtn) pauseBtn.click();
  `);
  await wait(500);

  await screenshot('audit-04-draining-and-cooking-1440x900', 1440, 900);

  // Inspect history selection
  console.log('--- State 5: Historical Inspection ---');
  await evaluate(`
    // Click on an earlier point or use Left Arrow
    const analysisSection = document.querySelector('.sl-analysis-section');
    analysisSection?.focus();
    const prevBtn = analysisSection?.querySelector('button[title*="Previous"]');
    for (let i = 0; i < 10; i++) {
      prevBtn?.click();
    }
  `);
  await wait(500);
  await screenshot('audit-05-historical-inspection-1440x900', 1440, 900);

  // Responsive captures
  console.log('--- Responsive Views ---');
  await screenshot('audit-06-desktop-1280x720', 1280, 720);
  await screenshot('audit-07-tablet-1024x768', 1024, 768);
  await screenshot('audit-08-mobile-390x844', 390, 844, true);

  console.log('All audit captures completed!');

  edge.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
