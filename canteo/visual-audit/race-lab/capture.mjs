import { writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:9333';
const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = await (await fetch(`${base}/json/version`)).json();
const socket = new WebSocket(browser.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 0;
const pending = new Map();
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
await send('Target.createTarget', { url: 'http://127.0.0.1:5173/app?tab=synclab' });
await wait(300);
const targets = await (await fetch(`${base}/json/list`)).json();
const target = targets.find((item) => item.type === 'page' && item.url.includes('/app?tab=synclab'));
if (!target) throw new Error('App page target was not created.');
const page = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { page.onopen = resolve; page.onerror = reject; });
let pageId = 0;
const pagePending = new Map();
const logs = [];
const imageRequests = [];
const requestUrls = new Map();
const failedImageRequests = [];
page.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') logs.push(`exception: ${message.params.exceptionDetails.text}`);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') logs.push(`console error: ${message.params.args.map((arg) => arg.value ?? arg.description).join(' ')}`);
  if (message.method === 'Network.requestWillBeSent') requestUrls.set(message.params.requestId, message.params.request.url);
  if (message.method === 'Network.responseReceived' && message.params.response.url.includes('canteen-dishes.png')) imageRequests.push({ status: message.params.response.status, url: message.params.response.url });
  if (message.method === 'Network.loadingFailed' && (requestUrls.get(message.params.requestId) ?? '').includes('canteen-dishes.png')) failedImageRequests.push({ url: requestUrls.get(message.params.requestId), error: message.params.errorText });
  const request = pagePending.get(message.id);
  if (!request) return;
  pagePending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++pageId;
  pagePending.set(id, { resolve, reject });
  page.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => (await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
const screenshot = async (name, width, height, mobile = false) => {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
  await wait(350);
  const shot = await call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(new URL(`./${name}.png`, import.meta.url), Buffer.from(shot.data, 'base64'));
};
const clickButton = async (selector, text) => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].find(x=>x.innerText.includes(${JSON.stringify(text)}))?.click()`);
const stepText = async () => evaluate('document.querySelector(".race-step-count > span")?.innerText');
const scrollTo = async (selector) => { await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:"center",behavior:"instant"})`); await wait(150); };
await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable'); await call('Log.enable');
await call('Page.navigate', { url: target.url });
await wait(1400);
const initialText = await evaluate('document.body.innerText.slice(0, 500)');
const initialButtons = await evaluate('[...document.querySelectorAll("button")].map(x=>x.innerText.trim()).filter(Boolean).slice(0,40)');
if (!initialText.includes('SyncLab')) {
  await evaluate('[...document.querySelectorAll("button")].find(x=>x.innerText.includes("SyncLab"))?.click()');
  await wait(1000);
}
await evaluate('[...document.querySelectorAll("button")].find(x=>x.innerText.includes("Race Condition Laboratory"))?.click()');
await wait(500);
const heading = await evaluate('document.querySelector("#race-lab-title")?.innerText ?? "Race laboratory not found"');
if (!heading.includes('One queue')) throw new Error(`Race page not reached: ${heading}; buttons=${JSON.stringify(initialButtons)}`);
await screenshot('initial-desktop-1440x900', 1440, 900);
await screenshot('desktop-1280x720', 1280, 720);
await screenshot('desktop-1024x768', 1024, 768);
await evaluate('[...document.querySelectorAll(".race-controls button")].find(x=>x.innerText.includes("Next step"))?.click()');
await evaluate('[...document.querySelectorAll(".race-controls button")].find(x=>x.innerText.includes("Next step"))?.click()');
await wait(200);
await screenshot('unsafe-intermediate-1440x900', 1440, 900);
await evaluate('[...document.querySelectorAll(".race-controls button")].find(x=>x.innerText.includes("Next step"))?.click()');
await evaluate('[...document.querySelectorAll(".race-controls button")].find(x=>x.innerText.includes("Next step"))?.click()');
await wait(250);
const controlChecks = {};
controlChecks.unsafeStaleSlotHighlighted = await evaluate('(()=>{const rows=[...document.querySelectorAll(".race-slot")];return rows.findIndex(x=>x.classList.contains("focused"))===0 && rows.findIndex(x=>x.classList.contains("head"))===1})()');
await screenshot('unsafe-outcome-1440x900', 1440, 900);
await scrollTo('.race-outcome');
await screenshot('unsafe-outcome-detail-1440x900', 1440, 900);
await evaluate('window.scrollTo(0,0)');
await clickButton('.race-mode-buttons button', 'With mutex');
await clickButton('.race-controls button', 'Next step');
await clickButton('.race-controls button', 'Next step');
await wait(200);
controlChecks.protectedWaitVisible = await evaluate('document.querySelector(".race-worker[aria-label=\"Kitchen worker C2\"] .race-status")?.innerText === "Waiting for mutex"');
await screenshot('protected-waiting-1440x900', 1440, 900);
for (let index = 0; index < 4; index += 1) await clickButton('.race-controls button', 'Next step');
await wait(250);
await screenshot('protected-outcome-1440x900', 1440, 900);
await scrollTo('.race-outcome');
await screenshot('protected-outcome-detail-1440x900', 1440, 900);
await evaluate('window.scrollTo(0,0)');
await clickButton('.race-mode-buttons button', 'Without protection');
await screenshot('mobile-390x844', 390, 844, true);

