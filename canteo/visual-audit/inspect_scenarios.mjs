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
        if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      })()
    `);
    await wait(300);
  };

  const screenshot = async (filename, width = 1440, height = 900, mobile = false) => {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
    await wait(350);
    const shot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(new URL(`./${filename}.png`, import.meta.url), Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${filename}.png`);
  };

  await wait(1200);

  // 1. Initial State: scroll to analysis section
  await scrollToSelector('.sl-analysis-section');
  await screenshot('audit-initial-overview');

  // Scroll to details on initial state and expand
  await evaluate(`
    const details = document.querySelector('.sl-analysis-details');
    if (details) details.open = true;
  `);
  await scrollToSelector('.sl-step-explanation-card');
  await screenshot('audit-initial-details');

  // 2. Load Scenario: Saturated Buffer (Queue full)
  await evaluate(`
    const select = document.querySelector('.sl-scenario-row select');
    if (select) {
      const opt = Array.from(select.options).find(o => o.text.includes('Saturated') || o.value.includes('full') || o.text.includes('Full'));
      if (opt) {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        const loadBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Load scenario'));
        loadBtn?.click();
      }
    }
  `);
  await wait(500);

  // Add 6th producer:
  await evaluate(`
    const addProducerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Producer'));
    addProducerBtn?.click();
  `);
  await wait(300);
  // Step it once so P6 calls wait(empty) and blocks!
  await evaluate(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step instruction'));
    stepBtn?.click();
  `);
  await wait(500);

  await scrollToSelector('.sl-analysis-section');
  await screenshot('audit-blocked-producer-overview');
  await scrollToSelector('.sl-step-explanation-card');
  await screenshot('audit-blocked-producer-explanation');

  // 3. Now add Consumer C1, step to dequeue and begin PREPARING
  await evaluate(`
    const addConsumerBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Consumer'));
    addConsumerBtn?.click();
  `);
  await wait(300);
  // Step C1 through wait(full), wait(mutex), remove, advanceRead, releaseMutex (wakes P6!), signalEmpty
  await evaluate(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step instruction'));
    for (let i = 0; i < 7; i++) {
      stepBtn?.click();
    }
  `);
  await wait(600);

  await scrollToSelector('.sl-analysis-section');
  await screenshot('audit-consumer-removed-overview');
  await scrollToSelector('.sl-step-explanation-card');
  await screenshot('audit-consumer-removed-explanation');

  edge.kill();
  console.log('Finished refined audit captures.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
