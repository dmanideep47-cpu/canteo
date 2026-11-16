import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-reproduce-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9956',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9956/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    edge.kill();
    throw new Error('Failed to connect to Edge debugging port 9956');
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

  const targets = await (await fetch('http://127.0.0.1:9956/json/list')).json();
  const target = targets.find((item) => item.type === 'page' && (item.url.includes('/app?tab=synclab') || item.url.includes('localhost:5173')));
  if (!target) {
    edge.kill();
    throw new Error('App target not found');
  }

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

    console.log('--- REPRODUCING ORDINARY WORKFLOW ---');

    // 1. Check initial state from DOM
    let status = await evalCode(`
      return {
        producers: Array.from(document.querySelectorAll('.producers-sector .arena-process-node')).map(n => n.textContent.trim().replace(/\\s+/g, ' ')),
        consumers: Array.from(document.querySelectorAll('.consumers-sector .arena-process-node')).map(n => n.textContent.trim().replace(/\\s+/g, ' ')),
        hub: document.querySelector('.center-hub-content')?.textContent?.trim().replace(/\\s+/g, ' '),
        dockPreview: document.querySelector('.preview-text')?.textContent?.trim(),
        stepBtnDisabled: document.querySelector('.dock-btn-secondary')?.disabled,
        playBtnText: document.querySelector('.dock-btn-primary')?.textContent?.trim(),
      };
    `);
    console.log('1. Initial DOM state:', JSON.stringify(status, null, 2));

    // 2. Click "+ Student" (Add producer)
    console.log('2. Clicking + Student (Add producer)...');
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('.header-action-btn')).find(b => b.textContent.includes('Student'));
      if (btn) btn.click();
      return !!btn;
    `);
    await wait(500);

    // 3. Click "+ Kitchen" (Add consumer)
    console.log('3. Clicking + Kitchen (Add consumer)...');
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('.header-action-btn')).find(b => b.textContent.includes('Kitchen'));
      if (btn) btn.click();
      return !!btn;
    `);
    await wait(500);

    status = await evalCode(`
      return {
        producers: Array.from(document.querySelectorAll('.producers-sector .arena-process-node')).map(n => n.textContent.trim().replace(/\\s+/g, ' ')),
        consumers: Array.from(document.querySelectorAll('.consumers-sector .arena-process-node')).map(n => n.textContent.trim().replace(/\\s+/g, ' ')),
        dockPreview: document.querySelector('.preview-text')?.textContent?.trim(),
      };
    `);
    console.log('After adding producer & consumer:', JSON.stringify(status, null, 2));

    // 4. Click "Play"
    console.log('4. Clicking Play...');
    const playClicked = await evalCode(`
      const btn = document.querySelector('.dock-btn-primary');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    `);
    console.log('Play button clicked:', playClicked);

    // 5. Poll for 12 seconds
    console.log('5. Polling playback for 12 seconds...');
    for (let t = 1; t <= 12; t++) {
      await wait(1000);
      const poll = await evalCode(`
        return {
          playBtn: document.querySelector('.dock-btn-primary')?.textContent?.trim(),
          hub: document.querySelector('.center-hub-content')?.textContent?.trim().replace(/\\s+/g, ' '),
          dockPreview: document.querySelector('.preview-text')?.textContent?.trim(),
          stepCount: document.querySelector('.dock-field:last-child')?.textContent?.trim(),
          producers: Array.from(document.querySelectorAll('.producers-sector .arena-process-node')).map(n => n.textContent.trim().replace(/\\s+/g, ' ')),
          consumers: Array.from(document.querySelectorAll('.consumers-sector .arena-process-node')).map(n => n.textContent.trim().replace(/\\s+/g, ' ')),
          slots: Array.from(document.querySelectorAll('.arena-buffer-slot')).map((s, idx) => ({
            idx,
            classes: s.className,
            text: s.textContent.trim().replace(/\\s+/g, ' ')
          })).filter(s => !s.text.includes('Empty'))
        };
      `);
      console.log(`[T=${t}s] play="${poll?.playBtn}" hub="${poll?.hub}" preview="${poll?.dockPreview}" slots=${poll?.slots?.length}`);
      if (poll?.slots?.length > 0) {
        console.log('  Slots:', poll.slots);
      }
      if (poll?.producers?.length) {
        console.log('  Producers:', poll.producers);
      }
      if (poll?.consumers?.length) {
        console.log('  Consumers:', poll.consumers);
      }
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
