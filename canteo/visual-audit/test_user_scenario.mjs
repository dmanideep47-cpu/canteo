import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function testUserScenario() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-user-modal-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9996',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9996/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  const targets = await (await fetch('http://127.0.0.1:9996/json/list')).json();
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

  console.log('--- Setting up: 5 producers, 2 consumers (Total 7) ---');
  // Initial state has 2 producers and 2 consumers. Add 3 producers:
  await evalCode(`
    const plusBtn = document.querySelectorAll('.stepper-btn-plus')[0];
    plusBtn.click();
    plusBtn.click();
    plusBtn.click();
  `);
  await wait(400);

  // Now test Scenario A: Click "+1 more producers" overflow card
  console.log('Scenario A: Open via "+1 more producers" card');
  await evalCode(`
    const card = document.querySelector('.arena-process-overflow-card');
    card.click();
  `);
  await wait(400);
  await capture('user-scenario-a-open');

  // Verify modal is open
  const modalAOpen = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal A open:', modalAOpen);

  // Get cross button box and click it with dispatchMouseEvent
  const closeBtnBoxA = await evalCode(`
    const btn = document.querySelector('.arena-dialog-close-btn');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  `);
  console.log('Close button A box:', closeBtnBoxA);

  if (closeBtnBoxA) {
    const cx = closeBtnBoxA.x + closeBtnBoxA.w / 2;
    const cy = closeBtnBoxA.y + closeBtnBoxA.h / 2;
    console.log(`Clicking cross button A at (${cx}, ${cy})...`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
    await wait(400);
  }

  const modalAAfter = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal A open after click:', modalAAfter);

  // Now test Scenario B: Open via "View all (5)" link button in sector tag
  console.log('\nScenario B: Open via "View all (5)" button');
  await evalCode(`
    const btn = document.querySelector('.arena-overflow-view-all-btn');
    btn.click();
  `);
  await wait(400);
  await capture('user-scenario-b-open');

  const modalBOpen = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal B open:', modalBOpen);

  const closeBtnBoxB = await evalCode(`
    const btn = document.querySelector('.arena-dialog-close-btn');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  `);
  if (closeBtnBoxB) {
    const cx = closeBtnBoxB.x + closeBtnBoxB.w / 2;
    const cy = closeBtnBoxB.y + closeBtnBoxB.h / 2;
    console.log(`Clicking cross button B at (${cx}, ${cy})...`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
    await wait(400);
  }
  const modalBAfter = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal B open after click:', modalBAfter);

  // Now test Scenario C: Open via "Manage processes (7)" button
  console.log('\nScenario C: Open via "Manage processes (7)" button');
  await evalCode(`
    const btn = document.querySelector('.stepper-manage-btn');
    btn.click();
  `);
  await wait(400);
  await capture('user-scenario-c-open');

  const modalCOpen = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal C open:', modalCOpen);

  const closeBtnBoxC = await evalCode(`
    const btn = document.querySelector('.arena-dialog-close-btn');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  `);
  if (closeBtnBoxC) {
    const cx = closeBtnBoxC.x + closeBtnBoxC.w / 2;
    const cy = closeBtnBoxC.y + closeBtnBoxC.h / 2;
    console.log(`Clicking cross button C at (${cx}, ${cy})...`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
    await wait(400);
  }
  const modalCAfter = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal C open after click:', modalCAfter);

  edge.kill();
  process.exit(0);
}

testUserScenario().catch((err) => {
  console.error(err);
  process.exit(1);
});

