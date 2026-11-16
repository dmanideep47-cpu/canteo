import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9990',
    '--disable-gpu',
    'about:blank'
  ], { detached: false });

  await wait(1500);

  let pageTarget = null;
  for (let i = 0; i < 20; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9990/json/list')).json();
      pageTarget = list.find((t) => t.type === 'page');
      if (pageTarget) break;
    } catch {}
    await wait(300);
  }

  const page = new WebSocket(pageTarget.webSocketDebuggerUrl);
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
    // Navigate to Canteo SyncLab on port 5180
    await call('Page.navigate', { url: 'http://localhost:5180/app?tab=synclab' });
    await wait(3000);

    // Switch to synclab tab if not active
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SyncLab') || b.textContent.includes('Operating Systems Lab'));
      if (btn) btn.click();
    `);
    await wait(1200);

    // Verify page loaded
    const title = await evalCode(`document.querySelector('.arena-page-title')?.textContent || document.title`);
    console.log('Page loaded with title/heading:', title);

    // 1. Initial State (Clean circular buffer, 2P 2C, coinciding pointers IN · OUT [0])
    await capture('refinement-01-initial.png');

    // Switch to Manual Dispatch (MAN) for deterministic process stepping
    await evalCode(`
      const manBtn = Array.from(document.querySelectorAll('.segment-btn')).find(b => b.textContent.includes('MAN'));
      if (manBtn) manBtn.click();
    `);
    await wait(200);

    const selectProcess = async (id) => {
      await evalCode(`
        const card = Array.from(document.querySelectorAll('.arena-process-node')).find(c => c.textContent.includes('${id}'));
        if (card) card.click();
      `);
      await wait(150);
    };

    const stepProcess = async (steps = 1) => {
      for (let i = 0; i < steps; i++) {
        await evalCode(`document.querySelector('.dock-btn-secondary')?.click();`);
        await wait(120);
      }
    };

    // 2. Populated State (Produce 2 orders with P1 and P2)
    await selectProcess('P1');
    await stepProcess(6);
    await selectProcess('P2');
    await stepProcess(6);
    await wait(300);
    await capture('refinement-02-populated.png');

    // 3. Open Inspector (State 7)
    await evalCode(`
      const insp = document.querySelector('.inspect-semaphores-btn') || document.querySelector('.arena-state-bar');
      if (insp) insp.click();
    `);
    await wait(600);
    await capture('refinement-07-inspector.png');

    // Close Inspector
    await evalCode(`document.querySelector('.inspector-close-btn')?.click();`);
    await wait(400);

    // 4. Full State (Add P3, P4, P5 and fill buffer to 5/5)
    await evalCode(`
      const pGroup = document.querySelector('.process-stepper-group[aria-label="Producer Controls"]');
      const plusBtn = pGroup?.querySelector('.stepper-btn-plus');
      if (plusBtn) { plusBtn.click(); plusBtn.click(); plusBtn.click(); }
    `);
    await wait(400);

    await selectProcess('P3');
    await stepProcess(6);
    await selectProcess('P4');
    await stepProcess(6);
    await selectProcess('P5');
    await stepProcess(6);
    await wait(300);
    await capture('refinement-03-full.png');

    // 5. Blocked State (Add P6 and step it so it blocks on capacity)
    await evalCode(`
      const pGroup = document.querySelector('.process-stepper-group[aria-label="Producer Controls"]');
      pGroup?.querySelector('.stepper-btn-plus')?.click();
    `);
    await wait(300);

    await selectProcess('P6');
    await stepProcess(1);
    await wait(300);
    await capture('refinement-04-blocked.png');

    // 6. Overflow Manager Modal
    await evalCode(`document.querySelector('.stepper-manage-btn')?.click();`);
    await wait(600);
    await capture('refinement-05-overflow-manager.png');

    // Close Modal via working Close Button
    await evalCode(`document.querySelector('.arena-dialog-close-btn')?.click();`);
    await wait(400);

    // 7. Stopping State (Request removal of P6 while waiting for resource)
    await evalCode(`
      const p6Card = Array.from(document.querySelectorAll('.arena-process-node')).find(c => c.textContent.includes('P6'));
      const removeBtn = p6Card?.querySelector('.proc-node-remove-btn');
      if (removeBtn) removeBtn.click();
    `);
    await wait(500);
    await capture('refinement-06-stopping.png');

  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    try { page.close(); } catch {}
    try { edge.kill(); } catch {}
  }
}

run();
