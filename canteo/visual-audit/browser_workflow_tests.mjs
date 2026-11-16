import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const SCREENSHOT_DIR = 'C:/Users/dmani/.gemini/antigravity/brain/71e74848-f0f1-44ed-b2f3-ca67ed5c59cb/screenshots';
try { mkdirSync(SCREENSHOT_DIR, { recursive: true }); } catch {}

async function run() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const profileDir = join(tmpdir(), 'edge-workflow-audit-' + Date.now());

  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9959',
    `--user-data-dir=${profileDir}`,
    '--disable-gpu',
    '--no-first-run',
    'about:blank'
  ], { detached: false });

  let browser = null;
  for (let i = 0; i < 20; i++) {
    await wait(300);
    try {
      const res = await fetch('http://127.0.0.1:9959/json/version');
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

  const targets = await (await fetch('http://127.0.0.1:9959/json/list')).json();
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
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  const evalCode = async (expr) => {
    const res = await call('Runtime.evaluate', { expression: `(() => { ${expr} })()`, returnByValue: true });
    if (res.exceptionDetails) {
      console.error('Eval error on:', expr, res.exceptionDetails);
    }
    return res.result?.value;
  };

  const capture = async (filename) => {
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    const path = join(SCREENSHOT_DIR, filename);
    writeFileSync(path, buffer);
    console.log(`[Evidence] Saved ${filename} (${buffer.length} bytes)`);
  };

  const clearSession = async () => {
    await evalCode(`
      window.confirm = () => true;
      const clearBtn = document.querySelector('.header-action-btn.danger-hover');
      if (clearBtn) clearBtn.click();
    `);
    await wait(400);
  };

  try {
    await wait(2000);

    // Switch to SyncLab tab
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('SyncLab') || b.textContent.includes('Operating Systems Lab'));
      if (btn) btn.click();
    `);
    await wait(1000);

    // Make speed faster for fast automated verification: select 4.0x speed
    await evalCode(`
      const speedSelect = document.querySelector('.speed-select');
      if (speedSelect) {
        speedSelect.value = '200';
        speedSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);

    console.log('====================================================');
    console.log('BROWSER REGRESSION SUITE: 5 WORKFLOW TESTS (EDGE CDP)');
    console.log('====================================================');

    // -----------------------------------------------------------------
    // TEST 1: Producer-Only Insertion
    // -----------------------------------------------------------------
    console.log('\n--- Running Test 1: Producer-Only Insertion ---');
    await clearSession();

    // Verify empty state
    let count = await evalCode(`return window.__synclab_engine__?.processes?.length ?? -1;`);
    assert.equal(count, 0, 'Must start with 0 processes');

    // Click "+ Student" button in header
    await evalCode(`
      const btn = Array.from(document.querySelectorAll('.header-action-btn.primary-add')).find(b => b.textContent.includes('Student'));
      if (btn) btn.click();
    `);
    await wait(300);

    const p1Info = await evalCode(`
      const p = window.__synclab_engine__?.processes?.[0];
      return { id: p?.id, orderId: p?.orderId, state: p?.state };
    `);
    assert.equal(p1Info.id, 'P1');
    assert.ok(p1Info.orderId, 'P1 must have assigned orderId');
    const test1OrderId = p1Info.orderId;

    // Click Play to run P1
    await evalCode(`
      const play = document.querySelector('.dock-btn-primary');
      if (play && !play.classList.contains('playing')) play.click();
    `);

    // Poll until P1 completes
    for (let t = 0; t < 25; t++) {
      await wait(300);
      const done = await evalCode(`return window.__synclab_engine__?.processes?.[0]?.state === 'COMPLETED';`);
      if (done) break;
    }

    const t1Result = await evalCode(`
      const eng = window.__synclab_engine__;
      const insertEvent = eng?.events?.find(e => e.type === 'insert');
      const slotText = document.querySelector('.arena-slot-node.occupied text')?.textContent?.trim();
      return {
        occ: eng?.buffer?.occupancy,
        pState: eng?.processes?.[0]?.state,
        slot0Id: eng?.buffer?.slots?.[0]?.id,
        insertEventOrderId: insertEvent?.orderId,
        insertEventSlot: insertEvent?.slot,
        domSlotText: slotText
      };
    `);

    assert.equal(t1Result.occ, 1, 'Buffer occupancy must be 1');
    assert.equal(t1Result.slot0Id, test1OrderId, 'Slot [0] must contain P1 order ID');
    assert.equal(t1Result.insertEventOrderId, test1OrderId, 'Recorded insert event must match order ID');
    assert.equal(t1Result.pState, 'COMPLETED');
    console.log(`✔ Test 1 PASSED: Order ${test1OrderId} inserted into slot [0], occupancy=1, insert event recorded.`);
    await capture('workflow-test1-producer-inserted.png');

    // -----------------------------------------------------------------
    // TEST 2: Producer and Consumer Completing Same Order ID
    // -----------------------------------------------------------------
    console.log('\n--- Running Test 2: Producer & Consumer Completing Same Order ---');
    await clearSession();

    // Click "+ Student" then "+ Kitchen"
    await evalCode(`
      const addBtns = Array.from(document.querySelectorAll('.header-action-btn.primary-add'));
      const studentBtn = addBtns.find(b => b.textContent.includes('Student'));
      const kitchenBtn = addBtns.find(b => b.textContent.includes('Kitchen'));
      if (studentBtn) studentBtn.click();
      if (kitchenBtn) kitchenBtn.click();
    `);
    await wait(300);

    const t2Start = await evalCode(`
      const eng = window.__synclab_engine__;
      return {
        pId: eng?.processes?.find(p => p.type === 'PRODUCER')?.id,
        orderId: eng?.processes?.find(p => p.type === 'PRODUCER')?.orderId,
        cId: eng?.processes?.find(p => p.type === 'CONSUMER')?.id,
      };
    `);
    const test2OrderId = t2Start.orderId;
    assert.ok(test2OrderId, 'Producer must have orderId');

    // Click Play
    await evalCode(`
      const play = document.querySelector('.dock-btn-primary');
      if (play && !play.classList.contains('playing')) play.click();
    `);

    // Poll until preparation is completed (order is READY)
    let t2OrderReady = false;
    for (let t = 0; t < 30; t++) {
      await wait(300);
      t2OrderReady = await evalCode(`
        const eng = window.__synclab_engine__;
        return eng?.orders?.['${test2OrderId}']?.lifecycle === 'READY';
      `);
      if (t2OrderReady) break;
    }

    const t2Result = await evalCode(`
      const eng = window.__synclab_engine__;
      const insert = eng?.events?.find(e => e.type === 'insert');
      const remove = eng?.events?.find(e => e.type === 'remove');
      const orderReady = eng?.events?.find(e => e.type === 'order-ready');
      return {
        occ: eng?.buffer?.occupancy,
        insertOrderId: insert?.orderId,
        removeOrderId: remove?.orderId,
        orderReadyId: orderReady?.orderId,
        consumerWorkerState: eng?.workers?.[0]?.state,
        orderLifecycle: eng?.orders?.['${test2OrderId}']?.lifecycle
      };
    `);

    assert.equal(t2Result.insertOrderId, test2OrderId, 'Recorded insertion must be test2OrderId');
    assert.equal(t2Result.removeOrderId, test2OrderId, 'Recorded collection must match EXACT same test2OrderId');
    assert.equal(t2Result.orderReadyId, test2OrderId, 'Recorded dish completion must match test2OrderId');
    assert.equal(t2Result.orderLifecycle, 'READY');
    assert.equal(t2Result.occ, 0, 'Buffer occupancy must return to 0');
    console.log(`✔ Test 2 PASSED: Order ${test2OrderId} inserted, collected by kitchen, prepared to READY, buffer emptied.`);
    await capture('workflow-test2-producer-consumer-completed.png');

    // -----------------------------------------------------------------
    // TEST 3: Consumer First (Blocks on Empty), Followed by Producer
    // -----------------------------------------------------------------
    console.log('\n--- Running Test 3: Consumer First (Blocks), Followed by Producer ---');
    await clearSession();

    // Click "+ Kitchen" only
    await evalCode(`
      const kitchenBtn = Array.from(document.querySelectorAll('.header-action-btn.primary-add')).find(b => b.textContent.includes('Kitchen'));
      if (kitchenBtn) kitchenBtn.click();
    `);
    await wait(300);

    // Step once: C1 executes wait(full)
    await evalCode(`
      const stepBtn = document.querySelector('button[title*="Single-step"], button.dock-btn-secondary');
      if (stepBtn) stepBtn.click();
    `);
    await wait(300);

    const c1Blocked = await evalCode(`
      const c = window.__synclab_engine__?.processes?.[0];
      return { state: c?.state, waitingFor: c?.waitingFor };
    `);
    assert.equal(c1Blocked.state, 'BLOCKED', 'Consumer must be BLOCKED on empty buffer');
    assert.equal(c1Blocked.waitingFor, 'full');

    // Now click "+ Student"
    await evalCode(`
      const studentBtn = Array.from(document.querySelectorAll('.header-action-btn.primary-add')).find(b => b.textContent.includes('Student'));
      if (studentBtn) studentBtn.click();
    `);
    await wait(300);

    const pOrderId = await evalCode(`return window.__synclab_engine__?.processes?.find(p => p.type === 'PRODUCER')?.orderId;`);

    // Click Play to let Producer run, wake Consumer, and let Consumer cook
    await evalCode(`
      const play = document.querySelector('.dock-btn-primary');
      if (play && !play.classList.contains('playing')) play.click();
    `);

    for (let t = 0; t < 30; t++) {
      await wait(300);
      const isReady = await evalCode(`return window.__synclab_engine__?.orders?.['${pOrderId}']?.lifecycle === 'READY';`);
      if (isReady) break;
    }

    const t3Result = await evalCode(`
      const eng = window.__synclab_engine__;
      const remove = eng?.events?.find(e => e.type === 'remove');
      return {
        orderLifecycle: eng?.orders?.['${pOrderId}']?.lifecycle,
        collectedOrderId: remove?.orderId
      };
    `);
    assert.equal(t3Result.collectedOrderId, pOrderId, 'Waiting consumer must awaken and collect the produced order');
    assert.equal(t3Result.orderLifecycle, 'READY');
    console.log(`✔ Test 3 PASSED: Consumer blocked on full==0, awakened by producer, completed ${pOrderId}.`);
    await capture('workflow-test3-consumer-first-awakened.png');

    // -----------------------------------------------------------------
    // TEST 4: Dynamic Process Creation During Playback
    // -----------------------------------------------------------------
    console.log('\n--- Running Test 4: Dynamic Process Creation During Playback ---');
    await clearSession();

    // Add 1 student producer
    await evalCode(`
      const studentBtn = Array.from(document.querySelectorAll('.header-action-btn.primary-add')).find(b => b.textContent.includes('Student'));
      if (studentBtn) studentBtn.click();
    `);
    await wait(300);

    const t4Order = await evalCode(`return window.__synclab_engine__?.processes?.[0]?.orderId;`);

    // Click Play while ONLY Producer exists
    await evalCode(`
      const play = document.querySelector('.dock-btn-primary');
      if (play && !play.classList.contains('playing')) play.click();
    `);
    await wait(400);

    // WHILE PLAYING: dynamically add a consumer!
    await evalCode(`
      const kitchenBtn = Array.from(document.querySelectorAll('.header-action-btn.primary-add')).find(b => b.textContent.includes('Kitchen'));
      if (kitchenBtn) kitchenBtn.click();
    `);

    // Wait for the dynamic consumer to pick up the order and prepare it
    for (let t = 0; t < 30; t++) {
      await wait(300);
      const ready = await evalCode(`return window.__synclab_engine__?.orders?.['${t4Order}']?.lifecycle === 'READY';`);
      if (ready) break;
    }

    const t4Result = await evalCode(`
      const eng = window.__synclab_engine__;
      const remove = eng?.events?.find(e => e.type === 'remove');
      return {
        procCount: eng?.processes?.length,
        collectedOrderId: remove?.orderId,
        orderLifecycle: eng?.orders?.['${t4Order}']?.lifecycle
      };
    `);
    assert.equal(t4Result.procCount, 2, 'Dynamically added process must exist in engine processes');
    assert.equal(t4Result.collectedOrderId, t4Order, 'Dynamically added consumer must collect the order during playback');
    assert.equal(t4Result.orderLifecycle, 'READY');
    console.log(`✔ Test 4 PASSED: Consumer added dynamically during active playback collected and completed ${t4Order}.`);
    await capture('workflow-test4-dynamic-creation-playback.png');

    // -----------------------------------------------------------------
    // TEST 5: Reset Followed by a Fresh Working Session
    // -----------------------------------------------------------------
    console.log('\n--- Running Test 5: Reset Followed by Fresh Working Session ---');

    // Click "Reset" button in header
    await evalCode(`
      const resetBtn = Array.from(document.querySelectorAll('.header-action-btn')).find(b => b.textContent.includes('Reset'));
      if (resetBtn) resetBtn.click();
    `);
    await wait(400);

    const resetState = await evalCode(`
      const eng = window.__synclab_engine__;
      return {
        occ: eng?.buffer?.occupancy,
        empty: eng?.empty?.value,
        full: eng?.full?.value,
        mutex: eng?.mutex?.owner
      };
    `);
    assert.equal(resetState.occ, 0, 'Buffer must be empty after Reset');
    assert.equal(resetState.empty, 5);
    assert.equal(resetState.full, 0);
    assert.equal(resetState.mutex, null);

    // Clear to start fresh session
    await clearSession();

    // Add 1 student and 1 kitchen
    await evalCode(`
      const addBtns = Array.from(document.querySelectorAll('.header-action-btn.primary-add'));
      addBtns.find(b => b.textContent.includes('Student'))?.click();
      addBtns.find(b => b.textContent.includes('Kitchen'))?.click();
    `);
    await wait(300);

    const freshOrder = await evalCode(`return window.__synclab_engine__?.processes?.find(p => p.type === 'PRODUCER')?.orderId;`);

    // Click Play
    await evalCode(`
      const play = document.querySelector('.dock-btn-primary');
      if (play && !play.classList.contains('playing')) play.click();
    `);

    for (let t = 0; t < 30; t++) {
      await wait(300);
      const ready = await evalCode(`return window.__synclab_engine__?.orders?.['${freshOrder}']?.lifecycle === 'READY';`);
      if (ready) break;
    }

    const t5Result = await evalCode(`
      const eng = window.__synclab_engine__;
      const insert = eng?.events?.find(e => e.type === 'insert');
      const remove = eng?.events?.find(e => e.type === 'remove');
      return {
        insertOrderId: insert?.orderId,
        removeOrderId: remove?.orderId,
        lifecycle: eng?.orders?.['${freshOrder}']?.lifecycle
      };
    `);

    assert.equal(t5Result.insertOrderId, freshOrder);
    assert.equal(t5Result.removeOrderId, freshOrder);
    assert.equal(t5Result.lifecycle, 'READY');
    console.log(`✔ Test 5 PASSED: Fresh post-reset session cleanly processed and completed order ${freshOrder}.`);
    await capture('workflow-test5-reset-fresh-session.png');

    console.log('\n====================================================');
    console.log('ALL 5 BROWSER REGRESSION TESTS PASSED CLEANLY IN EDGE!');
    console.log('====================================================');

  } finally {
    page.close();
    socket.close();
    edge.kill();
  }
}

run().catch((err) => {
  console.error('Browser test run failed:', err);
  process.exit(1);
});
