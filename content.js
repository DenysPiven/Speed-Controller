// Applies the playback speed to every <video>/<audio> in this frame.
// Intentionally registers NO keyboard listeners.
(() => {
  if (window.__svscLoaded) return;
  window.__svscLoaded = true;

  let enabled = true;
  let speed = null; // null = no override, leave the page alone
  const touched = new WeakSet();
  const EPS = 0.001;

  function collectMedia(root = document, out = []) {
    root.querySelectorAll('video, audio').forEach((m) => out.push(m));
    root.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) collectMedia(el.shadowRoot, out);
    });
    return out;
  }

  function apply(media) {
    if (!(media instanceof HTMLMediaElement)) return;
    if (!enabled || speed == null) {
      if (touched.has(media)) {
        touched.delete(media);
        if (Math.abs(media.playbackRate - 1) > EPS) media.playbackRate = 1;
      }
      return;
    }
    if (Math.abs(media.playbackRate - speed) > EPS) {
      try {
        media.playbackRate = speed;
      } catch {
        return;
      }
    }
    touched.add(media);
  }

  function applyAll() {
    collectMedia().forEach(apply);
  }

  // Media events don't bubble, but they can be caught in the capture phase.
  ['loadstart', 'loadedmetadata', 'play', 'playing'].forEach((type) => {
    document.addEventListener(type, (e) => apply(e.target), true);
  });

  // Sites (e.g. players that reset the rate on load) — re-apply our speed.
  document.addEventListener(
    'ratechange',
    (e) => {
      const m = e.target;
      if (!(m instanceof HTMLMediaElement) || !enabled || speed == null) return;
      if (Math.abs(m.playbackRate - speed) > EPS) setTimeout(() => apply(m), 0);
    },
    true
  );

  const observer = new MutationObserver((mutations) => {
    if (!enabled || speed == null) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node instanceof HTMLMediaElement) apply(node);
        else if (node.querySelector?.('video, audio')) node.querySelectorAll('video, audio').forEach(apply);
      }
    }
  });
  observer.observe(document.documentElement || document, { childList: true, subtree: true });

  function update(state) {
    if (!state) return;
    enabled = !!state.enabled;
    speed = state.speed ?? null;
    applyAll();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'applySpeed') update(msg);
  });

  chrome.runtime.sendMessage({ type: 'getSpeed' }).then(update).catch(() => {});
  document.addEventListener('DOMContentLoaded', applyAll, { once: true });
})();
