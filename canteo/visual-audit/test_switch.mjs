import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function testSwitch() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-sw-full-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9986',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'http://localhost:5173/app?tab=synclab'
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

  const targets = await (await fetch('http://127.0.0.1:9986/json/list')).json();
  const pageTarget = targets.find((t) => t.type === 'page');

  const page = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => { page.onopen = resolve; });

  let nextId = 0;
  const pending = new Map();
  page.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', msg.params?.exceptionDetails?.text, msg.params?.exceptionDetails?.exception?.description);
    }
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

  for (let i = 0; i < 20; i++) {
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

  console.log('1. Initial state check...');
  const initTabs = await runJs(`
    return {
      tabs: Array.from(document.querySelectorAll('.arena-tab-btn')).map(b => ({
        text: b.textContent.trim(),
        active: b.classList.contains('active')
      })),
      hasCounter: !!document.querySelector('.arena-counter-wrapper'),
      hasDock: !!document.querySelector('.arena-control-dock'),
      hasQueueFlow: !!document.querySelector('.live-queue-flow-section')
    };
  `);
  console.log('Initial state:', initTabs);

  console.log('2. Switching to 3D Simulation...');
  await runJs(`
    const btn = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('3D Simulation'));
    btn?.click();
  `);
  await wait(1200);

  const stateIn3D = await runJs(`
    return {
      tabs: Array.from(document.querySelectorAll('.arena-tab-btn')).map(b => ({
        text: b.textContent.trim(),
        active: b.classList.contains('active')
      })),
      has3DContainer: !!document.querySelector('.synclab-3d-page'),
      hasCanvas: !!document.querySelector('.synclab-3d-canvas-container canvas'),
      hasCameraButtons: document.querySelectorAll('.synclab-3d-camera-actions button').length,
      modeToggleText: document.querySelector('.synclab-3d-camera-actions button:last-child')?.textContent.trim()
    };
  `);
  console.log('State in 3D:', stateIn3D);

  console.log('3. Switching back to SyncLab Arena...');
  await runJs(`
    const btn = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('SyncLab Arena'));
    btn?.click();
  `);
  await wait(1200);

  const stateInArena = await runJs(`
    return {
      tabs: Array.from(document.querySelectorAll('.arena-tab-btn')).map(b => ({
        text: b.textContent.trim(),
        active: b.classList.contains('active')
      })),
      hasCounter: !!document.querySelector('.arena-counter-wrapper'),
      hasDock: !!document.querySelector('.arena-control-dock'),
      hasQueueFlow: !!document.querySelector('.live-queue-flow-section')
    };
  `);
  console.log('State returning to Arena:', stateInArena);

  page.close();
  edge.kill();
}

testSwitch().catch(console.error);
