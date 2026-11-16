import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function testBothOpen() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-both-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9991',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9991/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  const targets = await (await fetch('http://127.0.0.1:9991/json/list')).json();
  const pageTarget = targets.find((t) => t.type === 'page');

  const page = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => { page.onopen = resolve; });

  let nextId = 0;
  const pending = new Map();
  page.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    const req = pending.get(msg.id);
    if (!req) return;
    pending.delete(msg.id);
    if (msg.error) req.reject(new Error(msg.error.message));
    else req.resolve(msg.result);
  };

  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    page.send(JSON.stringify({ id, method, params }));
  });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await call('Page.navigate', { url: 'http://localhost:5180/app?tab=synclab' });
  await wait(1500);

  const evalCode = async (expr) => {
    const res = await call('Runtime.evaluate', { expression: `(() => { ${expr} })()`, returnByValue: true });
    return res.result?.value;
  };

  const capture = async (name) => {
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    writeFileSync(`C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots/${name}.png`, buffer);
    console.log('Saved screenshot:', name);
  };

  // 1. Open Inspector
  await evalCode(`document.querySelector('.inspect-semaphores-btn')?.click();`);
  await wait(300);

  // 2. Open Modal via Header (Processes button)
  await evalCode(`
    const btn = Array.from(document.querySelectorAll('.header-action-btn')).find(b => b.textContent.includes('Processes'));
    if (btn) btn.click();
  `);
  await wait(400);

  await capture('both-open-screenshot');

  const modalOpen = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  const inspectorOpen = await evalCode(`return Boolean(document.querySelector('.arena-inspector-overlay'));`);
  console.log('Modal is open:', modalOpen, 'Inspector is open:', inspectorOpen);

  // 3. Click the modal's cross button
  const modalCloseRes = await evalCode(`
    const btn = document.querySelector('.arena-dialog-close-btn');
    if (!btn) return 'no close btn';
    btn.click();
    return 'clicked';
  `);
  console.log('Modal close button click result:', modalCloseRes);
  await wait(400);

  await capture('both-open-after-modal-close');

  const modalOpenAfter = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal is open after click:', modalOpenAfter);

  edge.kill();
  process.exit(0);
}

testBothOpen().catch((err) => {
  console.error(err);
  process.exit(1);
});

