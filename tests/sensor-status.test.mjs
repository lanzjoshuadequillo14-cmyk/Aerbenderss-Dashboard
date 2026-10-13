import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../sensor-status.js', import.meta.url), 'utf8');
const statusTools = await import('data:text/javascript,' + encodeURIComponent(source));
const { getFirmwareStatus, describeFirmwareStatus, statusBadge } = statusTools;

test('firmware categories take precedence over contradictory readings', () => {
  const record = { co2: 1325, co2_Status: 'normal', VOCidx: 102, vocIdx_Status: 'Baseline' };
  assert.equal(getFirmwareStatus(record, 'co2').label, 'Harmless');
  assert.equal(getFirmwareStatus(record, 'co2').tone, 'normal');
  assert.equal(getFirmwareStatus(record, 'voc').label, 'Baseline');
  assert.equal(getFirmwareStatus(record, 'voc').color, '#10b981');
});

test('CO2 and VOC colors match the firmware categories', () => {
  assert.equal(describeFirmwareStatus('co2', 'elevated').color, '#f59e0b');
  assert.equal(describeFirmwareStatus('co2', 'unacceptable').color, '#ef4444');
  assert.equal(describeFirmwareStatus('voc', 'Deterioration').color, '#f59e0b');
  assert.equal(describeFirmwareStatus('voc', 'Improvement').color, '#10b981');
});

test('missing individual statuses are never inferred from readings or overall status', () => {
  const record = { co2: 5000, VOCidx: 500, airQualityStatus: 'GOOD', pm: { pm2p5: 100 } };
  for (const metric of ['co2', 'voc', 'pm25', 'pm25avg']) {
    const status = getFirmwareStatus(record, metric, 'Not recorded');
    assert.equal(status.label, 'Not recorded');
    assert.equal(status.raw, null);
    assert.equal(status.tone, null);
  }
  for (const invalid of [undefined, null, '', ' ', 0, false, {}]) {
    assert.equal(getFirmwareStatus({ co2_Status: invalid }, 'co2').tone, null);
  }
});

test('unknown firmware statuses stay visible without an invented classification', () => {
  const status = getFirmwareStatus({ co2_Status: 'Sensor warming up' }, 'co2');
  assert.equal(status.label, 'Sensor warming up');
  assert.equal(status.tone, null);
  assert.equal(status.color, '#94a3b8');
});

test('instantaneous PM status cannot classify the 24-hour average', () => {
  const record = { pm2p5_Status: 'Above WHO 24-hour AQG', pm25Avg24h: 20 };
  assert.equal(getFirmwareStatus(record, 'pm25avg').raw, null);
  record.pm2p5_24h_Status = 'Within WHO 24-hour AQG';
  assert.equal(getFirmwareStatus(record, 'pm25avg').tone, 'normal');
  assert.equal(getFirmwareStatus({ pm: { pm2p5_24h_Status: 'Above WHO 24-hour AQG' } }, 'pm25avg').tone, 'critical');
});

test('temperature and humidity have no status interpretation', () => {
  const record = { temp: 55, humidity: 100, temp_Status: 'Hot', humidity_Status: 'Humid' };
  assert.equal(getFirmwareStatus(record, 'temp').raw, null);
  assert.equal(getFirmwareStatus(record, 'humidity').raw, null);
});

test('untrusted status labels are escaped in HTML badges', () => {
  const status = describeFirmwareStatus('co2', '<img src=x onerror="alert(1)">');
  assert.doesNotMatch(statusBadge(status), /<img/);
  assert.match(statusBadge(status), /&lt;img/);
  assert.match(statusBadge(status), /unavailable/);
});

