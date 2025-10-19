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

const rememberWord = (value) => {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;
  actual_word = trimmed;
};

const extractWordCandidate = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || /\s/.test(trimmed)) return "";
    return trimmed;
  }
  if (Array.isArray(value)) {
    return extractWordFromArgs(value);
  }
  if (typeof value === "object") {
    if (typeof value.word === "string") return value.word.trim();
    if (typeof value.actualWord === "string") return value.actualWord.trim();
    if (typeof value.text === "string") {
      const trimmed = value.text.trim();
      if (trimmed && !/\s/.test(trimmed)) return trimmed;
    }
  }
  return "";
};

const extractWordFromArgs = (args = []) => {
  const list = Array.isArray(args) ? args : [args];
  for (let i = list.length - 1; i >= 0; i--) {
    const candidate = extractWordCandidate(list[i]);
    if (candidate) return candidate;
  }
  return "";
};

const extractReasonFromArgs = (args = []) => {
  const list = Array.isArray(args) ? args : [args];
  for (const item of list) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (/\s/.test(trimmed)) return trimmed;
    } else if (Array.isArray(item)) {
      const nested = extractReasonFromArgs(item);
      if (nested) return nested;
    } else if (item && typeof item === "object") {
      if (typeof item.reason === "string") {
        const trimmed = item.reason.trim();
        if (trimmed) return trimmed;
      }
    }
  }
  return undefined;
};

let actual_word = "";

socket.on("setPlayerWord", (...args) => {
  const payload = args.length > 1 ? args.slice(1) : args;
  let word = extractWordFromArgs(payload);
  if (!word) word = extractWordFromArgs(args);
  if (word) rememberWord(word);
});

socket.on("failWord", (playerId, ...rest) => {
  const wordPayloads = rest.filter((item) => typeof item !== "string");
  const word = extractWordFromArgs(wordPayloads);
  if (word) rememberWord(word);
  const reason = extractReasonFromArgs(rest);
  const fallbackReason = typeof rest[0] === "string" ? rest[0] : undefined;
  window.postMessage({
    type: "failWord",
    myTurn: playerId === selfPeerId,
    word: actual_word,
    reason: reason ?? fallbackReason,
  }, "*");
});

socket.on("correctWord", (playerId, ...rest) => {
  const word = extractWordFromArgs(rest);
  if (word) rememberWord(word);
  window.postMessage({
    type: "correctWord",
    word: actual_word,
    myTurn: playerId === selfPeerId,
  }, "*");
});

