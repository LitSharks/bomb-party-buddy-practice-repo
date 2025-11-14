// background/handler.js
// Proxies API requests from content scripts (avoids page CORS)
// Needs host_permissions in manifest for https://extensions.litshark.ca/*

const PRESENCE_URL = "https://extensions.litshark.ca/api/presence.php";
const sessionRegistry = new Map();

function ok(obj) { return { ok: true, ...obj }; }
function err(msg) { return { error: String(msg || 'unknown_error') }; }

// Small helper to do fetch with sane defaults
async function doFetch(url, init) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0,256)}`);
  }
  return text;
}

async function postPresence(body) {
  const payload = (typeof body === 'string') ? body : JSON.stringify(body || {});
  await doFetch(PRESENCE_URL, {
    method: "POST",
    mode: "cors",
    cache: "no-store",
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload
  });
}

async function handleTabLeave(tabId) {
  if (!sessionRegistry.has(tabId)) return;
  const info = sessionRegistry.get(tabId);
  sessionRegistry.delete(tabId);
  if (!info?.sessionId || !info?.deviceId) return;
  try {
    await postPresence({
      action: "leave",
      session_id: info.sessionId,
      device_id: info.deviceId
    });
  } catch (err) {
    console.warn('[BombPartyShark] Failed to report tab leave', err);
  }
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
      if (msg?.type === "presenceRegisterSession") {
        const tabId = sender?.tab?.id;
        if (tabId != null && msg.sessionId && msg.deviceId) {
          sessionRegistry.set(tabId, {
            sessionId: String(msg.sessionId),
            deviceId: String(msg.deviceId)
          });
        }
        sendResponse(ok({ registered: true }));
        return;
      }
      if (msg?.type === "presenceReleaseSession") {
        const tabId = sender?.tab?.id;
        if (tabId != null) {
          sessionRegistry.delete(tabId);
        }
        sendResponse(ok({ released: true }));
        return;
      }
      if (msg?.type === "presenceLeave") {
        if (msg.sessionId && msg.deviceId) {
          await postPresence({
            action: "leave",
            session_id: String(msg.sessionId),
            device_id: String(msg.deviceId)
          });
        }
        const tabId = sender?.tab?.id;
        if (tabId != null) sessionRegistry.delete(tabId);
        sendResponse(ok({ left: true }));
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

chrome.tabs.onRemoved.addListener((tabId) => {
  handleTabLeave(tabId).catch(() => {});
});
