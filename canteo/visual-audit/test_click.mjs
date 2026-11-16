import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function testClick() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-test-click-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9966',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9966/json/version');
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

  const targets = await (await fetch('http://127.0.0.1:9966/json/list')).json();
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
  await call('Runtime.enable');

  const evalCode = async (expr) => {
    const res = await call('Runtime.evaluate', { expression: `(() => { ${expr} })()`, returnByValue: true });
    return res.result?.value;
  };

  try {
    await wait(2000);

    // Switch tab
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SyncLab') || b.textContent.includes('Operating Systems Lab'));
      if (btn) btn.click();
    `);
    await wait(1000);

    // Open manage processes
    const openRes = await evalCode(`
      const btn = document.querySelector('.stepper-manage-btn');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    `);
    console.log('Opened manage processes:', openRes);
    await wait(500);

    // Check if dialog is present
    const isDialogOpen = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
    console.log('Is dialog open before click:', isDialogOpen);

    // Check pointer-events on backdrop, dialog, and close button
    const pointerEvents = await evalCode(`
      const backdrop = document.querySelector('.arena-overflow-backdrop');
      const dialog = document.querySelector('.arena-overflow-dialog');
      const closeBtn = document.querySelector('.arena-dialog-close-btn');
      return {
        backdrop: backdrop ? window.getComputedStyle(backdrop).pointerEvents : null,
        dialog: dialog ? window.getComputedStyle(dialog).pointerEvents : null,
        closeBtn: closeBtn ? window.getComputedStyle(closeBtn).pointerEvents : null,
      };
    `);
    console.log('Computed pointer-events:', pointerEvents);

    // Try clicking close button via element.click()
    const clickClose = await evalCode(`
      const closeBtn = document.querySelector('.arena-dialog-close-btn');
      if (closeBtn) {
        closeBtn.click();
        return true;
      }
      return false;
    `);
    console.log('Clicked close button:', clickClose);
    await wait(500);

    const isDialogOpenAfter = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
    console.log('Is dialog open after click:', isDialogOpenAfter);

    // Now re-open it and test ESC key
    await evalCode(`
      const btn = document.querySelector('.stepper-manage-btn');
      if (btn) btn.click();
    `);
    await wait(500);
    const isOpenReopened = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
    console.log('Is dialog re-opened:', isOpenReopened);

    // Test clicking the backdrop
    await evalCode(`
      const backdrop = document.querySelector('.arena-overflow-backdrop');
      if (backdrop) backdrop.click();
    `);
    await wait(500);
    const isOpenAfterBackdropClick = await evalCode(`return Boolean(document.querySelector('.arena-overflow-dialog'));`);
    console.log('Is dialog open after backdrop click:', isOpenAfterBackdropClick);

  } catch (err) {
    console.error(err);
  } finally {
    try { page.close(); } catch {}
    try { socket.close(); } catch {}
    try { edge.kill(); } catch {}
  }
}

testClick();
