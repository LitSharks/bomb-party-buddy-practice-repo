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
  if (alnum.length < 4 || alnum.length > 6) return null;
  const upper = alnum.toUpperCase();
  if (!/^[A-Z0-9]{4,6}$/.test(upper)) return null;
  return upper;
}

const RESERVED_ROOM_CODE_TOKENS = new Set(["GAMES"]);

function shouldIgnoreRoomCandidate(source, normalized) {
  if (!normalized) return false;
  if (!source) return false;
  if (source.startsWith("location.path")) {
    return RESERVED_ROOM_CODE_TOKENS.has(normalized);
  }
  return false;
}

function gatherRoomCodeCandidates(extraCandidates = []) {
  const candidates = [];
  const push = (source, value) => {
    if (value == null) return;
    const str = typeof value === "string" ? value : (value === null ? "" : String(value));
    const trimmed = str.trim();
    if (!trimmed) return;
    const normalized = normalizeRoomCodeForMessage(trimmed);
    if (normalized && shouldIgnoreRoomCandidate(source, normalized)) {
      candidates.push({ source, value: trimmed, skipped: true, reason: "reserved_path" });
      return;
    }
    candidates.push({ source, value: trimmed });
  };
  if (Array.isArray(extraCandidates)) {
    for (const entry of extraCandidates) {
      if (!entry || typeof entry !== "object") continue;
      push(entry.source || "override", entry.value);
    }
  }
  try { push("window.room.code", window?.room?.code); } catch (_) { /* ignore */ }
  try { push("window.room.roomCode", window?.room?.roomCode); } catch (_) { /* ignore */ }
  try { push("window.room.match.code", window?.room?.match?.code); } catch (_) { /* ignore */ }
  try { push("window.game.roomCode", window?.game?.roomCode); } catch (_) { /* ignore */ }
  try { push("window.gameClient.roomCode", window?.gameClient?.roomCode); } catch (_) { /* ignore */ }
  try { push("window.gameClient.state.roomCode", window?.gameClient?.state?.roomCode); } catch (_) { /* ignore */ }
  try { push("location.search.room", new URLSearchParams(window.location.search || "").get("room")); } catch (_) { /* ignore */ }
  try {
    const query = socket?.io?.opts?.query;
    if (query) {
      if (typeof query === "string") {
        push("socket.io.opts.query", query);
        try {
          const params = new URLSearchParams(query);
          push("socket.io.opts.query.roomCode", params.get("roomCode"));
          push("socket.io.opts.query.room", params.get("room"));
          push("socket.io.opts.query.code", params.get("code"));
        } catch (_) { /* ignore */ }
      } else if (Array.isArray(query)) {
        query.forEach((value, idx) => push(`socket.io.opts.query[${idx}]`, value));
      } else if (typeof query === "object") {
        Object.entries(query).forEach(([key, value]) => push(`socket.io.opts.query.${key}`, value));
      }
    }
  } catch (_) { /* ignore */ }
  try {
    const engineQuery = socket?.io?.engine?.transport?.opts?.query;
    if (engineQuery) {
      if (typeof engineQuery === "string") {
        push("socket.io.engine.opts.query", engineQuery);
        try {
          const params = new URLSearchParams(engineQuery);
          push("socket.io.engine.opts.query.roomCode", params.get("roomCode"));
          push("socket.io.engine.opts.query.room", params.get("room"));
          push("socket.io.engine.opts.query.code", params.get("code"));
        } catch (_) { /* ignore */ }
      } else if (Array.isArray(engineQuery)) {
        engineQuery.forEach((value, idx) => push(`socket.io.engine.opts.query[${idx}]`, value));
      } else if (typeof engineQuery === "object") {
        Object.entries(engineQuery).forEach(([key, value]) => push(`socket.io.engine.opts.query.${key}`, value));
      }
    }
  } catch (_) { /* ignore */ }
  try {
    const uri = socket?.io?.uri;
    if (uri) {
      push("socket.io.uri", uri);
      try {
        const parsed = new URL(uri, window.location.href);
        push("socket.io.uri.roomCode", parsed.searchParams.get("roomCode"));
        push("socket.io.uri.room", parsed.searchParams.get("room"));
        push("socket.io.uri.code", parsed.searchParams.get("code"));
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }
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
    if (entry && entry.skipped) continue;
    const normalized = normalizeRoomCodeForMessage(entry.value);
    if (normalized) return normalized;
  }
  return null;
}

const presenceOverride = {
  roomCode: null,
  roomCodeCandidates: [],
  username: null,
  usernameSources: [],
  authLabel: null,
  authSources: [],
  lang: null,
  selfPeerId: null
};

const OVERRIDE_LIST_LIMIT = 10;

function cloneOverrideEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const source = entry.source != null ? String(entry.source) : null;
  const value = entry.value != null ? String(entry.value) : null;
  const trimmedValue = value ? value.trim() : "";
  if (!source && !trimmedValue) return null;
  const clone = {};
  if (source) clone.source = source;
  if (trimmedValue) clone.value = trimmedValue;
  return Object.keys(clone).length ? clone : null;
}

