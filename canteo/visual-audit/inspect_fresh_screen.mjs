import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-inspect-fresh-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9975',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9975/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
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

  await send('Target.createTarget', { url: 'http://localhost:5173/app?tab=synclab' });
  await wait(2000);

  const targets = await (await fetch('http://127.0.0.1:9975/json/list')).json();
  const target = targets.find((item) => item.type === 'page' && (item.url.includes('/app?tab=synclab') || item.url.includes('localhost:5173')));
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
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
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
    console.log(`Captured: ${filename}`);
  };

  try {
    await wait(2000);
    // Switch to synclab
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SyncLab') || b.textContent.includes('Operating Systems Lab'));
      if (btn) btn.click();
    `);
    await wait(1000);

    // Shot 1: Initial state
    await capture('audit-01-initial.png');

    // Produce 2 orders to get populated buffer
    await evalCode(`
      const sel = document.querySelector('.dock-select');
      if (sel) { sel.value = 'P1'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    `);
    await wait(200);
    for (let i = 0; i < 6; i++) {
      await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
      await wait(150);
    }
    await evalCode(`
      const sel = document.querySelector('.dock-select');
      if (sel) { sel.value = 'P2'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    `);
    await wait(200);
    for (let i = 0; i < 6; i++) {
      await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
      await wait(150);
    }
    await wait(300);

    // Shot 2: Populated buffer state
    await capture('audit-02-populated.png');

    // Open Inspector by clicking Hub/Semaphores
    await evalCode(`
      const inspBtn = document.querySelector('.inspect-semaphores-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Inspect'));
      if (inspBtn) inspBtn.click();
    `);
    await wait(500);

    // Shot 3: Inspector state
    await capture('audit-03-inspector.png');

    // Close Inspector
    await evalCode(`document.querySelector('.inspector-close-btn')?.click();`);
    await wait(300);

    // Add more producers to fill the buffer (P3, P4, P5)
    await evalCode(`
      const pGroup = document.querySelector('.process-stepper-group[aria-label="Producer Controls"]');
      const plusBtn = pGroup?.querySelector('.stepper-btn-plus');
      if (plusBtn) { plusBtn.click(); plusBtn.click(); plusBtn.click(); }
    `);
    await wait(400);

    // Fill buffer slots [2], [3], [4]
    for (const p of ['P3', 'P4', 'P5']) {
      await evalCode(`
        const sel = document.querySelector('.dock-select');
        if (sel) { sel.value = '${p}'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      `);
      await wait(100);
      for (let i = 0; i < 6; i++) {
        await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
        await wait(100);
      }
    }
    await wait(300);

    // Add P6 and step it so it BLOCKS on sem_wait(&empty)
    await evalCode(`
      const pGroup = document.querySelector('.process-stepper-group[aria-label="Producer Controls"]');
      pGroup?.querySelector('.stepper-btn-plus')?.click();
    `);
    await wait(200);
    await evalCode(`
      const sel = document.querySelector('.dock-select');
      if (sel) { sel.value = 'P6'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    `);
    await wait(100);
    await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
    await wait(300);

    // Shot 4: Full buffer and blocked state
    await capture('audit-04-full-and-blocked.png');

    // Open Process Manager (Overflow state)
    await evalCode(`document.querySelector('.stepper-manage-btn')?.click();`);
    await wait(500);

    // Shot 5: Overflow Process Manager dialog
    await capture('audit-05-overflow-manager.png');

    // Close manager
    await evalCode(`document.querySelector('.arena-dialog-close-btn')?.click();`);
    await wait(300);

  } catch (err) {
    console.error(err);
  } finally {
    try { page.close(); } catch {}
    try { socket.close(); } catch {}
    try { edge.kill(); } catch {}
  }
}

run();
