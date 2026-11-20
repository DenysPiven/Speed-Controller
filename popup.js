const PRESETS = [100, 125, 150, 200, 250, 300, 400, 800, 1600];
const MIN_PCT = 7;
const MAX_PCT = 1600;

const $ = (id) => document.getElementById(id);
const speedInput = $('speed');
const toggle = $('toggle');
const presetsEl = $('presets');

let tabId = null;
let current = { enabled: true, speed: 1, scope: null, host: null };

function selectedScope() {
  return document.querySelector('input[name="scope"]:checked').value;
}

function toPct(speed) {
  return Math.round(speed * 100);
}

function render(state, { keepScope = false } = {}) {
  if (!state || state.error) return;
  current = state;
  document.body.classList.toggle('off', !state.enabled);
  toggle.setAttribute('aria-checked', String(state.enabled));
  toggle.querySelector('.toggle-label').textContent = state.enabled ? 'ON' : 'OFF';

  const pct = toPct(state.speed);
  if (document.activeElement !== speedInput) speedInput.value = String(pct);
  presetsEl.querySelectorAll('.preset').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.pct) === pct);
  });

  const domainRadio = document.querySelector('input[value="domain"]');
  domainRadio.disabled = !state.host;
  if (!keepScope && state.scope) {
    document.querySelector(`input[name="scope"][value="${state.scope}"]`).checked = true;
  }
}

async function send(msg) {
  return chrome.runtime.sendMessage({ ...msg, tabId });
}

async function setSpeedPct(pct) {
  const clamped = Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(pct)));
  let scope = selectedScope();
  if (scope === 'domain' && !current.host) scope = 'tab';
  render(await send({ type: 'setSpeed', scope, speed: clamped / 100 }), { keepScope: true });
}

function buildPresets() {
  for (const pct of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.dataset.pct = String(pct);
    b.textContent = `${pct}%`;
    b.addEventListener('click', () => setSpeedPct(pct));
    presetsEl.appendChild(b);
  }
}

function bindEvents() {
  document.querySelectorAll('.step').forEach((b) => {
    b.addEventListener('click', () => {
      const base = Number(speedInput.value) || toPct(current.speed);
      setSpeedPct(base + Number(b.dataset.delta));
    });
  });

  speedInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      speedInput.blur();
    }
  });
  speedInput.addEventListener('blur', () => {
    const val = parseFloat(speedInput.value.replace(',', '.'));
    if (Number.isFinite(val) && val > 0) setSpeedPct(val);
    else speedInput.value = String(toPct(current.speed));
  });
  speedInput.addEventListener('input', () => {
    speedInput.value = speedInput.value.replace(/[^\d.,]/g, '');
  });

  toggle.addEventListener('click', async () => {
    render(await send({ type: 'setEnabled', enabled: !current.enabled }), { keepScope: true });
  });

  $('reset').addEventListener('click', async () => {
    render(await send({ type: 'resetAll' }), { keepScope: true });
  });
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;
  buildPresets();
  bindEvents();
  if (tabId == null) return;
  render(await send({ type: 'getPopupState' }));
}

init();