function appendOverrideEntry(target, entry) {
  if (!Array.isArray(target)) return;
  const clone = cloneOverrideEntry(entry);
  if (!clone) return;
  target.unshift(clone);
  if (target.length > OVERRIDE_LIST_LIMIT) target.length = OVERRIDE_LIST_LIMIT;
}

function appendOverrideEntries(target, entries) {
  if (!Array.isArray(target) || !Array.isArray(entries)) return;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    appendOverrideEntry(target, entries[i]);
  }
}

function registerPresenceOverride(partial) {
  if (!partial || typeof partial !== "object") return;
  if (Array.isArray(partial.roomCodeCandidates)) {
    appendOverrideEntries(presenceOverride.roomCodeCandidates, partial.roomCodeCandidates);
  }
  if (Array.isArray(partial.usernameSources)) {
    appendOverrideEntries(presenceOverride.usernameSources, partial.usernameSources);
  }
  if (Array.isArray(partial.authSources)) {
    appendOverrideEntries(presenceOverride.authSources, partial.authSources);
  }
  if (partial.roomCode) {
    const normalized = normalizeRoomCodeForMessage(partial.roomCode);
    if (normalized) {
      presenceOverride.roomCode = normalized;
      if (partial.roomCodeSource) {
        appendOverrideEntry(presenceOverride.roomCodeCandidates, {
          source: partial.roomCodeSource,
          value: normalized
        });
      }
    }
  }
  if (typeof partial.username === "string") {
    const trimmed = partial.username.trim();
    if (trimmed) presenceOverride.username = trimmed;
  }
  if (typeof partial.authLabel === "string") {
    const trimmed = partial.authLabel.trim();
    if (trimmed) presenceOverride.authLabel = trimmed;
  }
  if (partial.selfPeerId != null) {
    const normalizedPeer = normalizePlayerId(partial.selfPeerId);
    if (normalizedPeer) presenceOverride.selfPeerId = normalizedPeer;
  }
  if (typeof partial.lang === "string") {
    const trimmedLang = partial.lang.trim();
    if (trimmedLang) presenceOverride.lang = trimmedLang;
  }
}

