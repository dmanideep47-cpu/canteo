import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function testAllCrossButtons() {
  console.log('=== VERIFYING ALL CROSS (X) BUTTONS IN SYNCLAB ===');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-cross-verify-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9992',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9992/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    console.error('Edge failed to launch on 9992');
    process.exit(1);
  }

  const targets = await (await fetch('http://127.0.0.1:9992/json/list')).json();
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

  for (let i = 0; i < 40; i++) {
    const ready = await evalCode(`return Boolean(document.querySelector('.stepper-manage-btn'));`);
    if (ready) break;
    await wait(250);
  }

  const report = {};

  // -------------------------------------------------------------
  // TEST 1: Process Management Modal Dialog Cross Button
  // -------------------------------------------------------------
  console.log('\n--- 1. Testing Process Management Modal Cross Button ---');
  await evalCode(`document.querySelector('.stepper-manage-btn')?.click();`);
  await wait(400);

  const modalBefore = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal opened:', modalBefore);
  await capture('cross-test-01-modal-open');

  // Click the cross button in modal header
  const modalCloseClicked = await evalCode(`
    const btn = document.querySelector('.arena-dialog-close-btn');
    if (!btn) return false;
    btn.click();
    return true;
  `);
  console.log('Modal close button clicked:', modalCloseClicked);
  await wait(400);

  const modalAfter = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
  console.log('Modal closed after clicking cross button:', !modalAfter);
  await capture('cross-test-02-modal-closed');
  report.modalDialogCrossButton = modalBefore && modalCloseClicked && !modalAfter;

  // -------------------------------------------------------------
  // TEST 2: Process Card Individual Remove Cross Button
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Process Card Individual Remove Cross Button ---');
  const cardCountBefore = await evalCode(`return document.querySelectorAll('.arena-process-node').length;`);
  console.log('Process cards count before card remove cross click:', cardCountBefore);

  // Click the cross button on the first process card (P1)
  const cardRemoveClicked = await evalCode(`
    const btn = document.querySelector('.arena-process-node .proc-node-remove-btn');
    if (!btn) return false;
    btn.click();
    return true;
  `);
  console.log('Card remove cross button clicked:', cardRemoveClicked);
  await wait(400);

  const cardCountAfter = await evalCode(`return document.querySelectorAll('.arena-process-node').length;`);
  console.log('Process cards count after card remove cross click:', cardCountAfter);
  await capture('cross-test-03-card-removed');
  report.processCardCrossButton = cardRemoveClicked && cardCountAfter === cardCountBefore - 1;

  // -------------------------------------------------------------
  // TEST 3: Context Inspector Cross Button
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Context Inspector Cross Button ---');
  // Open inspector via clicking the state bar
  await evalCode(`document.querySelector('.inspect-semaphores-btn')?.click();`);
  await wait(400);

  const inspectorBefore = await evalCode(`return Boolean(document.querySelector('.arena-inspector-overlay'));`);
  console.log('Context Inspector opened:', inspectorBefore);
  await capture('cross-test-04-inspector-open');

  // Click inspector close cross button
  const inspectorCloseClicked = await evalCode(`
    const btn = document.querySelector('.inspector-close-btn');
    if (!btn) return false;
    btn.click();
    return true;
  `);
  console.log('Inspector close cross button clicked:', inspectorCloseClicked);
  await wait(400);

  const inspectorAfter = await evalCode(`return Boolean(document.querySelector('.arena-inspector-overlay'));`);
  console.log('Context Inspector closed after clicking cross button:', !inspectorAfter);
  await capture('cross-test-05-inspector-closed');
  report.contextInspectorCrossButton = inspectorBefore && inspectorCloseClicked && !inspectorAfter;

  console.log('\n=== ALL CROSS BUTTON TEST RESULTS ===');
  console.table(report);

  edge.kill();
  process.exit(0);
}

testAllCrossButtons().catch((err) => {
  console.error(err);
  process.exit(1);
});
