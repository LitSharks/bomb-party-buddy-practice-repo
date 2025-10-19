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

let actual_word;
let actual_word_owner = null;

socket.on("failWord", (playerId, reason, details) => {
  const resolvedWord = (details && typeof details.word === "string") ? details.word : "";
  if (resolvedWord) {
    actual_word = resolvedWord;
    actual_word_owner = playerId;
  }
  window.postMessage({
    type: "failWord",
    myTurn: playerId === selfPeerId,
    word: resolvedWord,
    reason: reason,
  }, "*");
});

socket.on("correctWord", (playerId, maybeWord) => {
  let resolvedWord = "";
  if (typeof maybeWord === "string") {
    resolvedWord = maybeWord;
  } else if (maybeWord && typeof maybeWord.word === "string") {
    resolvedWord = maybeWord.word;
  }
  if (resolvedWord) {
    actual_word = resolvedWord;
    actual_word_owner = playerId;
  }
  const fallback = actual_word_owner === playerId ? (actual_word || "") : "";
  const finalWord = resolvedWord || fallback;
  window.postMessage({
    type: "correctWord",
    word: finalWord,
    myTurn: playerId === selfPeerId,
  }, "*");
});

socket.on("setPlayerWord", (playerId, word) => {
  actual_word = word;
  actual_word_owner = playerId;
});