await evaluate('window.scrollTo(0,0)');
await clickButton('.race-controls button', 'Next step');
controlChecks.oneStep = await stepText();
await clickButton('.race-controls button', 'Reset');
await clickButton('.race-controls button', 'Play');
await wait(300);
await clickButton('.race-controls button', 'Pause');
const pausedAt = await stepText();
await wait(1200);
controlChecks.pauseStops = pausedAt === await stepText();
await clickButton('.race-controls button', 'Reset');
await clickButton('.race-controls button', 'Play');
await wait(250);
await clickButton('.race-controls button', 'Reset');
await wait(1250);
controlChecks.resetDuringPlay = await stepText() === 'READY TO BEGIN';
await clickButton('.race-controls button', 'Play');
await wait(1200);
await clickButton('.race-mode-buttons button', 'With mutex');
await wait(1250);
controlChecks.modeSwitchStops = await evaluate('document.querySelector(".race-step-count > span")?.innerText === "READY TO BEGIN" && document.querySelector(".race-mode-copy strong")?.innerText === "With mutex"');
await clickButton('.race-controls button', 'Next step');
for (let index = 0; index < 5; index += 1) await clickButton('.race-controls button', 'Next step');
controlChecks.completed = await evaluate('document.querySelector(".race-step-count > span")?.innerText.includes("STEP 06 OF 06")');
await clickButton('.race-controls button', 'Replay');
controlChecks.replayResets = await stepText() === 'READY TO BEGIN';
await wait(1200);
controlChecks.replayStarts = await stepText() === 'STEP 01 OF 06';
await clickButton('.sl-section-nav button', 'Synchronization Solution');
await wait(100);
await clickButton('.sl-section-nav button', 'Race Condition Laboratory');
await wait(1300);
controlChecks.navigationStopsPlayback = await stepText() === 'STEP 01 OF 06';
await clickButton('.race-controls button', 'Reset');
await clickButton('.race-mode-buttons button', 'Without protection');
await evaluate('[...document.querySelectorAll(".race-mode-buttons button")].find(x=>x.innerText.includes("With mutex"))?.focus()');
await call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
await call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
controlChecks.keyboardSpaceActivatesMode = await evaluate('document.querySelector(".race-mode-copy strong")?.innerText === "With mutex"');
const focusDetails = await evaluate('(()=>{const e=document.activeElement;const s=getComputedStyle(e);return {tag:e.tagName,outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth}})()');
controlChecks.keyboardFocusVisible = focusDetails.outlineStyle !== 'none' && focusDetails.outlineWidth !== '0px';
await clickButton('.race-mode-buttons button', 'Without protection');
await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
controlChecks.reducedMotion = await evaluate('({matches:matchMedia("(prefers-reduced-motion: reduce)").matches,duration:getComputedStyle(document.querySelector(".race-worker")).transitionDuration})');
await evaluate('window.scrollTo(0,0)');
await wait(250);
await screenshot('mobile-initial-390x844', 390, 844, true);
await scrollTo('.race-queue');
await screenshot('mobile-queue-390x844', 390, 844, true);

await call('Network.setBlockedURLs', { urls: ['*canteen-dishes.png*'] });
await call('Network.setCacheDisabled', { cacheDisabled: true });
await call('Network.clearBrowserCache');
await call('Page.reload', { ignoreCache: true });
await wait(1300);
await clickButton('.sl-section-nav button', 'Race Condition Laboratory');
await wait(800);
await scrollTo('.race-queue');
await screenshot('food-image-fallback-390x844', 390, 844, true);
const evidence = {
  heading,
  initialButtons,
  imageRequests,
  failedImageRequests,
  brokenImages: await evaluate('[...document.images].filter(x=>!x.complete || !x.naturalWidth).map(x=>x.currentSrc)'),
  fallbackCount: await evaluate('document.querySelectorAll(".race-food.fallback").length'),
  pageHorizontalOverflow: await evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth'),
  mobileDocumentWidth: await evaluate('({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth})'),
  controls: controlChecks,
  runtimeErrors: logs,
};
await writeFile(new URL('./evidence.json', import.meta.url), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
page.close(); socket.close();
