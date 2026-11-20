// Speed resolution order for a tab: tab override > domain override > global > none.
// "none" means the extension does not touch the page's own playback rate.

const BADGE_COLOR = '#1f7a35';

async function getState() {
  const local = await chrome.storage.local.get({
    enabled: true,
    globalSpeed: null,
    domainSpeeds: {},
  });
  const session = await chrome.storage.session.get({ tabSpeeds: {} });
  return { ...local, tabSpeeds: session.tabSpeeds };
}

function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.hostname;
    if (u.protocol === 'file:') return 'file';
    return null;
  } catch {
    return null;
  }
}

function resolve(state, tabId, host) {
  const tabSpeed = state.tabSpeeds[tabId];
  if (tabSpeed != null) return { speed: tabSpeed, scope: 'tab' };
  if (host && state.domainSpeeds[host] != null) {
    return { speed: state.domainSpeeds[host], scope: 'domain' };
  }
  if (state.globalSpeed != null) return { speed: state.globalSpeed, scope: 'all' };
  return { speed: null, scope: null };
}

function clampSpeed(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(16, Math.max(0.0625, Math.round(n * 100) / 100));
}

async function updateTab(tab, state) {
  if (tab.id == null || tab.id < 0) return;
  const { speed } = resolve(state, tab.id, hostOf(tab.url));
  const showBadge = state.enabled && speed != null && speed !== 1;
  chrome.action.setBadgeText({ tabId: tab.id, text: showBadge ? speed.toFixed(2) : '' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: BADGE_COLOR }).catch(() => {});
  chrome.action.setBadgeTextColor?.({ tabId: tab.id, color: '#ffffff' })?.catch?.(() => {});
  chrome.tabs
    .sendMessage(tab.id, { type: 'applySpeed', enabled: state.enabled, speed })
    .catch(() => {});
}

async function broadcast() {
  const state = await getState();
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => updateTab(tab, state)));
}

async function setSpeed(tabId, scope, rawSpeed) {
  const speed = clampSpeed(rawSpeed);
  const state = await getState();
  const tab = await chrome.tabs.get(tabId);
  const host = hostOf(tab.url);
  const tabSpeeds = { ...state.tabSpeeds };
  const domainSpeeds = { ...state.domainSpeeds };
  let globalSpeed = state.globalSpeed;

  if (scope === 'tab') {
    tabSpeeds[tabId] = speed;
  } else if (scope === 'domain' && host) {
    domainSpeeds[host] = speed;
    delete tabSpeeds[tabId];
  } else {
    globalSpeed = speed;
    delete tabSpeeds[tabId];
    if (host) delete domainSpeeds[host];
  }

  await chrome.storage.local.set({ globalSpeed, domainSpeeds });
  await chrome.storage.session.set({ tabSpeeds });
  await broadcast();
}

async function popupState(tabId) {
  const state = await getState();
  const tab = await chrome.tabs.get(tabId);
  const host = hostOf(tab.url);
  const { speed, scope } = resolve(state, tabId, host);
  return { enabled: state.enabled, speed: speed ?? 1, scope, host };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case 'getSpeed': {
        const state = await getState();
        const tab = sender.tab;
        if (!tab) return { enabled: false, speed: null };
        const { speed } = resolve(state, tab.id, hostOf(tab.url));
        return { enabled: state.enabled, speed };
      }
      case 'getPopupState':
        return popupState(msg.tabId);
      case 'setSpeed':
        await setSpeed(msg.tabId, msg.scope, msg.speed);
        return popupState(msg.tabId);
      case 'setEnabled':
        await chrome.storage.local.set({ enabled: !!msg.enabled });
        await broadcast();
        return popupState(msg.tabId);
      case 'resetAll':
        await chrome.storage.local.set({ globalSpeed: null, domainSpeeds: {} });
        await chrome.storage.session.set({ tabSpeeds: {} });
        await broadcast();
        return popupState(msg.tabId);
      default:
        return null;
    }
  })().then(sendResponse, (err) => sendResponse({ error: String(err) }));
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status) updateTab(tab, await getState());
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { tabSpeeds } = await chrome.storage.session.get({ tabSpeeds: {} });
  if (tabSpeeds[tabId] != null) {
    delete tabSpeeds[tabId];
    await chrome.storage.session.set({ tabSpeeds });
  }
});

chrome.runtime.onStartup.addListener(broadcast);
chrome.runtime.onInstalled.addListener(broadcast);
