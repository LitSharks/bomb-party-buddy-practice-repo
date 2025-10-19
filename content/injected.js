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

const extractWord = (payload, allowPlainString = true) => {
  if (!payload) return "";
  if (allowPlainString && typeof payload === "string") return payload;
  if (typeof payload === "object") {
    if (Array.isArray(payload)) {
      for (const entry of payload) {
        const candidate = extractWord(entry, allowPlainString);
        if (candidate) return candidate;
      }
      return "";
    }
    if (typeof payload.word === "string") return payload.word;
    if (typeof payload.text === "string") return payload.text;
    if (typeof payload.value === "string") return payload.value;
    if (typeof payload.display === "string") return payload.display;
  }
  return "";
};

const extractReason = (payload) => {
  if (!payload) return undefined;
  if (typeof payload === "string") return payload;
  if (typeof payload === "object" && typeof payload.reason === "string") return payload.reason;
  return undefined;
};

socket.on("failWord", (playerId, arg2, arg3) => {
  const reason = extractReason(arg2) ?? extractReason(arg3);
  const payloadWord = extractWord(arg3) || extractWord(arg2);
  const word = payloadWord || actual_word || "";
  window.postMessage({
    type: "failWord",
    myTurn: playerId === selfPeerId,
    word,
    reason,
  }, "*");
});

socket.on("correctWord", (playerId, payload, extra) => {
  const payloadWord = extractWord(payload) || extractWord(extra);
  const word = payloadWord || actual_word || "";
  window.postMessage({
    type: "correctWord",
    word,
    myTurn: playerId === selfPeerId,
  }, "*");
});

let actual_word = "";
socket.on("setPlayerWord", (arg1, arg2) => {
  const fromSecond = extractWord(arg2);
  if (fromSecond) {
    actual_word = fromSecond;
    return;
  }
  const fromFirst = extractWord(arg1, false);
  if (fromFirst) {
    actual_word = fromFirst;
  }
});

