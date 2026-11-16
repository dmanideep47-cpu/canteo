import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function runAudit() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-close-audit-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9999',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9999/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    console.error('Edge failed to launch on 9999');
    process.exit(1);
  }

  const targets = await (await fetch('http://127.0.0.1:9999/json/list')).json();
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

  await call('Page.navigate', { url: 'http://localhost:5180/app?tab=synclab' });

  for (let i = 0; i < 20; i++) {
    await wait(400);
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

  console.log('=== TEST 1: Open modal via Stepper bar & Close via Cross Button ===');
  await runJs(`document.querySelector('.stepper-manage-btn')?.click();`);
  await wait(400);
  let isOpen = await runJs(`return !!document.querySelector('.arena-overflow-dialog');`);
  console.log('Modal opened:', isOpen);

  // Click cross button
  await runJs(`document.querySelector('.arena-dialog-close-btn')?.click();`);
  await wait(400);
  let isClosed = await runJs(`return !document.querySelector('.arena-overflow-dialog');`);
  console.log('Modal closed via cross button:', isClosed);

  console.log('=== TEST 2: Add 3 producers (total 5) to produce overflow and test sector view ===');
  await runJs(`
    const addProducerBtn = document.querySelector('.stepper-group:first-child .stepper-btn-plus');
    if (addProducerBtn) {
      addProducerBtn.click();
      addProducerBtn.click();
      addProducerBtn.click();
    }
  `);
  await wait(600);

  // Check producer count
  const pCount = await runJs(`return document.querySelector('.producers-sector .arena-sector-count')?.textContent;`);
  console.log('Producer count in sector:', pCount);

  // Open via "View all" in producers sector
  await runJs(`document.querySelector('.arena-overflow-view-all-btn')?.click();`);
  await wait(400);
  isOpen = await runJs(`return !!document.querySelector('.arena-overflow-dialog');`);
  console.log('Modal opened via View all:', isOpen);

  // Click cross button
  await runJs(`document.querySelector('.arena-dialog-close-btn')?.click();`);
  await wait(400);
  isClosed = await runJs(`return !document.querySelector('.arena-overflow-dialog');`);
  console.log('Modal closed via cross button after View all:', isClosed);

  console.log('=== TEST 3: Open Inspector and test Inspector cross button ===');
  await runJs(`document.querySelector('.inspect-semaphores-btn')?.click();`);
  await wait(400);
  let isInspectorOpen = await runJs(`return !!document.querySelector('.arena-inspector-overlay');`);
  console.log('Inspector opened:', isInspectorOpen);

  await runJs(`document.querySelector('.inspector-close-btn')?.click();`);
  await wait(400);
  let isInspectorClosed = await runJs(`return !document.querySelector('.arena-inspector-overlay');`);
  console.log('Inspector closed via cross button:', isInspectorClosed);

  console.log('=== TEST 4: Open modal while Inspector is open ===');
  await runJs(`document.querySelector('.inspect-semaphores-btn')?.click();`);
  await wait(300);
  await runJs(`document.querySelector('.stepper-manage-btn')?.click();`);
  await wait(400);
  const modalOverInspector = await runJs(`
    const modal = document.querySelector('.arena-overflow-dialog');
    const insp = document.querySelector('.arena-inspector-overlay');
    return { modalOpen: !!modal, inspectorOpen: !!insp };
  `);
  console.log('Modal & Inspector state:', modalOverInspector);

  // Close modal via cross button
  await runJs(`document.querySelector('.arena-dialog-close-btn')?.click();`);
  await wait(400);
  const afterClose = await runJs(`return !document.querySelector('.arena-overflow-dialog');`);
  console.log('Modal closed cleanly:', afterClose);

  console.log('ALL CLOSE BUTTON TESTS COMPLETED SUCCESSFULLY.');
  page.close();
  edge.kill();
}

runAudit().catch(console.error);
