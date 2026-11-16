import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function run3DVerification() {
  console.log('=== STARTING 3D SIMULATION VISUAL AUDIT & ACCEPTANCE ===');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-3d-' + Date.now());

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

  if (!browser) {
    console.error('Edge failed to launch on 9991');
    process.exit(1);
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

  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      page.send(JSON.stringify({ id, method, params }));
    });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('DOM.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });

  await call('Page.navigate', { url: 'http://localhost:5173/app?tab=synclab' });

  for (let i = 0; i < 25; i++) {
    await wait(300);
    const res = await call('Runtime.evaluate', {
      expression: `(() => document.body ? document.body.innerText.length : 0)()`,
      returnByValue: true
    });
    if ((res.result?.value ?? 0) > 100) break;
  }

  const runJs = async (code) => {
    const res = await call('Runtime.evaluate', {
      expression: `(() => { ${code} })()`,
      returnByValue: true
    });
    return res.result?.value;
  };

  const capture = async (name) => {
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    writeFileSync(join(SCREENSHOT_DIR, `${name}.png`), buffer);
    console.log(`[SCREENSHOT] ${name}.png saved`);
  };

  // 1. Navigate to 3D Simulation tab
  console.log('\n--- Step 1: Navigating to 3D Simulation tab ---');
  const nav3dResult = await runJs(`
    const tabBtn = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('3D Simulation'));
    if (tabBtn) {
      tabBtn.click();
      return { success: true, text: tabBtn.textContent.trim() };
    }
    return { success: false, availableTabs: Array.from(document.querySelectorAll('.arena-tab-btn')).map(b => b.textContent.trim()) };
  `);
  console.log('Nav 3D Result:', nav3dResult);
  await wait(1200);

  // Capture Screenshot 1: Initial Empty / Ready 3D Room
  await capture('3d-01-initial-empty-room');

  // 2. Step producer into room to acquire mutex and write
  console.log('\n--- Step 2: Stepping simulation to show mutex acquisition and order insertion ---');
  await runJs(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') || b.title?.includes('Step'));
    // Step twice: waitEmpty, waitMutex
    stepBtn?.click();
    stepBtn?.click();
  `);
  await wait(800);
  await capture('3d-02-producer-entering-and-writing');

  // 3. Step further until order is inserted and buffer fills
  console.log('\n--- Step 3: Stepping to produce buffer orders and show waiting bays ---');
  await runJs(`
    // Add 4 more producers to fill buffer and trigger waiting on capacity
    const plusProducer = document.querySelector('.process-stepper-group:first-child .stepper-btn-plus');
    plusProducer?.click();
    plusProducer?.click();
    plusProducer?.click();
    plusProducer?.click();

    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') || b.title?.includes('Step'));
    for (let i = 0; i < 28; i++) {
      stepBtn?.click();
    }
  `);
  await wait(1200);
  await capture('3d-03-full-buffer-and-capacity-wait');

  // 4. Step consumers to collect orders and advance read pointer
  console.log('\n--- Step 4: Stepping consumers to collect orders and exit to kitchen ---');
  await runJs(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') || b.title?.includes('Step'));
    for (let i = 0; i < 20; i++) {
      stepBtn?.click();
    }
  `);
  await wait(1200);
  await capture('3d-04-consumer-collecting-and-exit');

  // 5. Progress kitchen preparation outside
  console.log('\n--- Step 5: Progressing concurrent preparation at outside stations ---');
  await runJs(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') || b.title?.includes('Step'));
    for (let i = 0; i < 16; i++) {
      stepBtn?.click();
    }
  `);
  await wait(1200);
  await capture('3d-05-concurrent-preparation-outside');

  // 6. Test Top-Down camera preset
  console.log('\n--- Step 6: Switching to Top-Down Camera View ---');
  await runJs(`
    const topDownBtn = Array.from(document.querySelectorAll('.synclab-3d-btn')).find(b => b.textContent.includes('Top-Down'));
    topDownBtn?.click();
  `);
  await wait(800);
  await capture('3d-06-topdown-view');

  // 7. Test 2D Schematic fallback toggle
  console.log('\n--- Step 7: Testing 2D Schematic View Toggle ---');
  await runJs(`
    const schematicBtn = Array.from(document.querySelectorAll('.synclab-3d-btn')).find(b => b.textContent.includes('2D Schematic'));
    schematicBtn?.click();
  `);
  await wait(600);
  await capture('3d-07-2d-schematic-toggle');

  // 8. Test view switching back to Interactive Arena and verify state continuity
  console.log('\n--- Step 8: Switching back to Arena and verifying shared state continuity ---');
  const viewSwitchCheck = await runJs(`
    const arenaTab = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('SyncLab Arena'));
    arenaTab?.click();
    return { switched: true };
  `);
  await wait(800);

  const continuityCheck = await runJs(`
    const occupiedSlots = document.querySelectorAll('.arena-slot-node.occupied').length;
    const producerCount = parseInt(document.querySelector('.process-stepper-group:first-child .count-number')?.textContent || '0', 10);
    const consumerCount = parseInt(document.querySelector('.process-stepper-group:last-of-type .count-number')?.textContent || '0', 10);
    return {
      occupiedSlots,
      producerCount,
      consumerCount,
      preserved: producerCount > 0 && consumerCount > 0
    };
  `);
  console.log('Shared state continuity check:', continuityCheck);

  console.log('\n=== ALL 3D SIMULATION VISUAL AUDIT STEPS COMPLETED ===');
  page.close();
  edge.kill();
}

run3DVerification().catch(console.error);
