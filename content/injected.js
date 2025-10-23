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
});

socket.on("setPlayerWord", (playerId, word) => {
  lastWordPlayerId = coalescePlayerId(playerId) || lastWordPlayerId;
  actual_word = typeof word === "string" ? word : word == null ? "" : String(word);
  if (isSelf(lastWordPlayerId)) markSelfId(lastWordPlayerId);
});
