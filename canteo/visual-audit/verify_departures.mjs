import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function runDeparturesVerification() {
  console.log('=== STARTING 3D PROCESS DEPARTURE VISUAL VERIFICATION ===');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-3d-exit-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9986',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9986/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    console.error('Edge failed to launch on 9986');
    process.exit(1);
  }

  const targets = await (await fetch('http://127.0.0.1:9986/json/list')).json();
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

  await call('Page.navigate', { url: 'http://127.0.0.1:5173/app?tab=synclab' });

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
  for (let i = 0; i < 30; i++) {
    await wait(300);
    const hasTab = await runJs(`Boolean(Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('3D Simulation')))`);
    if (hasTab) break;
  }
  await runJs(`
    const tabBtn = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('3D Simulation'));
    tabBtn?.click();
  `);
  for (let i = 0; i < 30; i++) {
    await wait(300);
    const hasStepper = await runJs(`Boolean(document.querySelector('.process-stepper-group'))`);
    if (hasStepper) break;
  }
  await wait(800);

  // 2. Set up single order demonstration: 1 Producer, 1 Consumer with single workload mode
  console.log('\n--- Step 2: Setting up 1 Single-Workload Producer and 1 Single-Workload Consumer ---');
  // First, ensure 1 producer and 1 consumer
  await runJs(`
    // Producer stepper: currently 2 producers, click minus once
    const prodMinus = document.querySelectorAll('.process-stepper-group')[0]?.querySelector('.stepper-btn-minus');
    prodMinus?.click();

    // Consumer stepper: currently 2 consumers, click minus once
    const consMinus = document.querySelectorAll('.process-stepper-group')[1]?.querySelector('.stepper-btn-minus');
    consMinus?.click();
  `);
  await wait(600);

  const initialStatus = await runJs(`
    const prods = document.querySelectorAll('.process-stepper-group')[0]?.querySelector('.count-number')?.textContent.trim();
    const cons = document.querySelectorAll('.process-stepper-group')[1]?.querySelector('.count-number')?.textContent.trim();
    return { producers: prods, consumers: cons };
  `);
  console.log('Setup counts:', initialStatus);
  await capture('3d-exit-01-initial-single-setup');

  // 3. Step P1 through submitting order
  console.log('\n--- Step 3: Stepping P1 to submit order ---');
  for (let step = 0; step < 6; step++) {
    await runJs(`
      const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') && !b.disabled);
      stepBtn?.click();
    `);
    await wait(350);
  }

  // P1 has finished submitting its order and reached COMPLETED
  // Capture screenshot of P1 leaving outside along terrace exit path
  console.log('\n--- Step 4: Observing P1 leaving outside along terrace exit path ---');
  await wait(400);
  await capture('3d-exit-02-producer-leaving-outside');

  // 4. Play/step simulation to allow C1 to claim order and cook dish
  console.log('\n--- Step 5: Stepping C1 to dequeue and begin cooking at workstation ---');
  for (let step = 0; step < 6; step++) {
    await runJs(`
      const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') && !b.disabled);
      stepBtn?.click();
    `);
    await wait(350);
  }
  await wait(500);
  await capture('3d-exit-03-consumer-cooking');

  // 5. Advance kitchen ticks until preparation finishes
  console.log('\n--- Step 6: Advancing kitchen ticks until C1 preparation completes ---');
  // Click Step or Play to advance ticks
  for (let tick = 0; tick < 10; tick++) {
    await runJs(`
      const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') && !b.disabled);
      stepBtn?.click();
    `);
    await wait(300);
  }

  // C1 reaches COMPLETED: walking towards Staff Exit Door
  console.log('\n--- Step 7: Observing C1 leaving via dedicated Staff Exit Door ---');
  await wait(500);
  await capture('3d-exit-04-consumer-leaving-staff-door');

  // 6. Wait for departure animation to complete
  console.log('\n--- Step 8: Verifying complete visual removal after exit ---');
  // Click Step a few times or wait to let departedIds finalize
  for (let s = 0; s < 5; s++) {
    await runJs(`
      const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') && !b.disabled);
      stepBtn?.click();
    `);
    await wait(300);
  }
  await wait(800);
  await capture('3d-exit-05-scene-empty-after-departures');

  // 7. Verify waiting consumers do NOT exit on idle
  console.log('\n--- Step 9: Verifying waiting consumers do NOT exit on idle ---');
  // Add 2 consumers while buffer is empty
  await runJs(`
    const consPlus = document.querySelectorAll('.process-stepper-group')[1]?.querySelector('.stepper-btn-plus');
    consPlus?.click();
    consPlus?.click();
  `);
  await wait(600);
  // Step both consumers so they wait for orders
  for (let s = 0; s < 4; s++) {
    await runJs(`
      const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') && !b.disabled);
      stepBtn?.click();
    `);
    await wait(300);
  }
  await wait(600);
  await capture('3d-exit-06-waiting-consumers-stay-inside');

  console.log('\n=== ALL DEPARTURE VERIFICATIONS COMPLETE ===');

  try { page.close(); } catch {}
  try { edge.kill(); } catch {}
  process.exit(0);
}

runDeparturesVerification().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
