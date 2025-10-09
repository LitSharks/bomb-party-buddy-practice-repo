// content/bombpartybuddy.js
// Overlay/HUD + event wire-up for Bomb Party Shark

function isBombPartyFrame() {
  try {
    const url = new URL(document.location.href);
    return url.hostname.endsWith(".jklm.fun") && url.pathname.startsWith("/games/bombparty");
  } catch (_) {
    return false;
  }
}

function getInput() {
  const selfTurns = document.getElementsByClassName("selfTurn");
  if (!selfTurns.length) return document.querySelector("input") || null;
  return selfTurns[0].getElementsByTagName("input")[0];
}

// Clipboard fallback (permissions policy blocks navigator.clipboard)
async function copyPlain(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

function createOverlay(game) {
  // Top-anchored wrapper
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "fixed", left: "12px", top: "12px",
    zIndex: "2147483647", userSelect: "none",
  });

  // HUD
  const box = document.createElement("div");
  Object.assign(box.style, {
    background: "rgba(13,17,23,0.96)",
    color: "#fff",
    fontFamily: "Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
    fontSize: "14px",
    lineHeight: "1.45",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    padding: "12px 14px",
    boxShadow: "0 10px 28px rgba(0,0,0,0.40)",
    width: "520px",
    transformOrigin: "left top",
  });
  wrap.appendChild(box);

  // scale (range 20-70; default ~45)
  let hudScale = 0.45;
  const applyScale = () => { box.style.transform = `scale(${hudScale})`; };
  applyScale();

  // header (drag + collapse)
  const header = document.createElement("div");
  header.textContent = "Bomb Party Shark";
  Object.assign(header.style, {
    fontWeight: 800, marginBottom: "10px", letterSpacing: "0.2px",
    cursor: "grab", borderBottom: "1px solid rgba(255,255,255,0.10)", paddingBottom: "8px",
    fontSize: "16px"
  });
  box.appendChild(header);

  // Tabs
  const tabs = document.createElement("div");
  Object.assign(tabs.style, { display:"flex", gap:"8px", marginBottom:"10px" });
  const mkTab = (name) => {
    const b = document.createElement("button");
    b.textContent = name;
    Object.assign(b.style, { padding:"6px 10px", borderRadius:"8px", cursor:"pointer",
      border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.06)", fontWeight:700 });
    b._setActive = (on)=> {
      b.style.background = on ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)";
      b.style.border = on ? "1px solid rgba(59,130,246,0.55)" : "1px solid rgba(255,255,255,0.2)";
    };
    return b;
  };
  const mainTabBtn = mkTab("Main");
  const covTabBtn  = mkTab("Coverage");
  const wordsTabBtn= mkTab("Words");
  tabs.appendChild(mainTabBtn); tabs.appendChild(covTabBtn); tabs.appendChild(wordsTabBtn);
  box.appendChild(tabs);

  // sections
  const mainSec = document.createElement("div");
  const covSec  = document.createElement("div");
  const wordsSec= document.createElement("div");
  box.appendChild(mainSec); box.appendChild(covSec); box.appendChild(wordsSec);

  // default to Words
  let active = "Words";
  const setActive = (name) => {
    active = name;
    mainSec.style.display  = name==="Main" ? "block" : "none";
    covSec.style.display   = name==="Coverage" ? "block" : "none";
    wordsSec.style.display = name==="Words" ? "block" : "none";
    mainTabBtn._setActive(name==="Main");
    covTabBtn._setActive(name==="Coverage");
    wordsTabBtn._setActive(name==="Words");
  };
  mainTabBtn.onclick = () => setActive("Main");
  covTabBtn.onclick  = () => setActive("Coverage");
  wordsTabBtn.onclick= () => setActive("Words");
  setActive("Words");

  // helpers
  const applyToggleStyle = (btn, on) => {
    btn.textContent = on ? "ON" : "OFF";
    btn.style.background = on ? "rgba(22,163,74,0.22)" : "rgba(220,38,38,0.20)";
    btn.style.border = `1px solid ${on ? "rgba(22,163,74,0.55)" : "rgba(220,38,38,0.55)"}`;
    btn.style.color = on ? "#86efac" : "#fecaca";
    btn.style.fontWeight = "800";
    btn.style.borderRadius = "10px";
    btn.style.padding = "6px 10px";
    btn.style.cursor = "pointer";
    btn.style.minWidth = "64px";
    btn.style.textAlign = "center";
  };
  const applyToggleBtn = (btn, on) => applyToggleStyle(btn, !!on);

  const mkRow = (label, onClick, getOn) => {
    const r = document.createElement("div");
    Object.assign(r.style, { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", margin:"8px 0" });
    const span = document.createElement("span"); span.textContent = label; span.style.fontWeight = "600"; r.appendChild(span);
    const btn = document.createElement("button"); btn.onclick = () => { onClick(); render(); };
    r.appendChild(btn);
    r._btn = btn; r._get = getOn;
    return r;
  };

  function sliderRow(label, min, max, val, step, oninput){
    const row = document.createElement("div");
    Object.assign(row.style, {
      display:"grid",
      gridTemplateColumns:"auto 1fr auto",
      alignItems:"center",
      gap:"14px",
      margin:"10px 0"
    });
    const span = document.createElement("span"); span.textContent = label; span.style.fontWeight = "600";
    const input = document.createElement("input");
    input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(val);
    const valEl = document.createElement("span"); valEl.textContent = String(val); valEl.style.opacity = "0.9"; valEl.style.fontWeight = "700";
    input.addEventListener("input", (e)=>{ const v = step===1?parseInt(input.value,10):parseFloat(input.value); oninput(v); valEl.textContent = String(v); e.stopPropagation(); });
    row.appendChild(span); row.appendChild(input); row.appendChild(valEl);
    row._range = input;
    return row;
  }
  function textInput(placeholder, value, oninput){
    const wrap = document.createElement("div");
    const inp = document.createElement("input");
    inp.type = "text"; inp.placeholder = placeholder; inp.value = value || "";
    Object.assign(inp.style, { width:"100%", padding:"6px 8px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:"600" });
    inp.addEventListener("input", (e)=>{ oninput(inp.value); e.stopPropagation(); });
    wrap.appendChild(inp);
    return wrap;
  }
  function createCard(title){
    const card = document.createElement("div");
    Object.assign(card.style, {
      background:"rgba(15,23,42,0.55)",
      border:"1px solid rgba(148,163,184,0.25)",
      borderRadius:"14px",
      padding:"14px 16px",
      display:"flex",
      flexDirection:"column",
      gap:"12px"
    });
    if (title) {
      const heading = document.createElement("div");
      heading.textContent = title;
      Object.assign(heading.style, { fontWeight:800, fontSize:"15px", letterSpacing:"0.2px" });
      card.appendChild(heading);
    }
    return card;
  }
  function noticeBar(){
    const n = document.createElement("div");
    Object.assign(n.style, {
      height:"38px",
      width:"100%",
      overflow:"hidden",
      color:"#facc15",
      fontSize:"12px",
      display:"block",
      visibility:"hidden",
      paddingTop:"6px",
      wordWrap:"break-word",
      overflowWrap:"break-word",
      wordBreak:"break-word",
    });
    n._show = (text) => { n.textContent = text || ""; n.style.visibility = text ? "visible" : "hidden"; };
    return n;
  }
  function listBox(fontPx){
    const d = document.createElement("div");
    Object.assign(d.style, {
      marginTop:"4px",
      display:"flex",
      flexWrap:"wrap",
      gap:"10px",
      alignItems:"stretch",
      fontFamily:"Inter,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
      fontSize:`${fontPx}px`
    });
    return d;
  }

  // DRAGGABLE (top-locked) + collapse without accidental clicks
  let dragging = false, dragMoved = false, px = 0, py = 0, left = 12, top = 12;
  header.addEventListener("mousedown", (e) => {
    dragging = true; dragMoved = false; header.style.cursor = "grabbing";
    px = e.clientX; py = e.clientY; e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - px, dy = e.clientY - py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    left = Math.max(4, left + dx); top  = Math.max(4,  top  + dy);
    wrap.style.left = `${left}px`; wrap.style.top  = `${top}px`;
    px = e.clientX; py = e.clientY;
  });
  window.addEventListener("mouseup", () => { dragging = false; header.style.cursor = "grab"; });
  let collapsed = false;
  header.addEventListener("click", () => {
    if (dragMoved) { dragMoved = false; return; }
    collapsed = !collapsed;
    mainSec.style.display  = collapsed ? "none" : (active==="Main"?"block":"none");
    covSec.style.display   = collapsed ? "none" : (active==="Coverage"?"block":"none");
    wordsSec.style.display = collapsed ? "none" : (active==="Words"?"block":"none");
    tabs.style.display     = collapsed ? "none" : "flex";
  });

  // =============== MAIN TAB =================
  const rows = [
    mkRow("AutoType", () => game.togglePause(), () => !game.paused),
    mkRow("Butterfingers", () => game.toggleMistakes(), () => game.mistakesEnabled),
    mkRow("Auto /suicide", () => game.toggleAutoSuicide(), () => game.autoSuicide),
  ];

  const mainGrid = document.createElement("div");
  Object.assign(mainGrid.style, { display:"grid", gap:"16px" });
  mainSec.appendChild(mainGrid);

  const automationCard = createCard("Automation");
  rows.forEach(r => automationCard.appendChild(r));
  mainGrid.appendChild(automationCard);

  const hudCard = createCard("HUD & Rhythm");
  hudCard.appendChild(sliderRow("HUD size", 20, 70, 45, 1, (v)=>{ hudScale = v/100; applyScale(); }));
  hudCard.appendChild(sliderRow("Speed", 1, 12, game.speed, 1, (v)=>game.setSpeed(v)));
  hudCard.appendChild(sliderRow("Thinking delay (s)", 0, 5, game.thinkingDelaySec, 0.1, (v)=>game.setThinkingDelaySec(v)));
  hudCard.appendChild(sliderRow("Butterfingers (%)", 0, 30, Math.round(game.mistakesProb * 100), 1, (v)=>game.setMistakesProb(v/100)));
  mainGrid.appendChild(hudCard);

  const messageCard = createCard("Messages");
  const preTop = mkRow("Premessage", ()=>game.setPreMsgEnabled(!game.preMsgEnabled), ()=>game.preMsgEnabled);
  messageCard.appendChild(preTop);
  messageCard.appendChild(textInput("Message to flash before your word", game.preMsgText, (v)=>game.setPreMsgText(v)));
  const postTop = mkRow("Postfix", ()=>game.setPostfixEnabled(!game.postfixEnabled), ()=>game.postfixEnabled);
  messageCard.appendChild(postTop);
  messageCard.appendChild(textInput("Characters to append (e.g., <3)", game.postfixText, (v)=>game.setPostfixText(v)));
  mainGrid.appendChild(messageCard);

  // =============== COVERAGE TAB =================
  const coverageCard = createCard("Alphabet mastery");
  const coverageToggle = mkRow("Alphabet coverage", () => game.toggleCoverageMode(), () => game.coverageMode);
  coverageCard.appendChild(coverageToggle);

  const exTop = mkRow("A-Z goals / exclusions", ()=>game.setExcludeEnabled(!game.excludeEnabled), ()=>game.excludeEnabled);
  coverageCard.appendChild(exTop);

  const help = document.createElement("div");
  help.innerHTML = "Format examples: <b>a3 f2 c8 x0 z0</b> (0 = exclude). You can also set <b>majority5</b> to set a default for all letters; explicit tokens like <b>a3</b> override the majority.";
  Object.assign(help.style, { color:"rgba(255,255,255,0.78)", fontSize:"12px" });
  coverageCard.appendChild(help);

  const exInputWrap = textInput("a3 f2 c8 x0 z0  majority0", game.excludeSpec || "x0 z0", (v)=>game.setExcludeSpec(v));
  coverageCard.appendChild(exInputWrap);

  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display:"grid",
    gridTemplateColumns:"repeat(6, minmax(0, 1fr))",
    gap:"8px",
    marginTop:"4px"
  });
  coverageCard.appendChild(grid);

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset A-Z progress";
  Object.assign(resetBtn.style,{ padding:"8px 12px", borderRadius:"10px", cursor:"pointer", background:"rgba(79,70,229,0.18)", color:"#c7d2fe", border:"1px solid rgba(129,140,248,0.35)", fontWeight:"700" });
  resetBtn.onclick = ()=>game.resetCoverage();
  coverageCard.appendChild(resetBtn);

  covSec.appendChild(coverageCard);

  // =============== WORDS TAB =================
  const wordsGrid = document.createElement("div");
  Object.assign(wordsGrid.style, { display:"grid", gap:"16px" });
  wordsSec.appendChild(wordsGrid);

  const overviewCard = createCard("Suggestions feed");
  const suggRow = sliderRow("Suggestions", 1, 10, game.suggestionsLimit, 1, (v)=>game.setSuggestionsLimit(v));
  overviewCard.appendChild(suggRow);
  wordsGrid.appendChild(overviewCard);

  const myCard = createCard("My turn preferences");
  const foulSelfRow = mkRow("Foul words (me)", () => game.toggleFoulMode(), () => game.foulMode);
  myCard.appendChild(foulSelfRow);
  const lenRowMain = mkRow("Target length", ()=>game.toggleLengthMode(), ()=>game.lengthMode);
  myCard.appendChild(lenRowMain);
  const lenSliderMain = sliderRow("Length", 3, 20, game.targetLen, 1, (v)=>game.setTargetLen(v));
  myCard.appendChild(lenSliderMain);
  const lenNoticeMain = noticeBar();
  myCard.appendChild(lenNoticeMain);

  const noteSelf = noticeBar();
  myCard.appendChild(noteSelf);

  const myTitle = document.createElement("div");
  myTitle.textContent = "My top picks";
  Object.assign(myTitle.style, { fontWeight:800, fontSize:"15px" });
  myCard.appendChild(myTitle);
  const myPicks = listBox(22);
  myCard.appendChild(myPicks);
  wordsGrid.appendChild(myCard);

  const specCard = createCard("Spectator spotlight");
  const specFoulRow = mkRow("Foul words", ()=>game.toggleSpecFoul(), ()=>game.specFoulMode);
  specCard.appendChild(specFoulRow);
  const specLenRow = mkRow("Target length", ()=>game.toggleSpecLength(), ()=>game.specLengthMode);
  specCard.appendChild(specLenRow);
  const specLenSlider = sliderRow("Length", 3, 20, game.specTargetLen, 1, (v)=>game.setSpecTargetLen(v));
  specCard.appendChild(specLenSlider);

  const noteSpec = noticeBar();
  specCard.appendChild(noteSpec);

  const specTitle = document.createElement("div");
  specTitle.textContent = "Spectator suggestions";
  Object.assign(specTitle.style, { fontWeight:800, fontSize:"15px" });
  specCard.appendChild(specTitle);
  const specList = listBox(22);
  specCard.appendChild(specList);
  wordsGrid.appendChild(specCard);

  // update lists when suggestion slider changes
  suggRow._range.addEventListener("input", () => {
    if (game.myTurn) {
      game.lastTopPicksSelf = game.getTopCandidates(game.syllable, game.suggestionsLimit);
    } else if (game.lastSpectatorSyllable) {
      game.generateSpectatorSuggestions(game.lastSpectatorSyllable, game.suggestionsLimit);
    }
    render();
  });

  function toneStyle(tone) {
    if (tone === "foul") return { bg:"rgba(248,113,113,0.18)", border:"rgba(248,113,113,0.55)", color:"#fecaca" };
    if (tone === "lengthExact") return { bg:"rgba(74,222,128,0.18)", border:"rgba(74,222,128,0.55)", color:"#bbf7d0" };
    if (tone === "lengthFlex") return { bg:"rgba(251,191,36,0.18)", border:"rgba(251,191,36,0.55)", color:"#fde68a" };
    return { bg:"rgba(255,255,255,0.08)", border:"rgba(255,255,255,0.18)", color:"#f8fafc" };
  }

  function clickableWords(container, entries, syllable) {
    container.innerHTML = "";
    if (!entries || !entries.length) { container.textContent = "(none)"; return; }
    const syl = (syllable || "").toLowerCase();
    entries.forEach((entry) => {
      const word = typeof entry === "string" ? entry : entry.word;
      const tone = typeof entry === "string" ? "default" : entry.tone || "default";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = Game.highlightSyllable(word, syl);
      btn.title = "Click to copy";
      const styles = toneStyle(tone);
      Object.assign(btn.style, {
        cursor:"pointer",
        borderRadius:"999px",
        padding:"6px 12px",
        border:`1px solid ${styles.border}`,
        background:styles.bg,
        color:styles.color,
        fontWeight:"700",
        fontSize:"0.92em",
        transition:"transform 0.15s ease, background 0.15s ease",
        display:"inline-flex",
        alignItems:"center",
        justifyContent:"center"
      });
      btn.addEventListener("mouseenter", ()=>{ btn.style.transform = "translateY(-1px)"; });
      btn.addEventListener("mouseleave", ()=>{ btn.style.transform = "none"; });
      btn.addEventListener("click", async () => {
        const ok = await copyPlain(word);
        btn.style.boxShadow = ok ? "0 0 0 2px rgba(34,197,94,0.45)" : "0 0 0 2px rgba(239,68,68,0.45)";
        setTimeout(()=>{ btn.style.boxShadow = "none"; }, 420);
      });
      container.appendChild(btn);
    });
  }

  function renderCoverageGrid() {
    grid.innerHTML = "";
    const counts = game.coverageCounts || new Array(26).fill(0);
    const targets = game.targetCounts || new Array(26).fill(1);
    for (let i = 0; i < 26; i++) {
      const box = document.createElement("div");
      Object.assign(box.style, {
        padding:"6px 6px 8px",
        borderRadius:"8px",
        border:"1px solid rgba(255,255,255,0.18)",
        background:"rgba(255,255,255,0.05)",
      });
      const top = document.createElement("div");
      const letter = String.fromCharCode(97+i);
      const target = game.excludeEnabled ? targets[i] : 1;
      const have = Math.min(counts[i] || 0, target);
      top.textContent = target<=0 ? `${letter} (excluded)` : `${letter} ${have}/${target}`;
      Object.assign(top.style, { fontWeight:800, marginBottom:"4px", color: target<=0 ? "#9ca3af" : "#fff", textDecoration: target<=0 ? "line-through" : "none" });
      const bar = document.createElement("div");
      Object.assign(bar.style, { height:"6px", width:"100%", borderRadius:"999px", background:"rgba(255,255,255,0.1)", overflow:"hidden" });
      const fill = document.createElement("div");
      const pct = target>0 ? Math.round((have/target)*100) : 0;
      Object.assign(fill.style, { height:"100%", width:`${pct}%`, background: pct>=100 ? "rgba(34,197,94,0.9)" : "rgba(250,204,21,0.85)" });
      bar.appendChild(fill);
      box.appendChild(top); box.appendChild(bar);
      grid.appendChild(box);
    }
  }

  function buildNotice(context) {
    const roundNow = context==="self" ? game.selfRound : game.spectatorRound;
    const flagsRound = context==="self" ? game.flagsRoundSelf : game.flagsRoundSpectator;
    if (flagsRound !== roundNow) return "";

    const foulFallback   = context==="self" ? game.lastFoulFallbackSelf : game.lastFoulFallbackSpectator;
    const lenFallback    = context==="self" ? game.lastLenFallbackSelf : game.lastLenFallbackSpectator;
    const capApplied     = context==="self" ? game.lastLenCapAppliedSelf : game.lastLenCapAppliedSpectator;
    const capRelaxed     = context==="self" ? game.lastLenCapRelaxedSelf : game.lastLenCapRelaxedSpectator;
    const lenSuppressed  = context==="self" ? game.lastLenSuppressedByFoulSelf : game.lastLenSuppressedByFoulSpectator;

    const parts = [];
    if ((context==="self" && game.foulMode) || (context==="spectator" && game.specFoulMode)) {
      if (foulFallback) parts.push("No foul words matched this prompt; using the normal word list.");
    }
    if (context==="self" && game.lengthMode && game.coverageMode && capApplied)
      parts.push(`Limiting to words of <= ${game.targetLen} letters while maximizing alphabet coverage.`);
    if (context==="self" && game.lengthMode && game.coverageMode && capRelaxed)
      parts.push(`No words of <= ${game.targetLen} letters found; using best coverage regardless of length.`);
    if ((context==="self" && game.lengthMode && !game.coverageMode) ||
        (context==="spectator" && game.specLengthMode)) {
      if (lenFallback) parts.push(`No words with exactly ${context==="self"?game.targetLen:game.specTargetLen} letters; trying nearby lengths.`);
      if (lenSuppressed) parts.push("Target length ignored because foul words are available for this prompt.");
    }
    return parts.join(" ");
  }

  function render() {
    rows.forEach(r => applyToggleBtn(r._btn, r._get()));
    applyToggleBtn(foulSelfRow._btn, game.foulMode);
    applyToggleBtn(lenRowMain._btn, game.lengthMode);
    applyToggleBtn(preTop._btn, game.preMsgEnabled);
    applyToggleBtn(postTop._btn, game.postfixEnabled);
    applyToggleBtn(exTop._btn, game.excludeEnabled);
    applyToggleBtn(coverageToggle._btn, game.coverageMode);

    renderCoverageGrid();

    // Length notice
    if (game.lengthMode && (game.coverageMode || game.foulMode)) {
      if (game.coverageMode && game.foulMode) {
        lenNoticeMain._show(`Target Length: with coverage on it acts as a max (<= ${game.targetLen}); with foul words on it is used only if no foul words match.`);
      } else if (game.coverageMode) {
        lenNoticeMain._show(`Target Length: acts as a max (<= ${game.targetLen}) while optimizing alphabet coverage.`);
      } else {
        lenNoticeMain._show("Target Length: ignored when foul words are available; used only if no foul words match this prompt.");
      }
    } else {
      lenNoticeMain._show("");
    }
    const syl = (game.syllable || "").toLowerCase();
    clickableWords(myPicks, game.lastTopPicksSelfDisplay || game.lastTopPicksSelf, syl);
    if (!game.myTurn) {
      clickableWords(specList, game.spectatorSuggestionsDisplay || game.spectatorSuggestions, game.lastSpectatorSyllable || "");
    } else {
      specList.textContent = "(you are playing)";
    }

    // Spectator-tab specific toggles (render here so colors update)
    applyToggleBtn(specFoulRow._btn, game.specFoulMode);
    applyToggleBtn(specLenRow._btn, game.specLengthMode);

    // Notices
    noteSelf._show(buildNotice("self"));
    noteSpec._show(buildNotice("spectator"));
  }

  const iv = setInterval(render, 160);
  window.addEventListener("beforeunload", () => clearInterval(iv));

  document.body.appendChild(wrap);
  return { render };
}

async function setupBuddy() {
  // Inject page-side listener (emits myTurn/correct/fail events)
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("content/injected.js");
  s.onload = function () { this.remove(); };
  document.body.appendChild(s);

  const game = new Game(getInput());
  setTimeout(() => (game.input = getInput()), 1000);

  const { render } = createOverlay(game);

  window.addEventListener("message", async (event) => {
    if (!event.origin.endsWith("jklm.fun")) return;
    const data = event.data;

    if ("myTurn" in data) game.myTurn = data.myTurn;

    if (data.type === "setup") {
      await game.setLang(data.language);
      if (data.myTurn) {
        game.syllable = data.syllable;
        game.selfRound = (game.selfRound|0) + 1;     // new round for me
        game.lastTopPicksSelf = game.getTopCandidates(data.syllable, game.suggestionsLimit);
        if (!game.paused) game.playTurn().catch(err => console.error("[BombPartyShark] playTurn failed", err));
      } else {
        game.spectatorRound = (game.spectatorRound|0) + 1;
        game.generateSpectatorSuggestions(data.syllable, game.suggestionsLimit);
      }
      render();
    } else if (data.type === "correctWord") {
      game.onCorrectWord(data.word);
      render();
    } else if (data.type === "failWord") {
      game.onFailedWord(!!data.myTurn, data.word, data.reason);
      render();
    } else if (data.type === "nextTurn") {
      if (data.myTurn) {
        game.syllable = data.syllable;
        game.selfRound = (game.selfRound|0) + 1;     // new round for me
        game.lastTopPicksSelf = game.getTopCandidates(data.syllable, game.suggestionsLimit);
        if (!game.paused) game.playTurn().catch(err => console.error("[BombPartyShark] playTurn failed", err));
      } else {
        game.spectatorRound = (game.spectatorRound|0) + 1;
        game.generateSpectatorSuggestions(data.syllable, game.suggestionsLimit);
      }
      render();
    }
  });

  // hotkeys
  window.addEventListener("keydown", function (ev) {
    if (!ev.altKey) return;
    const k = ev.key.toLowerCase();
    if (k === "w") game.togglePause();
    else if (k === "arrowup") game.setSpeed(Math.min(12, game.speed+1));
    else if (k === "arrowdown") game.setSpeed(Math.max(1, game.speed-1));
    else if (k === "f") game.toggleFoulMode();
    else if (k === "c") game.toggleCoverageMode();
    else if (k === "s") game.toggleAutoSuicide();
    else if (k === "b") game.toggleMistakes();
    else if (k === "r") game.resetCoverage();
    else if (k === "t") game.toggleLengthMode();
  });
}

if (isBombPartyFrame()) setupBuddy();



















