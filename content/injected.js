// injected.js

const extractWord = (input) => {
  const consider = Array.isArray(input) ? input : [input];
  for (const candidate of consider) {
    if (!candidate) continue;
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length) return trimmed;
    }
    if (typeof candidate === "object") {
      if (typeof candidate.word === "string" && candidate.word.trim().length) {
        return candidate.word.trim();
      }
      if (typeof candidate.text === "string" && candidate.text.trim().length) {
        return candidate.text.trim();
      }
      if (typeof candidate.value === "string" && candidate.value.trim().length) {
        return candidate.value.trim();
      }
      if (Array.isArray(candidate)) {
        const nested = extractWord(candidate);
        if (nested) return nested;
      }
    }
  }
  return null;
};

const rememberWord = (word) => {
  if (typeof word === "string" && word.trim().length) {
    actual_word = word.trim();
  }
  return actual_word;
};

let actual_word = "";

socket.on("setup", (data) => {
  if (data.milestone.name != "round") return;
  actual_word = "";
  window.postMessage({
    type: "setup",
    myTurn: data.milestone.currentPlayerPeerId === selfPeerId,
    syllable: data.milestone.syllable,
    language: data.milestone.dictionaryManifest.name,
  }, "*");
});

socket.on("setMilestone", (newMilestone) => {
  if (newMilestone.name != "round") return;
  actual_word = "";
  const milestoneWord = extractWord([
    newMilestone.lastWord,
    newMilestone.previousWord,
    newMilestone.word,
  ]);
  if (milestoneWord) rememberWord(milestoneWord);
  window.postMessage({
    type: "setup",
    myTurn: newMilestone.currentPlayerPeerId === selfPeerId,
    syllable: newMilestone.syllable,
    language: newMilestone.dictionaryManifest.name,
  }, "*");
});

socket.on("nextTurn", (playerId, syllable) => {
  actual_word = "";
  window.postMessage({
    type: "nextTurn",
    myTurn: playerId === selfPeerId,
    syllable: syllable,
  }, "*");
});

socket.on("failWord", (...args) => {
  const playerId = args[0];
  const reason = args[1];
  const suppliedWord = extractWord(args.slice(2));
  const word = suppliedWord ? rememberWord(suppliedWord) : actual_word;
  window.postMessage({
    type: "failWord",
    myTurn: playerId === selfPeerId,
    word: word,
    reason: reason,
  }, "*");
});

socket.on("correctWord", (...args) => {
  const playerId = args[0];
  const suppliedWord = extractWord(args.slice(1));
  const word = suppliedWord ? rememberWord(suppliedWord) : actual_word;
  window.postMessage({
    type: "correctWord",
    word: word,
    myTurn: playerId === selfPeerId,
  }, "*");
});

socket.on("setPlayerWord", (...args) => {
  const word = extractWord(args.slice(1)) ?? extractWord(args[0]);
  if (word) rememberWord(word);
});

socket.on("setPlayerWordFragment", (...args) => {
  const word = extractWord(args.slice(1)) ?? extractWord(args[0]);
  if (word && word.length >= (actual_word?.length || 0)) {
    rememberWord(word);
  }
});

