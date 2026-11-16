import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-close-btn-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9982',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 30; i++) {
    await wait(200);
    try {
      const res = await fetch('http://127.0.0.1:9982/json/version');
      if (res.ok) {
        browser = await res.json();
        break;
      }
    } catch {}
  }

  if (!browser) {
    console.error('Edge failed to launch on 9982');
    process.exit(1);
  }

  const targets = await (await fetch('http://127.0.0.1:9982/json/list')).json();
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

  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    page.send(JSON.stringify({ id, method, params }));
  });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await call('Page.navigate', { url: 'http://localhost:5180/app?tab=synclab' });

  const evalCode = async (expr) => {
    let script = expr.trim();
    if (!script.includes('return ') && !script.includes(';')) {
      script = `return (${script});`;
    }
    const full = `(() => { ${script} })()`;
    const res = await call('Runtime.evaluate', { expression: full, returnByValue: true });
    return res.result?.value;
  };

  for (let i = 0; i < 40; i++) {
    const ready = await evalCode(`Boolean(document.querySelector('.stepper-manage-btn'))`);
    if (ready) break;
    await wait(250);
  }

  console.log('--- TEST 1: Open via "Manage processes" button and click cross button ---');
  const opened = await evalCode(`
    const btn = document.querySelector('.stepper-manage-btn');
    if (!btn) return 'btn not found';
    btn.click();
    return true;
  `);
  console.log('Manage button clicked:', opened);
  await wait(300);

  const modalBefore = await evalCode(`Boolean(document.querySelector('.arena-overflow-dialog'))`);
  console.log('Modal visible before close click:', modalBefore);

  const closeBtnPresent = await evalCode(`Boolean(document.querySelector('.arena-dialog-close-btn'))`);
  console.log('Close button present:', closeBtnPresent);

  // Click the cross button
  const closeClicked = await evalCode(`
    const closeBtn = document.querySelector('.arena-dialog-close-btn');
    if (!closeBtn) return 'close btn not found';
    closeBtn.click();
    return true;
  `);
  console.log('Close button clicked:', closeClicked);
  await wait(300);

  const modalAfter = await evalCode(`Boolean(document.querySelector('.arena-overflow-dialog'))`);
  console.log('Modal visible after close click:', modalAfter);

  console.log('--- TEST 2: Open via "+1 more producers" overflow card and click cross button ---');
  // Add 3 producers so count is 5
  await evalCode(`
    const plusBtn = document.querySelectorAll('.stepper-btn-plus')[0];
    plusBtn.click();
    plusBtn.click();
    plusBtn.click();
  `);
  await wait(300);

  const overflowCardClicked = await evalCode(`
    const card = document.querySelector('.arena-process-overflow-card');
    if (!card) return 'overflow card not found';
    card.click();
    return true;
  `);
  console.log('Overflow card clicked:', overflowCardClicked);
  await wait(300);

  const modal2Before = await evalCode(`Boolean(document.querySelector('.arena-overflow-dialog'))`);
  console.log('Modal visible after overflow card clicked:', modal2Before);

  const close2Clicked = await evalCode(`
    const closeBtn = document.querySelector('.arena-dialog-close-btn');
    if (!closeBtn) return 'close btn not found';
    closeBtn.click();
    return true;
  `);
  console.log('Close button clicked on overflow modal:', close2Clicked);
  await wait(300);

  const modal2After = await evalCode(`Boolean(document.querySelector('.arena-overflow-dialog'))`);
  console.log('Modal visible after close click on overflow modal:', modal2After);

  console.log('--- TEST 3: Inspect Event Listeners & Pointer Events on Cross Button ---');
  const details = await evalCode(`
    const btn = document.querySelector('.stepper-manage-btn');
    btn.click();
    const closeBtn = document.querySelector('.arena-dialog-close-btn');
    const rect = closeBtn.getBoundingClientRect();
    const elAtPoint = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      elAtPointTag: elAtPoint?.tagName,
      elAtPointClass: elAtPoint?.className,
      isButtonOrChild: closeBtn.contains(elAtPoint)
    };
  `);
  console.log('Cross button elementFromPoint details:', details);

  // Click using synthetic MouseEvent at center coordinate
  const mouseEventClick = await evalCode(`
    const closeBtn = document.querySelector('.arena-dialog-close-btn');
    const rect = closeBtn.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const target = document.elementFromPoint(x, y);
    if (!target) return 'no element at point';
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return 'dispatched click to ' + target.tagName + '.' + target.className;
  `);
  console.log('Synthetic MouseEvent click result:', mouseEventClick);
  await wait(300);

  const modal3After = await evalCode(`Boolean(document.querySelector('.arena-overflow-dialog'))`);
  console.log('Modal visible after MouseEvent dispatch:', modal3After);

  edge.kill();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
