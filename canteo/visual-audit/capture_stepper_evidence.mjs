import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-stepper-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9961',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9961/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    console.error('Failed to connect to Edge via CDP on port 9961');
    process.exit(1);
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

  const targets = await (await fetch('http://127.0.0.1:9961/json/list')).json();
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
    await wait(2000);

    // Switch to SyncLab tab
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SyncLab') || b.textContent.includes('Operating Systems Lab'));
      if (btn) btn.click();
    `);
    await wait(1000);

    // 1. Initial state has 2 producers and 2 consumers. Let's add 1 consumer using the stepper [+]
    // So we get: Producers [−] 2 [+]     Consumers [−] 3 [+]
    await evalCode(`
      const consumerGroup = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"]');
      if (consumerGroup) {
        const plusBtn = consumerGroup.querySelector('.stepper-btn-plus');
        if (plusBtn) plusBtn.click();
      }
    `);
    await wait(600);

    // Shot 1: Stepper controls bar placed above simulation with Producers 2 and Consumers 3
    await capture('stepper-01-controls-bar-1440.png');

    // 2. Immediate Removal: Let's remove 1 unstarted consumer using stepper [−]
    // The policy will immediately remove C3 (since C3 is unstarted/ready and holds no resources)
    await evalCode(`
      const consumerGroup = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"]');
      if (consumerGroup) {
        const minusBtn = consumerGroup.querySelector('.stepper-btn-minus');
        if (minusBtn) minusBtn.click();
      }
    `);
    await wait(600);

    // Shot 2: Immediate removal completed, count decremented to Consumers 2
    await capture('stepper-02-immediate-removal-1440.png');

    // 3. Pending Removal: Let's run a producer to put an order into the buffer, then step a consumer into PREPARING
    // First, let's step P1 through all 6 instructions so an order is in the buffer
    await evalCode(`
      // Select P1 and step 6 times
      const stepBtn = document.querySelector('.dock-btn-secondary');
      const selectProc = (id) => {
        const sel = document.querySelector('.dock-select');
        if (sel) {
          sel.value = id;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      selectProc('P1');
    `);
    await wait(300);

    for (let i = 0; i < 6; i++) {
      await evalCode(`
        const stepBtn = document.querySelector('.dock-btn-secondary');
        if (stepBtn) stepBtn.click();
      `);
      await wait(150);
    }

    // Now select C1 and step through instructions until it dequeues and enters PREPARING
    await evalCode(`
      const sel = document.querySelector('.dock-select');
      if (sel) {
        sel.value = 'C1';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);
    await wait(200);

    for (let i = 0; i < 6; i++) {
      await evalCode(`
        const stepBtn = document.querySelector('.dock-btn-secondary');
        if (stepBtn) stepBtn.click();
      `);
      await wait(150);
    }
    await wait(500);

    // Add 1 consumer so we have 3 consumers (C1 preparing, C2 waiting, C3 ready)
    await evalCode(`
      const consumerGroup = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"]');
      if (consumerGroup) {
        const plusBtn = consumerGroup.querySelector('.stepper-btn-plus');
        if (plusBtn) plusBtn.click();
      }
    `);
    await wait(300);

    // Remove C3 immediately with minus
    await evalCode(`
      const consumerGroup = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"]');
      if (consumerGroup) {
        const minusBtn = consumerGroup.querySelector('.stepper-btn-minus');
        if (minusBtn) minusBtn.click();
      }
    `);
    await wait(300);

    // Step C2 so it blocks on full (buffer empty)
    await evalCode(`
      const sel = document.querySelector('.dock-select');
      if (sel) {
        sel.value = 'C2';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const stepBtn = document.querySelector('.dock-btn-secondary');
      if (stepBtn) stepBtn.click();
    `);
    await wait(300);

    // Now remove C2 immediately
    await evalCode(`
      const consumerGroup = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"]');
      if (consumerGroup) {
        const minusBtn = consumerGroup.querySelector('.stepper-btn-minus');
        if (minusBtn) minusBtn.click();
      }
    `);
    await wait(300);

    // Add 2 consumers so count is 3 (C1 preparing, C4 ready, C5 ready)
    await evalCode(`
      const consumerGroup = document.querySelector('.process-stepper-group[aria-label="Consumer Controls"]');
      if (consumerGroup) {
        const plusBtn = consumerGroup.querySelector('.stepper-btn-plus');
        if (plusBtn) {
          plusBtn.click();
          plusBtn.click();
        }
      }
    `);
    await wait(400);

    // Now request removal of C1 directly from orbit or trigger graceful stop
    await evalCode(`
      // Click the remove button on C1's node in the orbit
      const c1Node = Array.from(document.querySelectorAll('.arena-process-node')).find(n => n.textContent.includes('C1'));
      if (c1Node) {
        const removeBtn = c1Node.querySelector('.proc-node-remove-btn');
        if (removeBtn) removeBtn.click();
      }
    `);
    await wait(500);

    // Shot 3: Pending removal state explicitly showing "Consumers 3 · 1 stopping"
    await capture('stepper-03-pending-removal-1440.png');

    // 4. Open the Manage Processes modal using the "Manage processes" trigger button on the stepper bar
    await evalCode(`
      const manageBtn = document.querySelector('.stepper-manage-btn');
      if (manageBtn) manageBtn.click();
    `);
    await wait(600);

    // Shot 4: Manage Processes panel open showing ID, role, state, explicit waiting reason, current order, inspect action, and remove/graceful-stop action
    await capture('stepper-04-manage-processes-dialog-1440.png');

    console.log('All 4 stepper and lifecycle screenshots successfully captured!');
  } catch (err) {
    console.error('Error in capture script:', err);
  } finally {
    try { page.close(); } catch {}
    try { socket.close(); } catch {}
    try { edge.kill(); } catch {}
  }
}

run();

