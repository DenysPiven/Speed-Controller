const PRESETS = [25, 50, 75, 90, 100, 110, 125, 150, 175, 200, 250, 1600];
const MIN_PCT = 7;
const MAX_PCT = 1600;

const $ = (id) => document.getElementById(id);
const speedInput = $('speed');
const toggle = $('toggle');
const presetsEl = $('presets');

let tabId = null;
let current = { enabled: true, speed: 1, scope: null, host: null };

const ICON_PLAY = '<svg viewBox="0 0 10 12"><path d="M0 0l10 6-10 6z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 10 12"><path d="M0 0h3.5v12H0zM6.5 0H10v12H6.5z"/></svg>';

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

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '';
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Runs inside each frame of the page; returns the most relevant media element info.
function probeMedia() {
  const list = [];
  const walk = (root) => {
    root.querySelectorAll('video, audio').forEach((m) => list.push(m));
    root.querySelectorAll('*').forEach((el) => el.shadowRoot && walk(el.shadowRoot));
  };
  walk(document);
  const candidates = list
    .filter((m) => m.readyState > 0 || m.currentTime > 0)
    .map((m) => ({
      host: location.hostname,
      paused: m.paused,
      currentTime: m.currentTime,
      duration: Number.isFinite(m.duration) ? m.duration : 0,
    }));
  if (!candidates.length) return null;
  candidates.sort((a, b) => (a.paused - b.paused) || (b.duration - a.duration));
  return candidates[0];
}

async function refreshStatus() {
  let best = null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: probeMedia,
    });
    const found = results.map((r) => r.result).filter(Boolean);
    found.sort((a, b) => (a.paused - b.paused) || (b.duration - a.duration));
    best = found[0] || null;
  } catch {
    best = null;
  }

  $('now').hidden = !best;
  if (!best) return;
  $('host').textContent = best.host || current.host || '—';
  $('state-icon').innerHTML = best.paused ? ICON_PAUSE : ICON_PLAY;
  $('state').textContent = best.paused ? 'Paused' : 'Playing';
  $('time').textContent = formatTime(best.currentTime);
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
  refreshStatus();
  setInterval(refreshStatus, 1000);
}

init();
