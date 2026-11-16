import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function runCorrected3DVerification() {
  console.log('=== STARTING CORRECTED 3D SIMULATION VISUAL AUDIT ===');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-3d-corr-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9985',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9985/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    console.error('Edge failed to launch on 9985');
    process.exit(1);
  }

  const targets = await (await fetch('http://127.0.0.1:9985/json/list')).json();
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
  await runJs(`
    const tabBtn = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('3D Simulation'));
    tabBtn?.click();
  `);
  await wait(1200);

  // Capture Screenshot 1: Initial 2 consumers, 2 workstations
  await capture('3d-corr-01-initial-two-consumers');

  // 2. Acceptance Criterion: Add consumers until there are 8 consumers
  console.log('\n--- Step 2: Adding consumers to reach 8 consumers (Acceptance Criterion) ---');
  const addConsumersResult = await runJs(`
    const plusConsumerBtn = document.querySelectorAll('.process-stepper-group')[1]?.querySelector('.stepper-btn-plus');
    // Currently 2 consumers; click 6 times to reach 8 consumers
    for (let i = 0; i < 6; i++) {
      plusConsumerBtn?.click();
    }
    const count = document.querySelectorAll('.process-stepper-group')[1]?.querySelector('.count-number')?.textContent.trim();
    return { consumerCount: count };
  `);
  console.log('Consumer count after adding:', addConsumersResult);
  await wait(1200);

  // Capture Screenshot 2: 8 consumers with 8 workstations inside
  await capture('3d-corr-02-eight-consumers-acceptance');

  // 3. Step simulation to produce orders and watch producers stay outside
  console.log('\n--- Step 3: Stepping simulation to observe producer submitting at hatch outside ---');
  await runJs(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') || b.title?.includes('Step'));
    // Step P1: waitEmpty, waitMutex, insert, postMutex, postFull
    for (let i = 0; i < 5; i++) {
      stepBtn?.click();
    }
  `);
  await wait(800);
  await capture('3d-corr-03-producer-submits-outside');

  // 4. Step consumers to collect order at counter and return to workstation to cook
  console.log('\n--- Step 4: Stepping consumers to collect and cook inside kitchen ---');
  await runJs(`
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') || b.title?.includes('Step'));
    // Step consumer: waitFull, waitMutex, remove, postMutex, postEmpty, enter PREPARING
    for (let i = 0; i < 12; i++) {
      stepBtn?.click();
    }
  `);
  await wait(1000);
  await capture('3d-corr-04-consumer-collects-and-cooks');

  // 5. Fill buffer to demonstrate outside capacity wait
  console.log('\n--- Step 5: Adding producers to fill buffer and observe outside capacity wait bay ---');
  await runJs(`
    const plusProducerBtn = document.querySelectorAll('.process-stepper-group')[0]?.querySelector('.stepper-btn-plus');
    // Add 4 more producers
    for (let i = 0; i < 4; i++) {
      plusProducerBtn?.click();
    }
    const stepBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Step') || b.title?.includes('Step'));
    for (let i = 0; i < 20; i++) {
      stepBtn?.click();
    }
  `);
  await wait(1200);
  await capture('3d-corr-05-full-queue-capacity-wait');

  // 6. Test Counter Close-up view
  console.log('\n--- Step 6: Switching to Counter Close-up Camera View ---');
  await runJs(`
    const counterBtn = Array.from(document.querySelectorAll('.synclab-3d-btn')).find(b => b.textContent.includes('Counter'));
    counterBtn?.click();
  `);
  await wait(800);
  await capture('3d-corr-06-counter-closeup');

  // 7. Test Top-Down floor plan view
  console.log('\n--- Step 7: Switching to Top-Down Camera View ---');
  await runJs(`
    const topDownBtn = Array.from(document.querySelectorAll('.synclab-3d-btn')).find(b => b.textContent.includes('Top-Down'));
    topDownBtn?.click();
  `);
  await wait(800);
  await capture('3d-corr-07-topdown-plan');

  // 8. Test 2D Schematic fallback view
  console.log('\n--- Step 8: Switching to 2D Schematic Fallback ---');
  await runJs(`
    const schematicBtn = Array.from(document.querySelectorAll('.synclab-3d-btn')).find(b => b.textContent.includes('2D Schematic'));
    schematicBtn?.click();
  `);
  await wait(800);
  await capture('3d-corr-08-2d-schematic-fallback');

  // 9. Return to 3D and test safe removal of a consumer
  console.log('\n--- Step 9: Testing safe consumer removal and workstation reduction ---');
  const removalTest = await runJs(`
    // Switch back to 3D
    const retBtn = Array.from(document.querySelectorAll('.synclab-3d-btn')).find(b => b.textContent.includes('Return to 3D'));
    retBtn?.click();

    // Remove one consumer
    const minusConsumerBtn = document.querySelectorAll('.process-stepper-group')[1]?.querySelector('.stepper-btn-minus');
    minusConsumerBtn?.click();

    const count = document.querySelectorAll('.process-stepper-group')[1]?.querySelector('.count-number')?.textContent.trim();
    return { countAfterMinus: count };
  `);
  console.log('State after consumer removal:', removalTest);
  await wait(800);

  // 10. Switch back to Arena to verify seamless shared-session continuity
  console.log('\n--- Step 10: Switching back to SyncLab Arena to verify shared session ---');
  const arenaSwitch = await runJs(`
    const arenaTab = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('SyncLab Arena'));
    arenaTab?.click();
    return {
      counterPresent: !!document.querySelector('.arena-counter-wrapper'),
      dockPresent: !!document.querySelector('.arena-control-dock'),
      queueFlowPresent: !!document.querySelector('.live-queue-flow-section')
    };
  `);
  console.log('Arena switch verification:', arenaSwitch);

  console.log('\n=== ALL CORRECTED 3D VISUAL AUDIT STEPS COMPLETED ===');
  page.close();
  edge.kill();
}

runCorrected3DVerification().catch(console.error);
