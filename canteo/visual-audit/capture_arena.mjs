import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const ARTIFACT_DIR = 'C:\\Users\\dmani\\.gemini\\antigravity\\brain\\71e74848-f0f1-44ed-b2f3-ca67ed5c59cb\\screenshots';

async function run() {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-arena-profile-' + Date.now());
  await mkdir(profileDir, { recursive: true });

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9924',
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
      const res = await fetch('http://127.0.0.1:9924/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    edge.kill();
    throw new Error('Failed to connect to Edge debugging port 9924');
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

  const targets = await (await fetch('http://127.0.0.1:9924/json/list')).json();
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
  };

  const capture = async (filename) => {
    await wait(350);
    const { data } = await call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(data, 'base64');
    const fullPath = join(ARTIFACT_DIR, filename);
    await writeFile(fullPath, buffer);
    console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
  };

  const evaluate = async (expression) => {
    const res = await call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      console.error('Eval error:', res.exceptionDetails);
    }
    return res.result?.value;
  };

  await setViewport(1440, 900);
  await wait(1500);

  // 1. Initial State Desktop
  console.log('Capturing Arena Initial State (1440x900)...');
  await capture('arena-01-initial-1440.png');

  // 2. Step several times
  console.log('Stepping simulation 4 times...');
  for (let s = 0; s < 4; s++) {
    await evaluate(`
      {
        const stepBtn = document.querySelector('.dock-btn-step');
        if (stepBtn) stepBtn.click();
      }
    `);
    await wait(350);
  }
  console.log('Capturing Arena Stepped State (1440x900)...');
  await capture('arena-02-stepped-1440.png');

  // 3. Open Hub / Semaphore Inspector
  console.log('Clicking central hub to open inspector...');
  await evaluate(`
    {
      const hub = document.querySelector('.arena-center-hub');
      if (hub) hub.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  `);
  await wait(450);
  console.log('Capturing Arena Inspector State (1440x900)...');
  await capture('arena-03-inspector-1440.png');

  // 3b. Click a process card to inspect POSIX C code
  console.log('Clicking a process card to inspect C code...');
  await evaluate(`
    {
      const procCard = document.querySelector('.arena-process-card.producer');
      if (procCard) procCard.click();
    }
  `);
  await wait(450);
  console.log('Capturing Process C Code Inspector (1440x900)...');
  await capture('arena-03b-process-inspector-1440.png');

  // 4. Close inspector and switch to Race Lab
  console.log('Switching to Race Lab view...');
  await evaluate(`
    {
      const closeBtn = document.querySelector('.inspector-close-btn');
      if (closeBtn) closeBtn.click();
      const raceTab = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('Race Lab'));
      if (raceTab) raceTab.click();
    }
  `);
  await wait(450);
  console.log('Capturing Arena Race Lab Initial (1440x900)...');
  await capture('arena-04-racelab-1440.png');

  // 4b. Step Race Lab to Step 4 (OVERWRITE)
  console.log('Advancing Race Lab to demonstrate lost update...');
  for (let rs = 0; rs < 3; rs++) {
    await evaluate(`
      {
        const nextStepBtn = document.querySelector('.narrative-step-btn');
        if (nextStepBtn && !nextStepBtn.disabled) nextStepBtn.click();
      }
    `);
    await wait(300);
  }
  console.log('Capturing Arena Race Lab Overwritten Fault (1440x900)...');
  await capture('arena-04b-race-overwritten-1440.png');

  // 5. Tablet resolution (1024x768)
  console.log('Switching back to Arena and capturing Tablet (1024x768)...');
  await evaluate(`
    const arenaTab = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('SyncLab Arena'));
    if (arenaTab) arenaTab.click();
  `);
  await wait(350);
  await setViewport(1024, 768);
  await wait(350);
  await capture('arena-05-tablet-1024.png');

  // 6. Mobile resolution (390x844)
  console.log('Capturing Mobile (390x844)...');
  await setViewport(390, 844, true);
  await wait(350);
  await capture('arena-06-mobile-390.png');

  console.log('All screenshots captured successfully!');
  edge.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