function loadPage(htmlName, scriptName) {
  const elements = new Map();
  const listeners = new Map();
  class Element {
    constructor(id = '') {
      this.id = id;
      this.style = {};
      this.innerHTML = '';
      this.innerText = '';
      this.value = '';
      this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    }
    addEventListener() {}
    querySelectorAll() { return []; }
    appendChild(element) { if (element.id) elements.set(element.id, element); }
  }
  const html = readFileSync(new URL('../' + htmlName, import.meta.url), 'utf8');
  for (const match of html.matchAll(/id="([^"]+)"/g)) {
    elements.set(match[1], new Element(match[1]));
  }
  const context = vm.createContext({
    ...statusTools,
    document: {
      getElementById: id => elements.get(id) ?? null,
      createElement: () => new Element(),
      addEventListener() {}, querySelectorAll: () => [], head: new Element(), body: new Element()
    },
    console,
    window: { addEventListener() {}, location: {}, innerWidth: 1024 },
    navigator: {}, localStorage: { getItem() { return null; } },
    db: {}, auth: {}, BASE_PATH: '/Aerocubes/test',
    ref: (db, path) => path,
    onValue: (path, callback) => listeners.set(path, callback),
    get: async () => ({ exists: () => false }),
    update() {}, remove: async () => {}, signOut: async () => {}, onAuthStateChanged() {},
    setInterval() {}, setTimeout() {}
  });
  const script = readFileSync(new URL('../' + scriptName, import.meta.url), 'utf8')
    .replace(/^import[^\r\n]*;\r?\n/gm, '');
  vm.runInContext(script, context, { filename: scriptName });
  return { elements, listeners, run: code => vm.runInContext(code, context) };
}

test('dashboard badges, insights, recommendations, and alerts follow firmware updates', async () => {
  const page = loadPage('index.html', 'script.js');
  await new Promise(resolve => setImmediate(resolve));
  page.run('const alerts=[];sendNotification=(...args)=>alerts.push(args);');
  const telemetry = page.listeners.get('/Aerocubes/test/telemetry');
  telemetry({ val: () => ({ co2: 5000, co2_Status: 'normal', VOCidx: 300, vocIdx_Status: 'Baseline', temp: 55, humidity: 100, pm: { pm2p5: 26 } }) });
  assert.equal(page.elements.get('status-co2').innerText, 'Harmless');
  assert.equal(page.elements.get('status-voc').innerText, 'Baseline');
  assert.equal(page.elements.get('status-pm25-24h').innerText, 'Not reported');
  assert.match(page.elements.get('val-pm25').innerHTML, /^26 /);
  assert.match(page.elements.get('insight-text').innerHTML, /Harmless/);
  assert.doesNotMatch(page.elements.get('insight-text').innerHTML, /temperature|humidity|headache|healthy|unacceptable/i);
  assert.doesNotMatch(page.elements.get('recommendations-content').innerHTML, /temperature|humidity|promptly|above WHO/i);
  assert.equal(page.run('alerts.some(item=>item[3]==="critical")'), false);
  telemetry({ val: () => ({ co2: 500, co2_Status: 'unacceptable', VOCidx: 50, vocIdx_Status: 'Deterioration' }) });
  assert.equal(page.elements.get('status-co2').innerText, 'Unacceptable');
  assert.equal(page.elements.get('status-voc').innerText, 'Deterioration');
  assert.equal(page.elements.get('status-voc').className, 'card-status attention');
  assert.doesNotMatch(page.elements.get('recommendations-content').innerHTML, /promptly/);
  assert.equal(page.run('alerts.at(-1)[3]'), 'attention');
  telemetry({ val: () => ({ co2: 500, VOCidx: 50 }) });
  assert.equal(page.elements.get('status-co2').innerText, 'Not reported');
  assert.equal(page.elements.get('status-voc').innerText, 'Not reported');
  assert.doesNotMatch(page.elements.get('recommendations-content').innerHTML, /Waiting for a status/);
});

test('history does not invent individual statuses for legacy records', async () => {
  const page = loadPage('History.html', 'history.js');
  await new Promise(resolve => setImmediate(resolve));
  page.run('allHistoryData=[{timestamp:Date.now(),co2:5000,VOCidx:500,airQualityStatus:"GOOD",pm:{pm2p5:20}}];renderTable();');
  let html = page.elements.get('history-table-container').innerHTML;
  assert.equal((html.match(/Not recorded/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Harmless|Unacceptable|Deterioration/);
  page.run('allHistoryData=[{timestamp:Date.now(),co2:5000,co2_Status:"normal",VOCidx:20,vocIdx_Status:"Deterioration"}];renderTable();');
  html = page.elements.get('history-table-container').innerHTML;
  assert.match(html, /Harmless/);
  assert.match(html, /Deterioration/);
  assert.equal(page.run('formatNumber(null)'), '--');
});
