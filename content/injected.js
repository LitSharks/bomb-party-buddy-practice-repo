// injected.js

(function() {
  const socketRef = (typeof socket !== "undefined") ? socket : null;
  function normalizeId(value) {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      for (const v of value) {
        const normalized = normalizeId(v);
        if (normalized) return normalized;
      }
      return null;
    }
    if (typeof value === "object") {
      if (value.peerId !== undefined) return normalizeId(value.peerId);
      if (value.peerID !== undefined) return normalizeId(value.peerID);
      if (value.playerId !== undefined) return normalizeId(value.playerId);
      if (value.id !== undefined) return normalizeId(value.id);
    }
    const str = String(value);
    return str ? str : null;
  }

  const knownSelfIds = new Set();

  function addSelfCandidate(value) {
    const id = normalizeId(value);
    if (!id) return;
    knownSelfIds.add(id);
  }

  function addManySelfCandidates(values) {
    if (!values) return;
    if (Array.isArray(values)) {
      values.forEach(addSelfCandidate);
      return;
    }
    addSelfCandidate(values);
  }

  function refreshSelfCandidates() {
    const getters = [
      () => window?.selfPeerId,
      () => window?.selfPlayerPeerId,
      () => window?.selfPlayerId,
      () => window?.playerId,
      () => window?.you,
      () => window?.you?.id,
      () => window?.you?.peerId,
      () => window?.state?.you,
      () => window?.state?.you?.id,
      () => window?.state?.you?.peerId,
      () => window?.game?.you,
      () => window?.game?.you?.id,
      () => window?.game?.you?.peerId,
      () => socketRef?.id,
    ];
    for (const getter of getters) {
      try {
        const value = getter();
        if (Array.isArray(value)) {
          value.forEach(addSelfCandidate);
        } else if (value && typeof value === "object" && !(value instanceof String)) {
          addManySelfCandidates(Object.values(value));
        } else {
          addSelfCandidate(value);
        }
      } catch (_) {
        // ignore
      }
    }
  }

  refreshSelfCandidates();
  if (socketRef && typeof socketRef.on === "function") {
    socketRef.on("connect", () => refreshSelfCandidates());
  }

  function matchesSelf(value) {
    const id = normalizeId(value);
    if (!id) return false;
    if (knownSelfIds.has(id)) return true;
    refreshSelfCandidates();
    return knownSelfIds.has(id);
  }

  function collectActorIdsFromMilestone(milestone) {
    const ids = [];
    const push = (val) => {
      if (val === null || val === undefined) return;
      if (Array.isArray(val)) {
        val.forEach(push);
        return;
      }
      if (typeof val === "object") {
        push(val.peerId);
        push(val.peerID);
        push(val.playerId);
        push(val.id);
        return;
      }
      ids.push(val);
    };
    if (!milestone) return ids;
    push(milestone.currentPlayerPeerId);
    push(milestone.currentPlayerId);
    push(milestone.currentPlayer);
    push(milestone.player);
    return ids;
  }

  function fallbackDomMyTurn() {
    try {
      const input = document.querySelector('.selfTurn input');
      if (input && !input.disabled) return true;
      return !!document.querySelector('.selfTurn');
    } catch (_) {
      return false;
    }
  }

  function uniqueIds(values) {
    const out = [];
    const seen = new Set();
    for (const v of values || []) {
      const id = normalizeId(v);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  function actorList(value) {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) return value.slice();
    return [value];
  }

  let actual_word = "";
  let actual_actor = null;
  let lastTurnWasMine = false;

  function postMessage(payload) {
    try {
      window.postMessage(payload, "*");
    } catch (_) {
      // ignore
    }
  }

  function handleSetupLike(milestone) {
    if (!milestone || milestone.name !== "round") return;
    refreshSelfCandidates();
    const actorIds = uniqueIds(collectActorIdsFromMilestone(milestone));
    let myTurn = actorIds.some(matchesSelf);
    if (myTurn) {
      actorIds.forEach(addSelfCandidate);
    } else if (fallbackDomMyTurn()) {
      myTurn = true;
      actorIds.forEach(addSelfCandidate);
    }
    lastTurnWasMine = myTurn;
    postMessage({
      type: "setup",
      myTurn,
      syllable: milestone.syllable,
      language: milestone.dictionaryManifest?.name || milestone.dictionaryManifest,
    });
  }

  if (socketRef && typeof socketRef.on === "function") {
    socketRef.on("setup", (data) => {
      if (!data) return;
      handleSetupLike(data.milestone);
    });

    socketRef.on("setMilestone", (milestone) => {
      handleSetupLike(milestone);
    });

    socketRef.on("nextTurn", (playerId, syllable) => {
      refreshSelfCandidates();
      const candidates = uniqueIds(actorList(playerId));
      let myTurn = candidates.some(matchesSelf);
      if (myTurn) {
        candidates.forEach(addSelfCandidate);
      } else if (fallbackDomMyTurn()) {
        myTurn = true;
        candidates.forEach(addSelfCandidate);
      }
      lastTurnWasMine = myTurn;
      postMessage({
        type: "nextTurn",
        myTurn,
        syllable,
      });
    });

    socketRef.on("failWord", (playerId, reason) => {
      refreshSelfCandidates();
      const candidates = uniqueIds(actorList(playerId ?? actual_actor));
      let myTurn = candidates.some(matchesSelf);
      if (!candidates.length && lastTurnWasMine) {
        myTurn = true;
      }
      if (myTurn) {
        candidates.forEach(addSelfCandidate);
      }
      postMessage({
        type: "failWord",
        myTurn,
        word: actual_word,
        reason,
      });
    });

    socketRef.on("correctWord", (playerId) => {
      refreshSelfCandidates();
      const candidates = uniqueIds(actorList(playerId ?? actual_actor));
      let myTurn = candidates.some(matchesSelf);
      if (!candidates.length && lastTurnWasMine) {
        myTurn = true;
      }
      if (myTurn) {
        candidates.forEach(addSelfCandidate);
      }
      postMessage({
        type: "correctWord",
        myTurn,
        word: actual_word,
      });
    });

    socketRef.on("setPlayerWord", (playerId, word) => {
      actual_actor = playerId;
      actual_word = word;
      if (fallbackDomMyTurn()) {
        addManySelfCandidates(playerId);
      }
    });
  }
})();
