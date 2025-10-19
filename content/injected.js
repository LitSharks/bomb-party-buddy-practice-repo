// injected.js

let actual_word;
const lastPlayerWords = new Map();

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

socket.on("failWord", (playerId, reason) => {
  const word = lastPlayerWords.get(playerId) ?? actual_word;
  window.postMessage({
    type: "failWord",
    myTurn: playerId === selfPeerId,
    word: word,
    reason: reason,
  }, "*");
});

socket.on("correctWord", (playerId) => {
  const word = lastPlayerWords.get(playerId) ?? actual_word;
  window.postMessage({
    type: "correctWord",
    word: word,
    myTurn: playerId === selfPeerId,
  }, "*");
});
socket.on("setPlayerWord", (playerId, word) => {
  actual_word = word;
  if (playerId !== undefined && playerId !== null) {
    lastPlayerWords.set(playerId, word);
  }
  window.postMessage({
    type: "playerWord",
    playerId: playerId,
    word: word,
    myTurn: playerId === selfPeerId,
  }, "*");
});

