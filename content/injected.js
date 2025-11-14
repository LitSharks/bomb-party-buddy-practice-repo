// injected.js

function normalizePlayerId(raw) {
  if (raw == null) return null;
  if (typeof raw === "string" && raw) return raw;
  if (typeof raw === "number") return String(raw);
  if (typeof raw === "object") {
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        const normalized = normalizePlayerId(entry);
        if (normalized) return normalized;
      }
      return null;
    }
    const direct = raw.peerId ?? raw.playerId ?? raw.id ?? raw.peerID ?? raw.peer;
    if (direct != null) return normalizePlayerId(direct);
    if (raw.player != null) {
      const nested = normalizePlayerId(raw.player);
      if (nested) return nested;
    }
  }
  return null;
}

let cachedSelfId = null;
function markSelfId(candidate) {
  const normalized = normalizePlayerId(candidate);
  if (normalized) cachedSelfId = normalized;
}

function getSelfId() {
  if (cachedSelfId) return cachedSelfId;
  if (typeof selfPeerId !== "undefined") markSelfId(selfPeerId);
  if (typeof window !== "undefined") {
    if (typeof window.selfPeerId !== "undefined") markSelfId(window.selfPeerId);
    if (typeof window.selfPlayerId !== "undefined") markSelfId(window.selfPlayerId);
    if (window.selfPlayer) markSelfId(window.selfPlayer);
    if (window.game) markSelfId(window.game.selfPeerId ?? window.game.playerId ?? window.game.player);
    if (window.gameClient) markSelfId(window.gameClient.selfPeerId ?? window.gameClient.playerId ?? window.gameClient.player);
    if (window.room) markSelfId(window.room.selfPeerId ?? window.room.selfPlayerId ?? window.room.self);
  }
  return cachedSelfId;
}

function isSelf(candidate) {
  const mine = getSelfId();
  if (!mine) return false;
  const other = normalizePlayerId(candidate);
  if (!other) return false;
  return mine === other;
}

