// Shared minimal store for Ippo projects (Dashboard + Future)
// No personal data in code. Settings/data live in browser localStorage.

export const Keys = {
  STORAGE_KEY: "ippoLogEntries_v2",
  NEXT_MEMO_KEY: "ippoNextMemo_v1",

  OD_SETTINGS_KEY: "ippoOneDriveSettings_v2",
  OD_CACHE_KEY: "ippoDataCache_v1",
  OD_QUEUE_KEY: "ippoSyncQueue_v1",
  OD_MIGRATION_KEY: "ippoMigrationDone_v1",
  OD_STATUS_KEY: "ippoSyncStatus_v1",

  DEFAULT_FILE_PATH: "/Apps/IppoDashboard/ippo_data.json",
};

export const Categories = [
  "仕事・企画",
  "家族・子ども",
  "健康・身体",
  "環境・暮らし",
  "学び・技術",
  "お金・投資",
  "趣味・遊び",
  "心・メンタル",
  "その他",
];

function safeParseJSON(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

export function readJSON(key, fallback=null) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  return safeParseJSON(raw, fallback);
}

export function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key) {
  localStorage.removeItem(key);
}

// ----- Cache (entries + memos) -----
export function loadCache() {
  const parsed = readJSON(Keys.OD_CACHE_KEY, null);
  if (!parsed || !Array.isArray(parsed.entries) || !Array.isArray(parsed.memos)) {
    return { schemaVersion: 1, entries: [], memos: [] };
  }
  // guard: schemaVersion missing is ok
  return {
    schemaVersion: parsed.schemaVersion ?? 1,
    entries: parsed.entries,
    memos: parsed.memos,
  };
}

export function saveCache(cache) {
  const normalized = {
    schemaVersion: cache?.schemaVersion ?? 1,
    entries: Array.isArray(cache?.entries) ? cache.entries : [],
    memos: Array.isArray(cache?.memos) ? cache.memos : [],
  };
  writeJSON(Keys.OD_CACHE_KEY, normalized);
  // Keep a tiny "there are pending changes" signal for other pages.
  enqueueChange();
}

export function enqueueChange() {
  const q = readJSON(Keys.OD_QUEUE_KEY, []);
  const queue = Array.isArray(q) ? q : [];
  queue.push({ ts: Date.now() });
  writeJSON(Keys.OD_QUEUE_KEY, queue);
}

export function clearQueue() {
  writeJSON(Keys.OD_QUEUE_KEY, []);
}

export function getPendingCount() {
  const q = readJSON(Keys.OD_QUEUE_KEY, []);
  return Array.isArray(q) ? q.length : 0;
}

export function addEntry({ dateISO, timeHHMM, text, category, meta={} }) {
  const cache = loadCache();
  const entry = {
    id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
    date: dateISO,
    time: timeHHMM,
    text: text,
    category: category || "その他",
    ...meta,
  };
  cache.entries.push(entry);
  saveCache(cache);
  return entry;
}

export function addMemo(text) {
  const cache = loadCache();
  const memo = {
    id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
    text,
    done: false,
    createdAt: Date.now(),
  };
  cache.memos.push(memo);
  saveCache(cache);
  return memo;
}

// ----- Settings -----
export function loadOneDriveSettings() {
  return readJSON(Keys.OD_SETTINGS_KEY, null);
}

export function saveOneDriveSettings(settings) {
  writeJSON(Keys.OD_SETTINGS_KEY, settings);
}

// ----- Diagnostics overlay -----
export function installErrorOverlay() {
  const existing = document.getElementById('errorOverlay');
  const box = existing || (() => {
    const d = document.createElement('div');
    d.id = 'errorOverlay';
    d.innerHTML = '<h3>画面が白い/反応しない時のヒント</h3><pre id="errorOverlayText"></pre><button class="btn-ghost" id="errorOverlayClose" type="button">閉じる</button>';
    document.body.appendChild(d);
    return d;
  })();

  const pre = box.querySelector('#errorOverlayText');
  const closeBtn = box.querySelector('#errorOverlayClose');
  closeBtn?.addEventListener('click', () => { box.style.display = 'none'; });

  function show(msg) {
    if (pre) pre.textContent = msg;
    box.style.display = 'block';
  }

  window.addEventListener('error', (e) => {
    const message = e?.message || 'Unknown error';
    const file = e?.filename ? ('\n' + e.filename + ':' + e.lineno) : '';
    show('[window.error]\n' + message + file);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e?.reason;
    const msg = (reason && (reason.stack || reason.message)) ? (reason.stack || reason.message) : String(reason);
    show('[unhandledrejection]\n' + msg);
  });
}
