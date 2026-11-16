import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const ARTIFACT_DIR = 'C:\\Users\\dmani\\.gemini\\antigravity\\brain\\71e74848-f0f1-44ed-b2f3-ca67ed5c59cb\\screenshots';

async function run() {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-multiconsumer-' + Date.now());
  await mkdir(profileDir, { recursive: true });

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9944',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  edge.on('error', (err) => console.error('Edge spawn error:', err));

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9944/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    edge.kill();
    throw new Error('Failed to connect to Edge debugging port 9944');
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

  console.log('Creating browser target for http://localhost:5173/app?tab=synclab ...');
  await send('Target.createTarget', { url: 'http://localhost:5173/app?tab=synclab' });
  await wait(2000);

  const targets = await (await fetch('http://127.0.0.1:9944/json/list')).json();
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

  const setViewport = async (width, height, isMobile = false) => {
    await call('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: isMobile,
    });
    await call('Emulation.setVisibleSize', { width, height });
    await wait(200);
  };

  const evalCode = async (expr) => {
    const res = await call('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (res.exceptionDetails) {
      console.error('Eval error on:', expr, res.exceptionDetails);
    }
    return res.result?.value;
  };

  const capture = async (name) => {
    await wait(400);
    const { data } = await call('Page.captureScreenshot', { format: 'png' });
    const filePath = join(ARTIFACT_DIR, `${name}.png`);
    await writeFile(filePath, Buffer.from(data, 'base64'));
    console.log(`Saved screenshot: ${name}.png`);
  };

  try {
    await wait(2000);

    // Switch to SyncLab tab
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SyncLab') || b.textContent.includes('Operating Systems Lab'));
      if (btn) btn.click();
    `);
    await wait(1000);

    // 1. Initial State (1440x900)
    await setViewport(1440, 900);
    await capture('multiconsumer-01-initial-1440');

    // 2. Add consumers up to 8 consumers and step them to block on full
    await evalCode(`
      {
        const eng = window.__synclab_engine__;
        if (eng) {
          eng.reset();
          eng.addConsumer(8);
          // Step all 8 consumers so they block on sem_wait(&full)
          for (let i = 0; i < 8; i++) {
            eng.step('C' + (i + 1));
          }
          if (window.__synclab_refresh__) window.__synclab_refresh__();
        }
      }
    `);
    await wait(1000);
    await capture('multiconsumer-02-eight-consumers-1440');

    // 3. Open Overflow Dialog for Consumers
    await evalCode(`
      {
        const btn = document.querySelector('.arena-overflow-view-all-btn') || document.querySelector('.arena-process-overflow-card');
        if (btn) btn.click();
      }
    `);
    await wait(800);
    await capture('multiconsumer-03-overflow-dialog-1440');

    // Close Dialog
    await evalCode(`
      {
        const closeBtn = document.querySelector('.arena-dialog-close-btn') || document.querySelector('.arena-footer-close-btn');
        if (closeBtn) closeBtn.click();
      }
    `);
    await wait(500);

    // 4. Add 1 producer and run P1 through full insertion
    await evalCode(`
      {
        const eng = window.__synclab_engine__;
        if (eng) {
          eng.addProducer(1);
          // Step P1 through 6 instructions to publish order O01
          for (let s = 0; s < 6; s++) {
            eng.step('P1');
          }
          if (window.__synclab_refresh__) window.__synclab_refresh__();
        }
      }
    `);
    await wait(1000);
    await capture('multiconsumer-04-producer-published-1440');

    // 5. Step C1 through removal into PREPARING
    await evalCode(`
      {
        const eng = window.__synclab_engine__;
        if (eng) {
          // Step C1 through 5 instructions until PREPARING
          for (let s = 0; s < 5; s++) {
            eng.step('C1');
          }
          if (window.__synclab_refresh__) window.__synclab_refresh__();
        }
      }
    `);
    await wait(1000);
    await capture('multiconsumer-05-consumer-cooking-1440');

    // 6. Viewport 1280x800
    await setViewport(1280, 800);
    await capture('multiconsumer-06-desktop-1280');

    console.log('Multi-consumer visual audit captures complete!');
  } finally {
    page.close();
    socket.close();
    edge.kill();
  }
}

run().catch((err) => {
  console.error('Multi-consumer capture script failed:', err);
  process.exit(1);
});
