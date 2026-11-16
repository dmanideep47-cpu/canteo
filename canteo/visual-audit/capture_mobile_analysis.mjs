import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-test-profile-' + Date.now());
  await mkdir(profileDir, { recursive: true });

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9333',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9333/json/version');
      if (res.ok) { browser = await res.json(); break; }
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

  await send('Target.createTarget', { url: 'http://127.0.0.1:5173/app?tab=synclab' });
  await wait(800);

  const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
  const target = targets.find((item) => item.type === 'page' && item.url.includes('/app?tab=synclab'));

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

  const evaluate = async (expression) => (await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;

  await wait(1200);

  // Set mobile device metrics
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
  await wait(300);

  // Add 1 producer and 1 consumer and step
  await evaluate(`
    const addP = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Producer'));
    addP?.click();
    const addC = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Consumer'));
    addC?.click();
  `);
  await wait(300);

  // Scroll to execution analysis section
  await evaluate(`
    const el = document.querySelector('.sl-analysis-section');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  `);
  await wait(400);

  const shot1 = await call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(new URL('./audit-final-10-mobile-390x844-analysis.png', import.meta.url), Buffer.from(shot1.data, 'base64'));
  console.log('Saved mobile analysis screenshot 1');

  // Scroll to explanation card
  await evaluate(`
    const el = document.querySelector('.sl-step-explanation-card');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  `);
  await wait(400);

  const shot2 = await call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(new URL('./audit-final-10-mobile-390x844-explanation.png', import.meta.url), Buffer.from(shot2.data, 'base64'));
  console.log('Saved mobile analysis screenshot 2');

  edge.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

