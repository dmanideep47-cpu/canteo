import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function testModal() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-modal-test-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9995',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9995/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  const targets = await (await fetch('http://127.0.0.1:9995/json/list')).json();
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
  await call('DOM.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await call('Page.navigate', { url: 'http://localhost:5180/app?tab=synclab' });

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

  for (let i = 0; i < 40; i++) {
    const ready = await evalCode(`return Boolean(document.querySelector('.stepper-manage-btn'));`);
    if (ready) break;
    await wait(250);
  }

  console.log('SyncLab loaded.');

  // Open modal
  await evalCode(`document.querySelector('.stepper-manage-btn')?.click();`);
  await wait(500);
  await capture('modal-test-1-opened');

  const modalOpen1 = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal is open:', modalOpen1);

  // Check close button bounding box
  const closeBtnBox = await evalCode(`
    const btn = document.querySelector('.arena-dialog-close-btn');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  `);
  console.log('Close button box:', closeBtnBox);

  // Dispatch real mouse click via Input.dispatchMouseEvent at the center of the close button!
  if (closeBtnBox) {
    const clickX = closeBtnBox.x + closeBtnBox.w / 2;
    const clickY = closeBtnBox.y + closeBtnBox.h / 2;
    console.log(`Sending mouse press & release at (${clickX}, ${clickY})...`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: clickX, y: clickY, button: 'left', clickCount: 1 });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clickX, y: clickY, button: 'left', clickCount: 1 });
    await wait(500);
  }

  await capture('modal-test-2-after-click');
  const modalOpen2 = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal is open after real mouse click:', modalOpen2);

  edge.kill();
  process.exit(0);
}

testModal().catch((err) => {
  console.error(err);
  process.exit(1);
});

