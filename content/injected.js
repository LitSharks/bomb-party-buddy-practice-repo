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

const lastPlayerWords = new Map();
let actual_word;

function rememberPlayerWord(playerId, word) {
  if (typeof playerId === "string" && playerId.length) {
    if (typeof word === "string") {
      lastPlayerWords.set(playerId, word);
    } else {
      lastPlayerWords.delete(playerId);
    }
  }
  if (typeof word === "string" && word.length) {
    actual_word = word;
  }
}

function resolvePlayerWord(playerId, fallback) {
  if (typeof fallback === "string" && fallback.length) return fallback;
  if (typeof playerId === "string" && lastPlayerWords.has(playerId)) {
    return lastPlayerWords.get(playerId);
  }
  return typeof actual_word === "string" ? actual_word : "";
}

socket.on("failWord", (playerId, reason, providedWord) => {
  const word = resolvePlayerWord(playerId, providedWord);
  if (typeof playerId === "string") lastPlayerWords.delete(playerId);
  window.postMessage({
    type: "failWord",
    myTurn: playerId === selfPeerId,
    word,
    reason: reason,
  }, "*");
});

socket.on("correctWord", (playerId, providedWord) => {
  const word = resolvePlayerWord(playerId, providedWord);
  if (typeof playerId === "string") lastPlayerWords.delete(playerId);
  window.postMessage({
    type: "correctWord",
    word,
    myTurn: playerId === selfPeerId,
  }, "*");
});

socket.on("setPlayerWord", (...args) => {
  let playerId = null;
  let word = null;
  if (args.length >= 2) {
    playerId = args[0];
    word = args[1];
  } else if (args.length === 1) {
    word = args[0];
  }
  rememberPlayerWord(playerId, word);
});

