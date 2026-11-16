import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const ARTIFACT_DIR = 'C:\\Users\\dmani\\.gemini\\antigravity\\brain\\71e74848-f0f1-44ed-b2f3-ca67ed5c59cb\\screenshots';

async function run() {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-final-arena-' + Date.now());
  await mkdir(profileDir, { recursive: true });

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9933',
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
      const res = await fetch('http://127.0.0.1:9933/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    edge.kill();
    throw new Error('Failed to connect to Edge debugging port 9933');
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

  const targets = await (await fetch('http://127.0.0.1:9933/json/list')).json();
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

  // =========================================================================
  // VIEWPORT: 1440 x 900
  // =========================================================================
  await setViewport(1440, 900);
  await wait(1500);

  // 1. Initial State
  console.log('1440x900: Initial state...');
  await capture('arena-refined-01-initial-1440.png');

  // 2. Populated buffer (step through P1 insertion)
  console.log('1440x900: Stepping P1 to populate buffer...');
  for (let s = 0; s < 6; s++) {
    await evaluate(`{
      const stepBtn = document.querySelector('.dock-btn-secondary');
      if (stepBtn && !stepBtn.disabled) stepBtn.click();
    }`);
    await wait(250);
  }
  await capture('arena-refined-02-populated-1440.png');

  // 3. Selected process P1 (open inspector)
  console.log('1440x900: Selecting process P1 to open inspector...');
  await evaluate(`{
    const proc = document.querySelector('.arena-process-node.producer');
    if (proc) proc.click();
  }`);
  await wait(400);
  await capture('arena-refined-03-selected-process-1440.png');

  // 4. Open Hub Inspector (Dijkstra semaphores)
  console.log('1440x900: Opening Hub Semaphore Inspector...');
  await evaluate(`{
    const hub = document.querySelector('.arena-center-hub');
    if (hub) hub.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }`);
  await wait(400);
  await capture('arena-refined-04-hub-inspector-1440.png');

  // Close inspector
  await evaluate(`{
    const closeBtn = document.querySelector('.inspector-close-btn');
    if (closeBtn) closeBtn.click();
  }`);
  await wait(250);

  // 5. Blocked process (Load full buffer scenario)
  console.log('1440x900: Loading Full Buffer scenario (blocked producer P6)...');
  await evaluate(`{
    const scenarioSelect = document.querySelector('.scenario-select');
    if (scenarioSelect) {
      scenarioSelect.value = 'full';
      scenarioSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }`);
  await wait(600);
  await capture('arena-refined-05-blocked-1440.png');

  // 6. Race Condition Mode
  console.log('1440x900: Switching to Race Lab...');
  await evaluate(`{
    const raceTab = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('Race Lab'));
    if (raceTab) raceTab.click();
  }`);
  await wait(450);

  // Step race to show overwrite
  for (let s = 0; s < 3; s++) {
    await evaluate(`{
      const stepBtn = document.querySelector('.race-step-btn');
      if (stepBtn && !stepBtn.disabled) stepBtn.click();
    }`);
    await wait(250);
  }
  await capture('arena-refined-06-racelab-1440.png');

  // =========================================================================
  // VIEWPORT: 1280 x 800
  // =========================================================================
  console.log('Switching to 1280x800...');
  await evaluate(`{
    const arenaTab = Array.from(document.querySelectorAll('.arena-tab-btn')).find(b => b.textContent.includes('SyncLab Arena'));
    if (arenaTab) arenaTab.click();
  }`);
  await wait(450);
  await setViewport(1280, 800);
  await wait(400);
  await capture('arena-refined-07-arena-1280.png');

  console.log('All fresh screenshots captured successfully!');
  edge.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