function refreshSocketRoomOverrides() {
  const extras = [];
  const pushCandidate = (source, value) => {
    if (value == null) return;
    const str = typeof value === "string" ? value : String(value);
    const trimmed = str.trim();
    if (!trimmed) return;
    extras.push({ source, value: trimmed });
  };
  const collectQuery = (base, query) => {
    if (!query) return;
    if (typeof query === "string") {
      pushCandidate(base, query);
      try {
        const params = new URLSearchParams(query);
        pushCandidate(`${base}.roomCode`, params.get("roomCode"));
        pushCandidate(`${base}.room`, params.get("room"));
        pushCandidate(`${base}.code`, params.get("code"));
      } catch (_) { /* ignore */ }
      return;
    }
    if (Array.isArray(query)) {
      query.forEach((value, idx) => pushCandidate(`${base}[${idx}]`, value));
      return;
    }
    if (typeof query === "object") {
      Object.entries(query).forEach(([key, value]) => pushCandidate(`${base}.${key}`, value));
    }
  };

  try { collectQuery("socket.io.opts.query", socket?.io?.opts?.query); } catch (_) { /* ignore */ }
  try { collectQuery("socket.io.engine.opts.query", socket?.io?.engine?.transport?.opts?.query); } catch (_) { /* ignore */ }
  try { collectQuery("socket.io.engine.transport.query", socket?.io?.engine?.transport?.query); } catch (_) { /* ignore */ }
  try { collectQuery("socket.io.engine.transport.socket.query", socket?.io?.engine?.transport?.socket?.query); } catch (_) { /* ignore */ }
  try {
    const uri = socket?.io?.uri;
    if (uri) {
      pushCandidate("socket.io.uri", uri);
      try {
        const parsed = new URL(uri, window.location.href);
        pushCandidate("socket.io.uri.roomCode", parsed.searchParams.get("roomCode"));
        pushCandidate("socket.io.uri.room", parsed.searchParams.get("room"));
        pushCandidate("socket.io.uri.code", parsed.searchParams.get("code"));
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }

  if (!extras.length) return;
  let resolved = null;
  let resolvedSource = null;
  for (const entry of extras) {
    const normalized = normalizeRoomCodeForMessage(entry.value);
    if (normalized) {
      resolved = normalized;
      resolvedSource = entry.source;
      break;
    }
  }
  const payload = { roomCodeCandidates: extras };
  if (resolved) {
    payload.roomCode = resolved;
    payload.roomCodeSource = resolvedSource;
  }
  registerPresenceOverride(payload);
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

  try {
    if (typeof playersByPeerId !== "undefined" && playersByPeerId && typeof playersByPeerId === "object") {
      const mine = getSelfId();
      if (mine && playersByPeerId[mine]) {
        push("playersByPeerId[self]", playersByPeerId[mine]);
      }
      Object.values(playersByPeerId).forEach((entry) => push("playersByPeerId", entry));
    }
  } catch (_) { /* ignore */ }
  try {
    if (typeof players !== "undefined" && Array.isArray(players)) {
      players.forEach((entry, idx) => push(`players[${idx}]`, entry));
    }
  } catch (_) { /* ignore */ }

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

function gatherInlineProfileSnapshot() {
  const safeTrim = (value) => {
    if (value == null) return "";
    try { return String(value).trim(); }
    catch (_) { return ""; }
  };

  const snapshot = {
    nickname: null,
    nicknameSource: null,
    authLabel: null,
    authSource: null,
    authProvider: null
  };

  const tryNickname = (selector) => {
    if (snapshot.nickname) return;
    try {
      const node = document.querySelector(selector);
      if (!node) return;
      let raw = "";
      if (typeof node.getAttribute === "function") {
        raw = node.getAttribute("data-nickname")
          || node.getAttribute("data-name")
          || node.getAttribute("data-value")
          || "";
      }
      if (!raw && typeof node.value === "string") raw = node.value;
      if (!raw) raw = node.textContent || "";
      const value = safeTrim(raw);
      if (!value) return;
      snapshot.nickname = value;
      snapshot.nicknameSource = selector;
    } catch (_) {
      /* ignore */
    }
  };

  [
    "#mentionTriggers",
    ".settings #mentionTriggers",
    ".sidebar #mentionTriggers",
    ".setup .auth .nickname",
    ".setup .nickname",
    "[data-nickname]",
    ".profile .nickname",
    ".account .nickname",
    ".account .name"
  ].forEach((selector) => tryNickname(selector));

  const tryAuth = (selector) => {
    if (snapshot.authLabel) return;
    try {
      const node = document.querySelector(selector);
      if (!node) return;
      let raw = "";
      if (typeof node.getAttribute === "function") {
        raw = node.getAttribute("data-auth-label")
          || node.getAttribute("data-label")
          || node.getAttribute("title")
          || node.getAttribute("aria-label")
          || "";
      }
      if (!raw && typeof node.value === "string") raw = node.value;
      if (!raw) raw = node.textContent || "";
      const value = safeTrim(raw);
      if (!value || value.length <= 2) return;
      if (value.toLowerCase() === "you are") return;
      snapshot.authLabel = value;
      snapshot.authSource = selector;
    } catch (_) {
      /* ignore */
    }
  };

  [
    "[data-auth-label]",
    ".setup .auth [data-label]",
    ".setup .auth .authLabel",
    ".setup .auth .label",
    ".setup .auth .auth",
    ".userProfile .auth",
    ".sidebar .userProfile .auth",
    ".mainBadge"
  ].forEach((selector) => tryAuth(selector));

  const tryProvider = (selector) => {
    if (snapshot.authProvider) return;
    try {
      const node = document.querySelector(selector);
      if (!node) return;
      let raw = "";
      if (typeof node.getAttribute === "function") {
        raw = node.getAttribute("data-service")
          || node.getAttribute("data-provider")
          || node.getAttribute("data-auth-provider")
          || node.getAttribute("alt")
          || node.getAttribute("title")
          || "";
      }
      if (!raw && typeof node.value === "string") raw = node.value;
      if (!raw) raw = node.textContent || "";
      const value = safeTrim(raw);
      if (!value) return;
      snapshot.authProvider = value;
    } catch (_) {
      /* ignore */
    }
  };

  [
    ".setup .auth",
    ".setup .auth .service",
    ".userProfile .service",
    ".sidebar .userProfile .service"
  ].forEach((selector) => tryProvider(selector));

  if (!snapshot.authProvider && snapshot.authLabel) {
    const match = snapshot.authLabel.match(/\bon\s+([A-Za-z0-9 ]+)/i);
    if (match && match[1]) {
      const provider = safeTrim(match[1]);
      if (provider && provider.toLowerCase() !== "guest") {
        snapshot.authProvider = provider;
      }
    }
  }

  if (snapshot.nickname && snapshot.nicknameSource === "#mentionTriggers") {
    try {
      const authButton = document.querySelector(".setup .auth");
      if (authButton) {
        const attr = authButton.getAttribute("data-service")
          || authButton.getAttribute("data-provider")
          || (authButton.dataset ? (authButton.dataset.service || authButton.dataset.provider) : "");
        const provider = safeTrim(attr);
        if (provider) snapshot.authProvider = provider;
      }
    } catch (_) {
      /* ignore */
    }
  }

  return snapshot;
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

function findPlayerByPeerId(playersList, peerId) {
  if (!Array.isArray(playersList)) return null;
  const target = normalizePlayerId(peerId);
  if (!target) return null;
  for (const player of playersList) {
    if (!player || typeof player !== "object") continue;
    const candidate = normalizePlayerId(
      player?.profile?.peerId ?? player?.peerId ?? player?.id ?? player?.profile?.id ?? player?.profile?.playerId
    );
    if (candidate && candidate === target) {
      return player;
    }
  }
  return null;
}

function updateOverrideFromPlayer(player, source) {
  if (!player || typeof player !== "object") return;
  const usernameSources = [];
  const authSources = [];
  const profile = player.profile && typeof player.profile === "object" ? player.profile : null;
  let username = "";
  if (profile) {
    username = pickUsername(profile, `${source}.profile`, usernameSources) || username;
  }
  if (!username) {
    username = pickUsername(player, source, usernameSources) || "";
  }
  let authLabel = "";
  if (profile) {
    const authCandidate = {
      auth: profile.auth ?? player.auth,
      authText: profile.authText ?? player.authText,
      authBadge: profile.authBadge ?? player.authBadge,
      badge: profile.badge ?? player.badge,
      badgeText: profile.badgeText ?? player.badgeText,
      linkedAccountLabel: profile.linkedAccountLabel ?? player.linkedAccountLabel,
      accountLabel: profile.accountLabel ?? player.accountLabel,
      discord: profile.discord ?? player.discord,
      twitch: profile.twitch ?? player.twitch
    };
    authLabel = pickAuthLabel(authCandidate, `${source}.profile`, authSources) || authLabel;
  }
  if (!authLabel) {
    authLabel = pickAuthLabel(player, source, authSources) || "";
  }

  const override = {
    usernameSources,
    authSources
  };
  if (username) override.username = username;
  if (authLabel) override.authLabel = authLabel;
  const normalizedPeer = normalizePlayerId(
    profile?.peerId ?? player.peerId ?? player.id ?? player?.profile?.peerId ?? player?.profile?.id
  );
  if (normalizedPeer) override.selfPeerId = normalizedPeer;
  registerPresenceOverride(override);
}

function gatherLanguageForContext() {
  const attempts = [];
  const push = (value) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    attempts.push(trimmed);
  };
  if (typeof presenceOverride.lang === "string" && presenceOverride.lang) {
    push(presenceOverride.lang);
  }
  try { push(window?.room?.dictionary?.name); } catch (_) { /* ignore */ }
  try { push(window?.game?.dictionary?.name); } catch (_) { /* ignore */ }
  try { push(window?.gameClient?.dictionary?.name); } catch (_) { /* ignore */ }
  try { push(window?.gameClient?.state?.dictionary?.name); } catch (_) { /* ignore */ }
  return attempts.length ? attempts[0] : null;
}

function emitPresenceContext(reason) {
  try {
    refreshSocketRoomOverrides();
    const inlineProfile = gatherInlineProfileSnapshot();
    const inlineOverride = {};
    if (inlineProfile.nickname) {
      inlineOverride.username = inlineProfile.nickname;
      if (inlineProfile.nicknameSource) {
        inlineOverride.usernameSources = [
          { source: inlineProfile.nicknameSource, value: inlineProfile.nickname }
        ];
      }
    }
    if (inlineProfile.authLabel) {
      inlineOverride.authLabel = inlineProfile.authLabel;
      if (inlineProfile.authSource) {
        inlineOverride.authSources = [
          { source: inlineProfile.authSource, value: inlineProfile.authLabel }
        ];
      }
    }
    if (Object.keys(inlineOverride).length) {
      registerPresenceOverride(inlineOverride);
    }
    const extraCandidates = Array.isArray(presenceOverride.roomCodeCandidates)
      ? presenceOverride.roomCodeCandidates.slice(0, OVERRIDE_LIST_LIMIT)
      : [];
    const roomCandidates = gatherRoomCodeCandidates(extraCandidates);
    const overrideRoom = presenceOverride.roomCode
      ? normalizeRoomCodeForMessage(presenceOverride.roomCode)
      : null;
    const roomCode = overrideRoom || pickBestRoomCode(roomCandidates);
    const selfInfo = gatherSelfInfoForContext();
    const combinedUsernameSources = [];
    if (Array.isArray(presenceOverride.usernameSources)) {
      combinedUsernameSources.push(...presenceOverride.usernameSources);
    }
    if (Array.isArray(selfInfo.usernameSources)) {
      combinedUsernameSources.push(...selfInfo.usernameSources);
    }
    if (inlineProfile.nickname && inlineProfile.nicknameSource) {
      combinedUsernameSources.push({
        source: inlineProfile.nicknameSource,
        value: inlineProfile.nickname
      });
    }
    const combinedAuthSources = [];
    if (Array.isArray(presenceOverride.authSources)) {
      combinedAuthSources.push(...presenceOverride.authSources);
    }
    if (Array.isArray(selfInfo.authSources)) {
      combinedAuthSources.push(...selfInfo.authSources);
    }
    if (inlineProfile.authLabel && inlineProfile.authSource) {
      combinedAuthSources.push({
        source: inlineProfile.authSource,
        value: inlineProfile.authLabel
      });
    }
    const username = (presenceOverride.username || selfInfo.username || "").trim();
    const authLabel = (presenceOverride.authLabel || selfInfo.authLabel || "").trim();
    const peerId = presenceOverride.selfPeerId || selfInfo.peerId || null;
    const lang = presenceOverride.lang || gatherLanguageForContext();
    let roomUrl = null;
    try {
      const href = window?.location?.href;
      if (typeof href === "string" && href.trim()) roomUrl = href.trim();
    } catch (_) {
      roomUrl = null;
    }
    const payload = {
      type: "presenceContext",
      reason,
      timestamp: Date.now(),
      roomCode: roomCode || null,
      roomCodeCandidates: roomCandidates,
      username: username || null,
      usernameSources: combinedUsernameSources.slice(0, OVERRIDE_LIST_LIMIT),
      authLabel: authLabel || null,
      authSources: combinedAuthSources.slice(0, OVERRIDE_LIST_LIMIT),
      selfPeerId: peerId || null,
      lang: lang || null,
      roomUrl: roomUrl,
      lobbyNickname: inlineProfile.nickname || null,
      lobbyNicknameSource: inlineProfile.nicknameSource || null,
      lobbyAuthLabel: inlineProfile.authLabel || null,
      lobbyAuthSource: inlineProfile.authSource || null,
      lobbyAuthProvider: inlineProfile.authProvider || null
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
  const setupSelf = coalescePlayerId(
    data?.selfPeerId,
    typeof selfPeerId !== "undefined" ? selfPeerId : null,
    data?.playerPeerId,
    data?.playerId
  );
  if (setupSelf) {
    registerPresenceOverride({ selfPeerId: setupSelf });
  }
  markSelfId(setupSelf || (typeof selfPeerId !== "undefined" ? selfPeerId : null));
  if (Array.isArray(data?.players)) {
    const mine = findPlayerByPeerId(data.players, setupSelf || getSelfId());
    if (mine) {
      updateOverrideFromPlayer(mine, "setup.players");
    }
  }
  const dictName = data?.milestone?.dictionaryManifest?.name;
  if (typeof dictName === "string" && dictName.trim()) {
    registerPresenceOverride({ lang: dictName });
  }
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
  const dictName = newMilestone?.dictionaryManifest?.name;
  if (typeof dictName === "string" && dictName.trim()) {
    registerPresenceOverride({ lang: dictName });
  }
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

socket.on("setDictionaryManifest", (manifest) => {
  const dictName = manifest?.name;
  if (typeof dictName === "string" && dictName.trim()) {
    registerPresenceOverride({ lang: dictName });
  }
  emitPresenceContext("socket.setDictionaryManifest");
});

socket.on("addPlayer", (player) => {
  try {
    const mine = getSelfId();
    const candidate = normalizePlayerId(player?.profile?.peerId ?? player?.peerId ?? player?.id);
    if (mine && candidate && mine === candidate) {
      updateOverrideFromPlayer(player, "socket.addPlayer");
    }
  } catch (err) {
    console.warn("[BombPartyShark] Failed to process addPlayer for presence", err);
  }
  emitPresenceContext("socket.addPlayer");
});

socket.on("updatePlayer", (playerPeerId, profile) => {
  try {
    const mine = getSelfId();
    const normalizedPeer = normalizePlayerId(playerPeerId);
    if (mine && normalizedPeer && mine === normalizedPeer) {
      updateOverrideFromPlayer({ profile: profile || {}, peerId: normalizedPeer }, "socket.updatePlayer");
    }
  } catch (err) {
    console.warn("[BombPartyShark] Failed to process updatePlayer for presence", err);
  }
  emitPresenceContext("socket.updatePlayer");
});

socket.on("connect", () => {
  refreshSocketRoomOverrides();
  emitPresenceContext("socket.connect");
});

socket.on("reconnect", () => {
  refreshSocketRoomOverrides();
  emitPresenceContext("socket.reconnect");
});

socket.on("disconnect", () => {
  emitPresenceContext("socket.disconnect");
});

setTimeout(() => {
  refreshSocketRoomOverrides();
  emitPresenceContext("init");
}, 800);
let presenceContextTimer = null;
try {
  presenceContextTimer = setInterval(() => {
    refreshSocketRoomOverrides();
    emitPresenceContext("interval");
  }, 5000);
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
