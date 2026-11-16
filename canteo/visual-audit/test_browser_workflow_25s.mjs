import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-reproduce-25s-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9957',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9957/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  const socket = new WebSocket(browser.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });

  let nextId = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const req = pending.get(message.id);
    if (!req) return;
    pending.delete(message.id);
    if (message.error) req.reject(new Error(message.error.message));
    else req.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

  await send('Target.createTarget', { url: 'http://localhost:5173/app?tab=synclab' });
  await wait(2000);

  const targets = await (await fetch('http://127.0.0.1:9957/json/list')).json();
  const target = targets.find((item) => item.type === 'page' && (item.url.includes('/app?tab=synclab') || item.url.includes('localhost:5173')));
  const page = new WebSocket(target.webSocketDebuggerUrl);
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
  await call('DOM.enable');
  await call('Runtime.enable');

  const evalCode = async (expr) => {
    const res = await call('Runtime.evaluate', { expression: `(() => { ${expr} })()`, returnByValue: true });
    if (res.exceptionDetails) {
      console.error('Eval error on:', expr, res.exceptionDetails);
    }
    return res.result?.value;
  };

  try {
    await wait(2000);

    // Navigate to SyncLab tab
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SyncLab') || b.textContent.includes('Operating Systems Lab'));
      if (btn) btn.click();
    `);
    await wait(1000);

    console.log('--- REPRODUCING 25 SECONDS PLAYBACK ---');

    // Click Play directly from initial state
    await evalCode(`
      const btn = document.querySelector('.dock-btn-primary');
      if (btn) btn.click();
    `);

    // Poll for 25 seconds
    for (let t = 1; t <= 25; t++) {
      await wait(900);
      const poll = await evalCode(`
        const eng = window.__synclab_engine__;
        const last = eng?.lastInstruction;
        return {
          t: ${t},
          lastInst: last ? (last.processId + ' ' + last.op) : null,
          stepCount: eng?.stepSequence,
          empty: eng?.empty?.value,
          full: eng?.full?.value,
          occ: eng?.buffer?.occupancy,
          mutexOwner: eng?.mutex?.owner,
          procs: eng?.processes?.map(p => p.id + ':' + p.state + (p.waitingFor ? '('+p.waitingFor+')' : '')),
          workers: eng?.workers?.map(w => w.id + ':' + w.state + (w.assignedOrderId ? '('+w.assignedOrderId+','+w.preparationProgress+'/'+w.preparationDuration+')' : '')),
          domPreview: document.querySelector('.preview-text')?.textContent?.trim(),
          domOccupiedSlots: Array.from(document.querySelectorAll('.arena-slot-node.occupied text')).map(t => t.textContent.trim())
        };
      `);
      console.log(`[T=${t}] last=${poll?.lastInst} occ=${poll?.occ} empty=${poll?.empty} full=${poll?.full} mutex=${poll?.mutexOwner} slots=[${poll?.domOccupiedSlots?.join(',')}]`);
      console.log(`     procs: ${poll?.procs?.join(' ')}`);
      console.log(`     workers: ${poll?.workers?.join(' ')}`);
      console.log(`     preview: "${poll?.domPreview}"`);
    }

  } finally {
    page.close();
    socket.close();
    edge.kill();
  }
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});

