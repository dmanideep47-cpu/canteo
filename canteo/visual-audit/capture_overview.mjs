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
    '--remote-debugging-port=9555',
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
      const res = await fetch('http://127.0.0.1:9555/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    edge.kill();
    throw new Error('Failed to connect to Edge debugging port 9555');
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

  const targets = await (await fetch('http://127.0.0.1:9555/json/list')).json();
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

  await wait(1500);

  // Switch to Section 02 Simulator initially
  await evaluate(`
    const btn = Array.from(document.querySelectorAll('.sl-section-nav button')).find(b => b.textContent.includes('02') || b.textContent.includes('Simulator'));
    if (btn) btn.click();
    window.scrollTo({ top: 0, behavior: 'instant' });
  `);
  await wait(600);

  // 1. Simulator Top View (1440x900)
  await screenshot('refined-01-simulator-top-1440x900', 1440, 900);

  // 2. Simulator Scrolled to Buffer and Process list
  await evaluate(`
    const el = document.querySelector('.sl-buffer-stage');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  `);
  await wait(400);
  await screenshot('refined-02-simulator-buffer-1440x900', 1440, 900);

  // 3. Simulator Scrolled to Resources and Analysis
  await evaluate(`
    const el = document.querySelector('.sl-resource-integrity-grid');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  `);
  await wait(400);
  await screenshot('refined-03-simulator-resources-1440x900', 1440, 900);

  // 4. Section 01 System Model
  await evaluate(`
    window.scrollTo({ top: 0, behavior: 'instant' });
    const btn = Array.from(document.querySelectorAll('.sl-section-nav button')).find(b => b.textContent.includes('01') || b.textContent.includes('System Model'));
    if (btn) btn.click();
  `);
  await wait(600);
  await screenshot('refined-04-section01-model-1440x900', 1440, 900);

  // 5. Section 03 Race Condition Laboratory
  await evaluate(`
    window.scrollTo({ top: 0, behavior: 'instant' });
    const btn = Array.from(document.querySelectorAll('.sl-section-nav button')).find(b => b.textContent.includes('03') || b.textContent.includes('Race'));
    if (btn) btn.click();
  `);
  await wait(600);
  await screenshot('refined-05-section03-race-1440x900', 1440, 900);

  // 6. Section 04 Synchronization Solution
  await evaluate(`
    window.scrollTo({ top: 0, behavior: 'instant' });
    const btn = Array.from(document.querySelectorAll('.sl-section-nav button')).find(b => b.textContent.includes('04') || b.textContent.includes('Solution'));
    if (btn) btn.click();
  `);
  await wait(600);
  await screenshot('refined-06-section04-solution-1440x900', 1440, 900);

  // 7. Section 05 Flowcharts
  await evaluate(`
    window.scrollTo({ top: 0, behavior: 'instant' });
    const btn = Array.from(document.querySelectorAll('.sl-section-nav button')).find(b => b.textContent.includes('05') || b.textContent.includes('Flowcharts'));
    if (btn) btn.click();
  `);
  await wait(600);
  await screenshot('refined-07-section05-flowcharts-1440x900', 1440, 900);

  // Back to Section 02 Simulator for Responsive Checks
  await evaluate(`
    window.scrollTo({ top: 0, behavior: 'instant' });
    const btn = Array.from(document.querySelectorAll('.sl-section-nav button')).find(b => b.textContent.includes('02') || b.textContent.includes('Simulator'));
    if (btn) btn.click();
  `);
  await wait(600);

  // Tablet 1024x768
  await screenshot('refined-08-simulator-tablet-1024x768', 1024, 768);

  // Mobile 390x844
  await screenshot('refined-09-simulator-mobile-390x844', 390, 844, true);

  console.log('All refined screenshots captured successfully.');
  edge.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error running capture:', err);
  process.exit(1);
});