function coalescePlayerId(...candidates) {
  for (const candidate of candidates) {
    const normalized = normalizePlayerId(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function normalizeRoomCodeForMessage(value) {
  if (value == null) return null;
  const trimmed = value.toString().trim();
  if (!trimmed) return null;
  const alnum = trimmed.replace(/[^0-9a-z]/gi, "");
  if (!alnum) return null;
  if (alnum.length < 3 || alnum.length > 6) return null;
  const upper = alnum.toUpperCase();
  if (upper === "GAMES" || upper === "BOMBPARTY") return null;
  return upper;
}

function gatherRoomCodeCandidates() {
  const candidates = [];
  const push = (source, value) => {
    if (value == null) return;
    const str = typeof value === "string" ? value : (value === null ? "" : String(value));
    const trimmed = str.trim();
    if (!trimmed) return;
    candidates.push({ source, value: trimmed });
  };
  try { push("window.room.code", window?.room?.code); } catch (_) { /* ignore */ }
  try { push("window.room.roomCode", window?.room?.roomCode); } catch (_) { /* ignore */ }
  try { push("window.room.match.code", window?.room?.match?.code); } catch (_) { /* ignore */ }
  try { push("window.game.roomCode", window?.game?.roomCode); } catch (_) { /* ignore */ }
  try { push("window.gameClient.roomCode", window?.gameClient?.roomCode); } catch (_) { /* ignore */ }
  try { push("window.gameClient.state.roomCode", window?.gameClient?.state?.roomCode); } catch (_) { /* ignore */ }
  try { push("location.search.room", new URLSearchParams(window.location.search || "").get("room")); } catch (_) { /* ignore */ }
  try {
    const segments = (window.location.pathname || "").split("/").filter(Boolean);
    segments.forEach((segment, idx) => push(`location.path[${idx}]`, segment));
  } catch (_) { /* ignore */ }
  try { push("location.hash", (window.location.hash || "").replace(/^#/, "")); } catch (_) { /* ignore */ }
  try {
    const host = window.location.hostname || "";
    if (host.includes(".")) {
      push("location.host-prefix", host.split(".")[0]);
    }
  } catch (_) { /* ignore */ }
  try {
    if (document.referrer) {
      const ref = new URL(document.referrer);
      const refSegments = ref.pathname.split("/").filter(Boolean);
      refSegments.forEach((segment, idx) => push(`referrer.path[${idx}]`, segment));
      push("referrer.search.room", new URLSearchParams(ref.search || "").get("room"));
    }
  } catch (_) { /* ignore */ }
  try {
    if (window.top && window.top !== window) {
      try {
        const topPath = window.top.location?.pathname || "";
        topPath.split("/").filter(Boolean).forEach((segment, idx) => push(`top.path[${idx}]`, segment));
      } catch (_) { /* ignore */ }
      try {
        push("top.search.room", new URLSearchParams(window.top.location?.search || "").get("room"));
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }
  try {
    const attrEl = document.querySelector("[data-room-code]");
    if (attrEl) {
      push("dom[data-room-code]", attrEl.getAttribute("data-room-code") || attrEl.textContent || "");
    }
  } catch (_) { /* ignore */ }
  try {
    const label = document.querySelector(".roomCode, .room-name, .roomName");
    if (label) push("dom.roomCode", label.textContent || "");
  } catch (_) { /* ignore */ }
  return candidates.slice(0, 24);
}

function pickBestRoomCode(candidates) {
  for (const entry of candidates) {
    const normalized = normalizeRoomCodeForMessage(entry.value);
    if (normalized) return normalized;
  }
  return null;
}

function gatherSelfCandidates() {
  const out = [];
  const seen = new Set();
  const push = (source, value) => {
    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    out.push({ source, value });
  };

  const selfId = getSelfId();
  const peerHints = new Set();
  if (selfId) peerHints.add(selfId);
  try {
    if (typeof window?.selfPeerId !== "undefined") {
      const normalized = normalizePlayerId(window.selfPeerId);
      if (normalized) peerHints.add(normalized);
    }
    if (typeof window?.selfPlayerId !== "undefined") {
      const normalized = normalizePlayerId(window.selfPlayerId);
      if (normalized) peerHints.add(normalized);
    }
  } catch (_) { /* ignore */ }

  try { push("window.room.selfPlayer", window?.room?.selfPlayer); } catch (_) { /* ignore */ }
  try { push("window.room.self", window?.room?.self); } catch (_) { /* ignore */ }
  try { push("window.selfPlayer", window?.selfPlayer); } catch (_) { /* ignore */ }
  try { push("window.game.self", window?.game?.self); } catch (_) { /* ignore */ }
  try { push("window.game.player", window?.game?.player); } catch (_) { /* ignore */ }
  try { push("window.gameClient.self", window?.gameClient?.self); } catch (_) { /* ignore */ }
  try { push("window.gameClient.player", window?.gameClient?.player); } catch (_) { /* ignore */ }

  const collectFromMap = (source, collection) => {
    if (!collection) return;
    const values = Array.isArray(collection) ? collection : Object.values(collection);
    values.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      if (!peerHints.size) {
        push(source, entry);
        return;
      }
      const pid = normalizePlayerId(entry.peerId || entry.playerId || entry.id || entry.peer || entry.peerID);
      if (pid && peerHints.has(pid)) {
        push(source, entry);
      }
    });
  };

  try { collectFromMap("window.room.players", window?.room?.players); } catch (_) { /* ignore */ }
  try { collectFromMap("window.gameClient.players", window?.gameClient?.players); } catch (_) { /* ignore */ }
  try { collectFromMap("window.game.players", window?.game?.players); } catch (_) { /* ignore */ }

  return out;
}

function attemptString(target, source, value, bucket) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (bucket && bucket.length < 10) bucket.push({ source: `${target}.${source}`, value: trimmed });
  return trimmed;
}

function pickAuthLabel(candidate, source, bucket) {
  if (!candidate || typeof candidate !== "object") return "";
  const attempt = (key, value) => attemptString(source, key, value, bucket);
  const direct = attempt("auth.text", candidate.auth?.text);
  if (direct) return direct;
  const label = attempt("auth.label", candidate.auth?.label);
  if (label) return label;
  const display = attempt("auth.display", candidate.auth?.display);
  if (display) return display;
  const authText = attempt("authText", candidate.authText);
  if (authText) return authText;
  const authBadge = attempt("authBadge", candidate.authBadge);
  if (authBadge) return authBadge;
  const badge = attempt("badge", candidate.badge);
  if (badge) return badge;
  const badgeText = attempt("badgeText", candidate.badgeText);
  if (badgeText) return badgeText;
  const linkedLabel = attempt("linkedAccountLabel", candidate.linkedAccountLabel);
  if (linkedLabel) return linkedLabel;
  const accountLabel = attempt("accountLabel", candidate.accountLabel);
  if (accountLabel) return accountLabel;
  if (candidate.auth && typeof candidate.auth === "object") {
    const provider = attemptString(source, "auth.provider", candidate.auth.provider || candidate.auth.platform || candidate.auth.service, bucket);
    const name = attemptString(source, "auth.name", candidate.auth.name || candidate.auth.username || candidate.auth.identity, bucket);
    if (provider && name) return `${name} on ${provider}`;
  }
  if (candidate.discord && typeof candidate.discord === "object") {
    const discDisplay = attempt("discord.displayName", candidate.discord.displayName);
    if (discDisplay) return discDisplay;
    const discUser = attempt("discord.username", candidate.discord.username);
    if (discUser) {
      const onDiscord = `${discUser} on Discord`;
      if (bucket && bucket.length < 10) bucket.push({ source: `${source}.discord`, value: onDiscord });
      return onDiscord;
    }
  }
  if (candidate.twitch && typeof candidate.twitch === "object") {
    const twitchDisplay = attempt("twitch.displayName", candidate.twitch.displayName || candidate.twitch.username);
    if (twitchDisplay) {
      const onTwitch = `${twitchDisplay} on Twitch`;
      if (bucket && bucket.length < 10) bucket.push({ source: `${source}.twitch`, value: onTwitch });
      return onTwitch;
    }
  }
  return "";
}

function pickUsername(candidate, source, bucket) {
  if (!candidate || typeof candidate !== "object") return "";
  const attempt = (key, value) => attemptString(source, key, value, bucket);
  const nickname = attempt("nickname", candidate.nickname);
  if (nickname) return nickname;
  const display = attempt("displayName", candidate.displayName || candidate.display);
  if (display) return display;
  const username = attempt("username", candidate.username);
  if (username) return username;
  const name = attempt("name", candidate.name);
  if (name) return name;
  const title = attempt("title", candidate.title);
  if (title) return title;
  const playerName = attempt("playerName", candidate.playerName);
  if (playerName) return playerName;
  const label = attempt("label", candidate.label);
  if (label) return label;
  return "";
}

function gatherSelfInfoForContext() {
  const candidates = gatherSelfCandidates();
  const usernameSources = [];
  const authSources = [];
  let username = "";
  let authLabel = "";
  let peerId = null;

  candidates.forEach(({ source, value }) => {
    if (!peerId) {
      const pid = normalizePlayerId(value?.peerId || value?.playerId || value?.id || value?.peer || value?.peerID);
      if (pid) peerId = pid;
    }
    if (!username) {
      const picked = pickUsername(value, source, usernameSources);
      if (picked) username = picked;
    }
    if (!authLabel) {
      const auth = pickAuthLabel(value, source, authSources);
      if (auth) authLabel = auth;
    }
  });

  return {
    username,
    authLabel,
    peerId,
    usernameSources,
    authSources
  };
}

function gatherLanguageForContext() {
  const attempts = [];
  const push = (value) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    attempts.push(trimmed);
  };
  try { push(window?.room?.dictionary?.name); } catch (_) { /* ignore */ }
  try { push(window?.game?.dictionary?.name); } catch (_) { /* ignore */ }
  try { push(window?.gameClient?.dictionary?.name); } catch (_) { /* ignore */ }
  try { push(window?.gameClient?.state?.dictionary?.name); } catch (_) { /* ignore */ }
  return attempts.length ? attempts[0] : null;
}

function emitPresenceContext(reason) {
  try {
    const roomCandidates = gatherRoomCodeCandidates();
    const roomCode = pickBestRoomCode(roomCandidates);
    const selfInfo = gatherSelfInfoForContext();
    const lang = gatherLanguageForContext();
    const payload = {
      type: "presenceContext",
      reason,
      timestamp: Date.now(),
      roomCode,
      roomCodeCandidates: roomCandidates,
      username: selfInfo.username || null,
      usernameSources: selfInfo.usernameSources,
      authLabel: selfInfo.authLabel || null,
      authSources: selfInfo.authSources,
      selfPeerId: selfInfo.peerId || null,
      lang: lang || null
    };
    window.postMessage(payload, "*");
  } catch (err) {
    console.warn("[BombPartyShark] Failed to emit presence context", err);
  }
}

let lastWordPlayerId = null;
let actual_word = "";

socket.on("setup", (data) => {
  if (!data?.milestone || data.milestone.name !== "round") return;
  markSelfId(typeof selfPeerId !== "undefined" ? selfPeerId : null);
  const playerId = coalescePlayerId(
    data.milestone.currentPlayerPeerId,
    data.milestone.currentPlayerId
  );
  const mine = isSelf(playerId);
  if (mine) markSelfId(playerId);
  const payload = {
    type: "setup",
    myTurn: mine,
    syllable: data.milestone.syllable,
    language: data.milestone.dictionaryManifest?.name,
  };
  window.postMessage(payload, "*");
  emitPresenceContext("socket.setup");
});

socket.on("setMilestone", (newMilestone) => {
  if (!newMilestone || newMilestone.name !== "round") return;
  const playerId = coalescePlayerId(
    newMilestone.currentPlayerPeerId,
    newMilestone.currentPlayerId
  );
  const mine = isSelf(playerId);
  if (mine) markSelfId(playerId);
  const payload = {
    type: "setup",
    myTurn: mine,
    syllable: newMilestone.syllable,
    language: newMilestone.dictionaryManifest?.name,
  };
  window.postMessage(payload, "*");
  emitPresenceContext("socket.setMilestone");
});

socket.on("nextTurn", (playerId, syllable) => {
  const normalizedPlayer = coalescePlayerId(playerId);
  const mine = isSelf(normalizedPlayer);
  if (mine) markSelfId(normalizedPlayer);
  const payload = {
    type: "nextTurn",
    myTurn: mine,
    syllable,
  };
  window.postMessage(payload, "*");
  emitPresenceContext("socket.nextTurn");
});

socket.on("failWord", (playerId, reason) => {
  const normalizedPlayer = coalescePlayerId(playerId, lastWordPlayerId);
  const mine = isSelf(normalizedPlayer);
  if (mine) markSelfId(normalizedPlayer);
  const payload = {
    type: "failWord",
    myTurn: mine,
    word: actual_word,
    reason,
  };
  window.postMessage(payload, "*");
  emitPresenceContext("socket.failWord");
});

socket.on("correctWord", (playerId, meta) => {
  const normalizedPlayer = coalescePlayerId(
    playerId,
    meta?.playerId,
    meta?.playerPeerId,
    lastWordPlayerId
  );
  const mine = isSelf(normalizedPlayer);
  if (mine) markSelfId(normalizedPlayer);
  const payload = {
    type: "correctWord",
    word: actual_word,
    myTurn: mine,
  };
  window.postMessage(payload, "*");
  emitPresenceContext("socket.correctWord");
});

socket.on("setPlayerWord", (playerId, word) => {
  lastWordPlayerId = coalescePlayerId(playerId) || lastWordPlayerId;
  actual_word = typeof word === "string" ? word : word == null ? "" : String(word);
  if (isSelf(lastWordPlayerId)) markSelfId(lastWordPlayerId);
});

setTimeout(() => emitPresenceContext("init"), 800);
let presenceContextTimer = null;
try {
  presenceContextTimer = setInterval(() => emitPresenceContext("interval"), 5000);
} catch (_) { /* ignore */ }

window.addEventListener("focus", () => emitPresenceContext("focus"));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") emitPresenceContext("visible");
});

window.addEventListener("beforeunload", () => {
  if (presenceContextTimer) {
    try { clearInterval(presenceContextTimer); } catch (_) { /* ignore */ }
    presenceContextTimer = null;
  }
  emitPresenceContext("beforeunload");
});
