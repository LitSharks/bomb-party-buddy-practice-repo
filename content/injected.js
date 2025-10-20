// injected.js

const knownSelfIds = new Set();

const normalizeId = (id) => {
  if (id === undefined || id === null) return '';
  const str = String(id).trim();
  return str;
};

const rememberSelfId = (id) => {
  const norm = normalizeId(id);
  if (!norm) return;
  knownSelfIds.add(norm);
};

const gatherSelfIds = () => {
  const ids = new Set(knownSelfIds);
  const add = (value) => {
    const norm = normalizeId(value);
    if (norm) ids.add(norm);
  };
  try { if (typeof selfPeerId !== "undefined") add(selfPeerId); } catch (_) {}
  try { if (typeof selfPlayerId !== "undefined") add(selfPlayerId); } catch (_) {}
  try { if (typeof myPeerId !== "undefined") add(myPeerId); } catch (_) {}
  try { if (typeof myPlayerId !== "undefined") add(myPlayerId); } catch (_) {}
  if (typeof window !== "undefined" && window) {
    const win = window;
    ["selfPeerId", "selfPlayerId", "myPeerId", "myPlayerId", "playerId", "selfId", "myId"].forEach((key) => add(win?.[key]));
    const sources = [win?.state?.self, win?.lobby?.self, win?.room?.self, win?.game?.self];
    sources.forEach((src) => {
      if (!src) return;
      add(src.peerId);
      add(src.playerId);
      add(src.id);
    });
  }
  if (socket && typeof socket.id !== "undefined") add(socket.id);
  return Array.from(ids);
};

const isSelf = (playerId) => {
  const target = normalizeId(playerId);
  if (!target) return false;
  return gatherSelfIds().includes(target);
};

const buildMessage = (payload) => ({
  selfIds: gatherSelfIds(),
  ...payload
});

socket.on("setup", (data) => {
  if (!data || data.milestone?.name !== "round") return;
  [data?.selfPeerId, data?.selfPlayerId, data?.myPeerId, data?.myPlayerId].forEach(rememberSelfId);
  const currentId = data.milestone?.currentPlayerPeerId ?? data.milestone?.currentPlayerId ?? data.milestone?.currentPlayer ?? null;
  if (isSelf(currentId)) rememberSelfId(currentId);
  window.postMessage(buildMessage({
    type: "setup",
    myTurn: isSelf(currentId),
    syllable: data.milestone?.syllable,
    language: data.milestone?.dictionaryManifest?.name,
    playerId: normalizeId(currentId) || null
  }), "*");
});

socket.on("setMilestone", (newMilestone) => {
  if (!newMilestone || newMilestone.name !== "round") return;
  const currentId = newMilestone?.currentPlayerPeerId ?? newMilestone?.currentPlayerId ?? newMilestone?.currentPlayer ?? null;
  if (isSelf(currentId)) rememberSelfId(currentId);
  window.postMessage(buildMessage({
    type: "setup",
    myTurn: isSelf(currentId),
    syllable: newMilestone?.syllable,
    language: newMilestone?.dictionaryManifest?.name,
    playerId: normalizeId(currentId) || null
  }), "*");
});

socket.on("nextTurn", (playerId, syllable) => {
  const normalizedId = normalizeId(playerId) || null;
  if (isSelf(normalizedId)) rememberSelfId(normalizedId);
  window.postMessage(buildMessage({
    type: "nextTurn",
    myTurn: isSelf(normalizedId),
    syllable: syllable,
    playerId: normalizedId
  }), "*");
});

let actualWord = '';
let actualWordOwner = null;

socket.on("setPlayerWord", (playerId, word) => {
  actualWord = word;
  actualWordOwner = normalizeId(playerId) || null;
  if (actualWordOwner && isSelf(actualWordOwner)) rememberSelfId(actualWordOwner);
});

socket.on("failWord", (playerId, reason) => {
  const normalizedId = normalizeId(playerId) || null;
  if (isSelf(normalizedId)) rememberSelfId(normalizedId);
  window.postMessage(buildMessage({
    type: "failWord",
    myTurn: isSelf(normalizedId),
    word: actualWord,
    reason: reason,
    playerId: normalizedId
  }), "*");
});

socket.on("correctWord", (playerId) => {
  const normalizedId = normalizeId(playerId) || null;
  const ownerId = actualWordOwner;
  const mine = isSelf(normalizedId) || (ownerId ? isSelf(ownerId) : false);
  if (mine) {
    rememberSelfId(normalizedId);
    rememberSelfId(ownerId);
  }
  window.postMessage(buildMessage({
    type: "correctWord",
    word: actualWord,
    myTurn: mine,
    playerId: normalizedId,
    wordOwnerId: ownerId
  }), "*");
});
