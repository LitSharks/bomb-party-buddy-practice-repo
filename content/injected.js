// injected.js

function normalizeId(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    if (value.peerId !== undefined) return normalizeId(value.peerId);
    if (value.peerID !== undefined) return normalizeId(value.peerID);
    if (value.playerId !== undefined) return normalizeId(value.playerId);
    if (value.id !== undefined) return normalizeId(value.id);
  }
  const str = String(value);
  return str ? str : null;
}

let cachedSelfPeerId = null;
function refreshSelfPeerId() {
  const candidates = [
    () => normalizeId(window?.selfPeerId),
    () => normalizeId(window?.selfPlayerPeerId),
    () => normalizeId(window?.selfPlayerId),
    () => normalizeId(socket?.id),
  ];
  for (const pick of candidates) {
    try {
      const val = pick();
      if (val) {
        cachedSelfPeerId = val;
        return cachedSelfPeerId;
      }
    } catch (_) {
      // ignore access errors
    }
  }
  return cachedSelfPeerId;
}

function resolveSelfPeerId() {
  return refreshSelfPeerId();
}

socket.on("connect", () => { refreshSelfPeerId(); });

function isActorSelf(actorId) {
  const actor = normalizeId(actorId);
  const selfId = resolveSelfPeerId();
  if (!actor || !selfId) return false;
  return actor === normalizeId(selfId);
}

function actorFromMilestone(milestone) {
  if (!milestone) return null;
  if (milestone.currentPlayerPeerId !== undefined && milestone.currentPlayerPeerId !== null) {
    return milestone.currentPlayerPeerId;
  }
  if (milestone.currentPlayerId !== undefined && milestone.currentPlayerId !== null) {
    return milestone.currentPlayerId;
  }
  if (milestone.currentPlayer && typeof milestone.currentPlayer === "object") {
    const { peerId, peerID, playerId, id } = milestone.currentPlayer;
    if (peerId !== undefined) return peerId;
    if (peerID !== undefined) return peerID;
    if (playerId !== undefined) return playerId;
    if (id !== undefined) return id;
  }
  return null;
}

function payloadWithActor(base, actorId) {
  if (actorId === undefined) return base;
  return Object.assign({}, base, { actorId });
}

let actual_word;
let actual_actor;

socket.on("setup", (data) => {
  if (data.milestone.name != "round") return;
  refreshSelfPeerId();
  const actorId = actorFromMilestone(data.milestone);
  const myTurn = isActorSelf(actorId);
  window.postMessage(payloadWithActor({
    type: "setup",
    myTurn,
    syllable: data.milestone.syllable,
    language: data.milestone.dictionaryManifest.name,
  }, actorId), "*");
});

socket.on("setMilestone", (newMilestone) => {
  if (newMilestone.name != "round") return;
  refreshSelfPeerId();
  const actorId = actorFromMilestone(newMilestone);
  const myTurn = isActorSelf(actorId);
  window.postMessage(payloadWithActor({
    type: "setup",
    myTurn,
    syllable: newMilestone.syllable,
    language: newMilestone.dictionaryManifest.name,
  }, actorId), "*");
});

socket.on("nextTurn", (playerId, syllable) => {
  refreshSelfPeerId();
  const actorId = playerId;
  const myTurn = isActorSelf(actorId);
  window.postMessage(payloadWithActor({
    type: "nextTurn",
    myTurn,
    syllable: syllable,
  }, actorId), "*");
});

socket.on("failWord", (playerId, reason) => {
  refreshSelfPeerId();
  const actorId = playerId ?? actual_actor;
  const myTurn = isActorSelf(actorId);
  window.postMessage(payloadWithActor({
    type: "failWord",
    myTurn,
    word: actual_word,
    reason: reason,
  }, actorId), "*");
});

socket.on("correctWord", (playerId) => {
  refreshSelfPeerId();
  const actorId = playerId ?? actual_actor;
  const myTurn = isActorSelf(actorId);
  window.postMessage(payloadWithActor({
    type: "correctWord",
    word: actual_word,
    myTurn,
  }, actorId), "*");
});

socket.on("setPlayerWord", (playerId, word) => {
  actual_actor = playerId;
  actual_word = word;
});
