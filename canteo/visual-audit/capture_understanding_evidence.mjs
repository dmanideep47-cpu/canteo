import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-understanding-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9972',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9972/json/version');
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

  const targets = await (await fetch('http://127.0.0.1:9972/json/list')).json();
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
    console.log(`Captured screenshot: ${filename} (${buffer.length} bytes)`);
  };

  try {
    await wait(2000);

    // Switch to SyncLab tab
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SyncLab') || b.textContent.includes('Operating Systems Lab'));
      if (btn) btn.click();
    `);
    await wait(1000);

    // Shot 1: Initial State with Status Bar, Session Summary, and Instruction Separation
    await capture('understanding-01-status-and-summary.png');

    // Step P1 through all 6 instructions to produce an order
    await evalCode(`
      const selectProc = (id) => {
        const sel = document.querySelector('.dock-select');
        if (sel) {
          sel.value = id;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      selectProc('P1');
    `);
    await wait(200);

    for (let i = 0; i < 6; i++) {
      await evalCode(`
        const stepBtn = document.querySelector('.dock-btn-secondary');
        if (stepBtn) stepBtn.click();
      `);
      await wait(150);
    }
    await wait(400);

    // Shot 2: After producing order - shows updated Produced count (1), Last event details, and Next instruction
    await capture('understanding-02-running-and-produced.png');

    // Open Recent Activity popover
    await evalCode(`
      const actBtn = document.querySelector('.dock-btn-activity');
      if (actBtn) actBtn.click();
    `);
    await wait(500);

    // Shot 3: Expandable Recent Activity Popover
    await capture('understanding-03-recent-activity-popover.png');

    // Close Activity and open Experiment Settings
    await evalCode(`
      const actBtn = document.querySelector('.dock-btn-activity');
      if (actBtn) actBtn.click();
    `);
    await wait(300);

    await evalCode(`
      const settingsBtn = document.querySelector('.dock-btn-icon[aria-label="Experiment Settings"]');
      if (settingsBtn) settingsBtn.click();
    `);
    await wait(500);

    // Shot 4: Experiment Settings Popover
    await capture('understanding-04-experiment-settings-popover.png');

    console.log('All understanding and control enhancement screenshots captured successfully!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    try { page.close(); } catch {}
    try { socket.close(); } catch {}
    try { edge.kill(); } catch {}
  }
}

run();

