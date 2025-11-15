// background/handler.js
// Proxies API requests from content scripts (avoids page CORS)
// Needs host_permissions in manifest for https://extensions.litshark.ca/*

function ok(obj) { return { ok: true, ...obj }; }
function err(msg) { return { error: String(msg || 'unknown_error') }; }

const DEVICE_ID_KEY = "litsharkDeviceId";
const PRESENCE_URL = "https://extensions.litshark.ca/api/presence.php";
const activeSessions = new Map();

function safeRandomUuid() {
  try {
    if (typeof crypto?.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (_) { /* ignore */ }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(-4);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

function storageLocalGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (items) => {
        if (chrome.runtime.lastError) {
          console.warn("[BombPartyShark] Failed to read local storage", chrome.runtime.lastError);
          resolve({});
          return;
        }
        resolve(items || {});
      });
    } catch (err) {
      console.warn("[BombPartyShark] Failed to access local storage", err);
      resolve({});
    }
  });
}

function storageLocalSet(items) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          console.warn("[BombPartyShark] Failed to write local storage", chrome.runtime.lastError);
          resolve(false);
          return;
        }
        resolve(true);
      });
    } catch (err) {
      console.warn("[BombPartyShark] Failed to update local storage", err);
      resolve(false);
    }
  });
}

async function ensureDeviceId() {
  const stored = await storageLocalGet([DEVICE_ID_KEY]);
  let id = stored?.[DEVICE_ID_KEY];
  if (typeof id === "string" && id) return id;
  id = safeRandomUuid();
  await storageLocalSet({ [DEVICE_ID_KEY]: id });
  return id;
}

// Small helper to do fetch with sane defaults
async function doFetch(url, init) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0,256)}`);
  }
  return text;
}

async function postPresence(payload) {
  const body = (typeof payload === "string") ? payload : JSON.stringify(payload || {});
  return doFetch(PRESENCE_URL, {
    method: "POST",
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
    },
    body
  });
}

if (chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    ensureDeviceId().catch((err) => {
      console.warn("[BombPartyShark] Failed to ensure device id on install", err);
    });
  });
}

if (chrome.runtime?.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    ensureDeviceId().catch((err) => {
      console.warn("[BombPartyShark] Failed to ensure device id on startup", err);
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "extFetch") {
        const text = await doFetch(msg.url, { cache: "no-store", credentials: "omit" });
        sendResponse(ok({ text }));
        return;
      }
      if (msg?.type === "extPost") {
        const body = (typeof msg.body === "string") ? msg.body : JSON.stringify(msg.body || {});
        const text = await doFetch(msg.url, {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          credentials: "omit",
          headers: {
            "Content-Type": "application/json",
          },
          body
        });
        sendResponse(ok({ text }));
        return;
      }
      if (msg?.type === "presenceRegister") {
        const tabId = sender?.tab?.id;
        const sessionId = msg.sessionId ? String(msg.sessionId) : null;
        const deviceId = msg.deviceId ? String(msg.deviceId) : null;
        if (tabId == null || !sessionId || !deviceId) {
          sendResponse(err("missing_session_info"));
          return;
        }
        activeSessions.set(tabId, { sessionId, deviceId });
        sendResponse(ok({ registered: true }));
        return;
      }
      if (msg?.type === "presenceUnregister") {
        const tabId = sender?.tab?.id;
        if (tabId != null) {
          const info = activeSessions.get(tabId);
          if (!msg.sessionId || !info || info.sessionId === String(msg.sessionId)) {
            activeSessions.delete(tabId);
          }
        }
        sendResponse(ok({ cleared: true }));
        return;
      }
      if (msg?.type === "presenceSend") {
        const payload = (msg.payload && typeof msg.payload === "object") ? msg.payload : null;
        if (!payload) {
          sendResponse(err("invalid_payload"));
          return;
        }
        await postPresence(payload);
        sendResponse(ok({}));
        return;
      }
      if (msg?.type === "presenceGetDeviceId") {
        const deviceId = await ensureDeviceId();
        sendResponse(ok({ deviceId }));
        return;
      }
      sendResponse(err("unknown_message_type"));
    } catch (e) {
      sendResponse(err(e && e.message ? e.message : e));
    }
  })();
  // Keep the message channel open for async response
  return true;
});

if (chrome.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    const info = activeSessions.get(tabId);
    if (!info) return;
    activeSessions.delete(tabId);
    if (!info.sessionId || !info.deviceId) return;
    postPresence({ action: "leave", session_id: info.sessionId, device_id: info.deviceId })
      .catch((err) => {
        console.warn("[BombPartyShark] Failed to send presence leave on tab removal", err);
      });
  });
}
