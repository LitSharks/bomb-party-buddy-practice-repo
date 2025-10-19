// injected.js

socket.on("setup", (data) => {
  if (data.milestone.name != "round") return;
  window.postMessage({
    type: "setup",
    myTurn: data.milestone.currentPlayerPeerId === selfPeerId,
    syllable: data.milestone.syllable,
    language: data.milestone.dictionaryManifest.name,
  }, "*");
});

socket.on("setMilestone", (newMilestone) => {
  if (newMilestone.name != "round") return;
  window.postMessage({
    type: "setup",
    myTurn: newMilestone.currentPlayerPeerId === selfPeerId,
    syllable: newMilestone.syllable,
    language: newMilestone.dictionaryManifest.name,
  }, "*");
});

socket.on("nextTurn", (playerId, syllable) => {
  window.postMessage({
    type: "nextTurn",
    myTurn: playerId === selfPeerId,
    syllable: syllable,
  }, "*");
});

const recentPlayerWords = new Map();
let actual_word;

function rememberWord(playerId, rawWord) {
  if (typeof rawWord !== "string") return;
  const trimmed = rawWord.trim();
  if (!trimmed) return;
  if (playerId) {
    recentPlayerWords.set(playerId, trimmed);
  }
  actual_word = trimmed;
}

function extractWord(candidate) {
  if (!candidate) return "";
  if (typeof candidate === "string") return candidate;
  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const word = extractWord(item);
      if (word) return word;
    }
    return "";
  }
  if (typeof candidate === "object") {
    if (typeof candidate.word === "string") return candidate.word;
    if (typeof candidate.actualWord === "string") return candidate.actualWord;
  }
  return "";
}

function resolveWord(playerId, ...candidates) {
  for (const candidate of candidates) {
    const word = extractWord(candidate);
    if (typeof word === "string" && word.trim().length) {
      const trimmed = word.trim();
      actual_word = trimmed;
      return trimmed;
    }
  }
  if (playerId && recentPlayerWords.has(playerId)) {
    const stored = recentPlayerWords.get(playerId);
    actual_word = stored;
    return stored;
  }
  return typeof actual_word === "string" ? actual_word : "";
}

socket.on("failWord", (playerId, reason, ...rest) => {
  const word = resolveWord(playerId, ...rest);
  recentPlayerWords.delete(playerId);
  window.postMessage({
    type: "failWord",
    myTurn: playerId === selfPeerId,
    word,
    reason: reason,
  }, "*");
});

socket.on("correctWord", (playerId, ...rest) => {
  const word = resolveWord(playerId, ...rest);
  recentPlayerWords.delete(playerId);
  window.postMessage({
    type: "correctWord",
    word,
    myTurn: playerId === selfPeerId,
  }, "*");
});

socket.on("setPlayerWord", (playerId, word) => {
  rememberWord(playerId, word);
});

