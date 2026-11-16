import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-evidence-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9958',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9958/json/version');
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

  const targets = await (await fetch('http://127.0.0.1:9958/json/list')).json();
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
  await call('DOM.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  const evalCode = async (expr) => {
    const res = await call('Runtime.evaluate', { expression: `(() => { ${expr} })()`, returnByValue: true });
    if (res.exceptionDetails) {
      console.error('Eval error on:', expr, res.exceptionDetails);
    }
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
    await wait(2500);

    // Switch to SyncLab tab
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SyncLab') || b.textContent.includes('Operating Systems Lab'));
      if (btn) btn.click();
    `);
    await wait(1200);

    // Shot 1: Initial Arena State
    await capture('workflow-01-initial-state-1440.png');

    // Add 1 student and 1 kitchen using header action buttons
    await evalCode(`
      const addButtons = Array.from(document.querySelectorAll('.header-action-btn.primary-add'));
      if (addButtons[0]) addButtons[0].click(); // Student
    `);
    await wait(300);
    await evalCode(`
      const addButtons = Array.from(document.querySelectorAll('.header-action-btn.primary-add'));
      if (addButtons[1]) addButtons[1].click(); // Kitchen
    `);
    await wait(600);

    // Shot 2: Newly added processes visible in orbit
    await capture('workflow-02-processes-added-1440.png');

    // Click Play to run simulation
    await evalCode(`
      const playBtn = document.querySelector('.dock-btn-primary');
      if (playBtn) playBtn.click();
    `);

    // Let it run for 10 seconds to generate shared buffer activity
    for (let t = 1; t <= 10; t++) {
      await wait(1000);
      const occ = await evalCode(`return window.__synclab_engine__?.buffer?.occupancy;`);
      console.log(`[Playback t=${t}s] buffer occupancy: ${occ}`);
    }

    // Shot 3: Active shared-buffer activity
    await capture('workflow-03-active-buffer-activity-1440.png');

    // Open Experiment Controls Popover
    await evalCode(`
      const settingsBtn = document.querySelector('button[aria-label="Experiment Settings"]');
      if (settingsBtn) settingsBtn.click();
    `);
    await wait(600);

    // Shot 4: Experiment controls popover
    await capture('workflow-04-experiment-popover-1440.png');

    // Close settings popover and open Process Manager Dialog
    await evalCode(`
      const closeSettings = document.querySelector('.popover-close-btn');
      if (closeSettings) closeSettings.click();
      const procBtn = Array.from(document.querySelectorAll('.header-action-btn')).find(b => b.textContent.includes('Processes'));
      if (procBtn) procBtn.click();
    `);
    await wait(600);

    // Shot 5: Process manager modal dialog
    await capture('workflow-05-process-manager-modal-1440.png');

    // Close dialog and Clear session
    await evalCode(`
      const closeDialog = document.querySelector('.arena-footer-close-btn');
      if (closeDialog) closeDialog.click();
    `);
    await wait(300);

    // Click Clear session button (accept window.confirm)
    await evalCode(`
      window.confirm = () => true;
      const clearBtn = document.querySelector('.header-action-btn.danger-hover');
      if (clearBtn) clearBtn.click();
    `);
    await wait(800);

    // Shot 6: Empty canvas / Start empty state
    await capture('workflow-06-cleared-canvas-1440.png');

    console.log('--- ALL WORKFLOW SCREENSHOTS CAPTURED SUCCESSFULLY ---');

  } finally {
    page.close();
    socket.close();
    edge.kill();
  }
}

run().catch((err) => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
