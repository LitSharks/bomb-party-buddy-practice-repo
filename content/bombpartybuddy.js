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

  let coverageEditMode = "off"; // off | counts | targets

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
    if (name !== "Coverage") setCoverageEditMode("off", { quiet: true });
  };
  mainTabBtn.onclick = () => setActive("Main");
  covTabBtn.onclick  = () => setActive("Coverage");
  wordsTabBtn.onclick= () => setActive("Words");
  setActive("Words");

  // helpers
  const toggleThemes = {
    default: { onBg: "rgba(59,130,246,0.24)", onBorder: "rgba(59,130,246,0.55)", onColor: "#bfdbfe" },
    white:   { onBg: "rgba(248,250,252,0.28)", onBorder: "rgba(226,232,240,0.65)", onColor: "#f8fafc" },
    yellow:  { onBg: "rgba(253,224,71,0.24)", onBorder: "rgba(250,204,21,0.70)", onColor: "#facc15" },
    red:     { onBg: "rgba(248,113,113,0.26)", onBorder: "rgba(239,68,68,0.70)", onColor: "#fecaca" },
    green:   { onBg: "rgba(74,222,128,0.26)", onBorder: "rgba(34,197,94,0.65)", onColor: "#bbf7d0" },
    pink:    { onBg: "rgba(236,72,153,0.25)", onBorder: "rgba(244,114,182,0.68)", onColor: "#fce7f3" },
    teal:    { onBg: "rgba(45,212,191,0.26)", onBorder: "rgba(20,184,166,0.68)", onColor: "#ccfbf1" }
  };
  const toggleOff = { bg: "rgba(30,41,59,0.55)", border: "rgba(71,85,105,0.55)", color: "#cbd5f5" };

  const applyToggleStyle = (btn, on, scheme = "default", mode = "status") => {
    const theme = toggleThemes[scheme] || toggleThemes.default;
    btn.dataset.scheme = scheme;
    btn.dataset.mode = mode;
    const label = btn.dataset.label || btn.textContent || "";
    if (mode === "status") {
      btn.textContent = on ? "ON" : "OFF";
      btn.style.letterSpacing = "0.3px";
      btn.style.fontSize = "13px";
    } else {
      btn.textContent = label;
      btn.style.letterSpacing = "0.4px";
      btn.style.fontSize = "12px";
    }
    btn.style.background = on ? theme.onBg : toggleOff.bg;
    btn.style.border = `1px solid ${on ? theme.onBorder : toggleOff.border}`;
    btn.style.color = on ? theme.onColor : toggleOff.color;
    btn.style.fontWeight = "800";
    btn.style.borderRadius = "10px";
    btn.style.padding = "6px 12px";
    btn.style.cursor = "pointer";
    btn.style.minWidth = mode === "status" ? "64px" : "54px";
    btn.style.textAlign = "center";
    btn.style.transition = "background 0.15s ease, border 0.15s ease, color 0.15s ease";
    btn.style.boxShadow = on ? `0 0 0 1px ${theme.onBorder}` : "none";
  };
  const applyToggleBtn = (btn, on, scheme = "default", mode = "status") => applyToggleStyle(btn, !!on, scheme, mode);

  const mkRow = (label, onClick, getOn, scheme = "default", mode = "status") => {
    const r = document.createElement("div");
    Object.assign(r.style, { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", margin:"8px 0" });
    const span = document.createElement("span"); span.textContent = label; span.style.fontWeight = "600"; r.appendChild(span);
    const btn = document.createElement("button"); btn.onclick = () => { onClick(); render(); };
    r.appendChild(btn);
    btn.dataset.mode = mode;
    r._btn = btn; r._get = getOn; r._scheme = scheme; r._mode = mode;
    return r;
  };

  const mkDualRow = (label, configs) => {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display:"flex",
      alignItems:"center",
      justifyContent:"space-between",
      gap:"16px",
      flexWrap:"wrap",
      margin:"8px 0"
    });
    const span = document.createElement("span");
    span.textContent = label;
    span.style.fontWeight = "600";
    row.appendChild(span);
    const btnWrap = document.createElement("div");
    Object.assign(btnWrap.style, { display:"flex", gap:"8px", flexWrap:"wrap" });
    row.appendChild(btnWrap);
    row._buttons = [];
    configs.forEach(cfg => {
      const btn = document.createElement("button");
      btn.dataset.label = cfg.label;
      btn.dataset.mode = "label";
      btn.addEventListener("click", () => { cfg.onClick(); render(); });
      btnWrap.appendChild(btn);
      row._buttons.push({ btn, getOn: cfg.getOn, scheme: cfg.scheme || "default", mode: "label" });
    });
    return row;
  };

  function sliderRow(label, min, max, val, step, oninput, options = {}){
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
    const accent = options.accent || "#60a5fa";
    input.style.accentColor = accent;
    const valEl = document.createElement("span"); valEl.textContent = String(val); valEl.style.opacity = "0.9"; valEl.style.fontWeight = "700";
    if (options.valueColor) valEl.style.color = options.valueColor;
    input.addEventListener("input", (e)=>{ const v = step===1?parseInt(input.value,10):parseFloat(input.value); oninput(v); valEl.textContent = String(v); e.stopPropagation(); });
    row.appendChild(span); row.appendChild(input); row.appendChild(valEl);
    row._range = input;
    row._valueEl = valEl;
    return row;
  }
  function textInput(placeholder, value, oninput, options = {}){
    const wrap = document.createElement("div");
    const inp = document.createElement("input");
    inp.type = "text"; inp.placeholder = placeholder; inp.value = value || "";
    const baseStyle = { width:"100%", padding:"6px 8px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.06)", color:"#fff", fontWeight:"600" };
    if (options.theme === "pink") {
      Object.assign(baseStyle, { border:"1px solid rgba(244,114,182,0.65)", background:"rgba(236,72,153,0.15)", color:"#fdf2f8" });
    } else if (options.theme === "chrome") {
      Object.assign(baseStyle, { border:"1px solid rgba(226,232,240,0.35)", background:"linear-gradient(135deg, rgba(148,163,184,0.20), rgba(71,85,105,0.25))", color:"#f8fafc" });
    }
    Object.assign(inp.style, baseStyle);
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
    mkRow("AutoType", () => game.togglePause(), () => !game.paused, "white"),
    mkRow("Butterfingers", () => game.toggleMistakes(), () => game.mistakesEnabled, "yellow"),
    mkRow("Auto /suicide", () => game.toggleAutoSuicide(), () => game.autoSuicide, "red"),
  ];
  const toggleRefs = [...rows];
  const dualToggleRows = [];

  const mainGrid = document.createElement("div");
  Object.assign(mainGrid.style, { display:"grid", gap:"16px" });
  mainSec.appendChild(mainGrid);

  const automationCard = createCard("Automation");
  rows.forEach(r => automationCard.appendChild(r));
  mainGrid.appendChild(automationCard);

  const hudCard = createCard("HUD & Rhythm");
  hudCard.appendChild(sliderRow("HUD size", 20, 70, 45, 1, (v)=>{ hudScale = v/100; applyScale(); }, { accent: "#3b82f6", valueColor: "#93c5fd" }));
  hudCard.appendChild(sliderRow("Speed", 1, 12, game.speed, 1, (v)=>game.setSpeed(v), { accent: "#22c55e", valueColor: "#4ade80" }));
  hudCard.appendChild(sliderRow("Thinking delay (s)", 0, 5, game.thinkingDelaySec, 0.1, (v)=>game.setThinkingDelaySec(v), { accent: "#fb923c", valueColor: "#fdba74" }));
  hudCard.appendChild(sliderRow("Butterfingers (%)", 0, 30, Math.round(game.mistakesProb * 100), 1, (v)=>game.setMistakesProb(v/100), { accent: "#facc15", valueColor: "#facc15" }));
  mainGrid.appendChild(hudCard);

  const messageCard = createCard("Messages");
  Object.assign(messageCard.style, { background:"rgba(236,72,153,0.18)", border:"1px solid rgba(244,114,182,0.45)" });
  const preTop = mkRow("Premessage", ()=>game.setPreMsgEnabled(!game.preMsgEnabled), ()=>game.preMsgEnabled, "pink");
  toggleRefs.push(preTop);
  messageCard.appendChild(preTop);
  messageCard.appendChild(textInput("Message to flash before your word", game.preMsgText, (v)=>game.setPreMsgText(v), { theme:"pink" }));
  const postTop = mkRow("Postfix", ()=>game.setPostfixEnabled(!game.postfixEnabled), ()=>game.postfixEnabled, "pink");
  toggleRefs.push(postTop);
  messageCard.appendChild(postTop);
  messageCard.appendChild(textInput("Characters to append (e.g., <3)", game.postfixText, (v)=>game.setPostfixText(v), { theme:"pink" }));
  mainGrid.appendChild(messageCard);

  // =============== COVERAGE TAB =================
  const coverageCard = createCard("Alphabet mastery");
  Object.assign(coverageCard.style, {
    background:"linear-gradient(135deg, rgba(56,189,248,0.18), rgba(244,114,182,0.10), rgba(14,165,233,0.18))",
    border:"1px solid rgba(148,163,184,0.45)"
  });
  const coverageToggle = mkRow("Alphabet coverage", () => {
    setCoverageEditMode("off", { quiet: true });
    game.toggleCoverageMode();
  }, () => game.coverageMode, "teal");
  toggleRefs.push(coverageToggle);
  coverageCard.appendChild(coverageToggle);

  const exTop = mkRow("A-Z goals / exclusions", ()=>{
    setCoverageEditMode("off", { quiet: true });
    game.setExcludeEnabled(!game.excludeEnabled);
  }, ()=>game.excludeEnabled, "teal");
  toggleRefs.push(exTop);
  coverageCard.appendChild(exTop);

  const coverageEditRow = mkDualRow("Edit mode", [
    { label: "Tallies", onClick: () => setCoverageEditMode("counts"), getOn: () => coverageEditMode === "counts", scheme: "teal" },
    { label: "Goals", onClick: () => setCoverageEditMode("targets"), getOn: () => coverageEditMode === "targets", scheme: "teal" }
  ]);
  dualToggleRows.push(coverageEditRow);
  coverageCard.appendChild(coverageEditRow);

  const editHint = document.createElement("div");
  editHint.textContent = "";
  Object.assign(editHint.style, {
    display:"none",
    background:"rgba(14,165,233,0.12)",
    border:"1px solid rgba(125,211,252,0.35)",
    color:"#e0f2fe",
    borderRadius:"10px",
    padding:"6px 10px",
    fontSize:"12px",
    marginTop:"6px"
  });
  coverageCard.appendChild(editHint);

  const setAllWrap = document.createElement("div");
  Object.assign(setAllWrap.style, {
    display:"none",
    alignItems:"center",
    gap:"8px",
    marginTop:"8px",
    flexWrap:"wrap"
  });
  const setAllLabel = document.createElement("span");
  setAllLabel.style.fontWeight = "600";
  setAllLabel.textContent = "Set all to:";
  setAllWrap.appendChild(setAllLabel);
  const setAllInput = document.createElement("input");
  Object.assign(setAllInput, { type:"number", min:"0", max:"99" });
  Object.assign(setAllInput.style, {
    width:"72px",
    padding:"6px 8px",
    borderRadius:"8px",
    border:"1px solid rgba(148,163,184,0.5)",
    background:"rgba(15,23,42,0.6)",
    color:"#e2e8f0",
    fontWeight:"600"
  });
  setAllInput.inputMode = "numeric";
  setAllWrap.appendChild(setAllInput);
  const setAllBtn = document.createElement("button");
  setAllBtn.textContent = "Apply";
  Object.assign(setAllBtn.style, {
    padding:"6px 12px",
    borderRadius:"10px",
    border:"1px solid rgba(56,189,248,0.55)",
    background:"rgba(56,189,248,0.25)",
    color:"#e0f2fe",
    fontWeight:"700",
    cursor:"pointer"
  });
  setAllWrap.appendChild(setAllBtn);
  coverageCard.appendChild(setAllWrap);

  const clampAllValue = (value) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(99, n));
  };

  const applySetAllValue = () => {
    if (coverageEditMode === "off") return;
    const sanitized = clampAllValue(setAllInput.value);
    setAllInput.value = String(sanitized);
    if (coverageEditMode === "targets") {
      game.setAllTargetCounts(sanitized);
    } else {
      game.setAllCoverageCounts(sanitized);
    }
    renderCoverageGrid();
  };

  setAllBtn.addEventListener("click", applySetAllValue);
  setAllInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      applySetAllValue();
    }
  });
  setAllInput.addEventListener("blur", () => {
    if (setAllInput.value === "") return;
    setAllInput.value = String(clampAllValue(setAllInput.value));
  });

  function updateCoverageEditUi() {
    const mode = coverageEditMode;
    if (mode === "counts") {
      editHint.textContent = "Editing tallies: left click adds, right click removes. Tallies stay between 0 and each letter's goal.";
      setAllLabel.textContent = "Set all tallies to:";
      setAllBtn.textContent = "Apply tallies";
    } else if (mode === "targets") {
      editHint.textContent = "Editing goals: left click adds, right click removes, or type numbers in the boxes. Goals clamp between 0 and 99.";
      setAllLabel.textContent = "Set all goals to:";
      setAllBtn.textContent = "Apply goals";
    } else {
      editHint.textContent = "";
      setAllLabel.textContent = "Set all to:";
      setAllBtn.textContent = "Apply";
    }
    const active = mode !== "off";
    editHint.style.display = active ? "block" : "none";
    setAllWrap.style.display = active ? "flex" : "none";
    setAllBtn.disabled = !active;
    setAllInput.disabled = !active;
    setAllBtn.style.opacity = active ? "1" : "0.55";
    setAllBtn.style.cursor = active ? "pointer" : "not-allowed";
    setAllLabel.style.opacity = active ? "1" : "0.7";
  }

  function setCoverageEditMode(mode, options = {}) {
    const { quiet = false } = options;
    let next = mode;
    if (mode !== "counts" && mode !== "targets") {
      next = "off";
    } else if (mode === coverageEditMode && !options.force) {
      next = "off";
    }
    if (coverageEditMode === next) {
      updateCoverageEditUi();
      if (!quiet) renderCoverageGrid();
      return;
    }
    coverageEditMode = next;
    updateCoverageEditUi();
    renderCoverageGrid();
    if (!quiet) render();
  }

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
  Object.assign(resetBtn.style,{ padding:"8px 12px", borderRadius:"10px", cursor:"pointer", background:"rgba(15,118,110,0.32)", color:"#ccfbf1", border:"1px solid rgba(20,184,166,0.55)", fontWeight:"700" });
  resetBtn.onclick = ()=>{ setCoverageEditMode("off", { quiet: true }); game.resetCoverage(); };
  coverageCard.appendChild(resetBtn);

  covSec.appendChild(coverageCard);
  updateCoverageEditUi();

  // =============== WORDS TAB =================
  const wordsGrid = document.createElement("div");
  Object.assign(wordsGrid.style, { display:"grid", gap:"16px" });
  wordsSec.appendChild(wordsGrid);

  const overviewCard = createCard("Word targeting");
  const colorGuide = document.createElement("div");
  colorGuide.innerHTML = "🟥 foul • 🟩 matches target length • 🟨 nearby length • ⚪ regular <span style=\"font-size:10px; opacity:0.65; margin-left:6px;\">click me to go away</span>";
  Object.assign(colorGuide.style, {
    background:"rgba(15,23,42,0.55)",
    border:"1px solid rgba(148,163,184,0.35)",
    borderRadius:"12px",
    padding:"6px 10px",
    fontSize:"12px",
    color:"rgba(248,250,252,0.88)",
    cursor:"pointer",
    display:"inline-flex",
    flexWrap:"wrap",
    gap:"6px",
    alignItems:"center"
  });
  colorGuide.addEventListener("click", () => { colorGuide.style.display = "none"; });
  overviewCard.appendChild(colorGuide);

  const suggRow = sliderRow("Suggestions", 1, 10, game.suggestionsLimit, 1, (v)=>game.setSuggestionsLimit(v), { accent: "#e2e8f0", valueColor: "#cbd5f5" });
  overviewCard.appendChild(suggRow);

  const foulDualRow = mkDualRow("Foul words", [
    { label: "Me", onClick: () => game.toggleFoulMode(), getOn: () => game.foulMode, scheme: "red" },
    { label: "Spectator", onClick: () => game.toggleSpecFoul(), getOn: () => game.specFoulMode, scheme: "red" }
  ]);
  dualToggleRows.push(foulDualRow);
  overviewCard.appendChild(foulDualRow);

  const lenDualRow = mkDualRow("Target length", [
    { label: "Me", onClick: () => game.toggleLengthMode(), getOn: () => game.lengthMode, scheme: "green" },
    { label: "Spectator", onClick: () => game.toggleSpecLength(), getOn: () => game.specLengthMode, scheme: "green" }
  ]);
  dualToggleRows.push(lenDualRow);
  overviewCard.appendChild(lenDualRow);

  const lenSliderWrap = document.createElement("div");
  Object.assign(lenSliderWrap.style, { display:"grid", gap:"12px", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))" });
  const lenSliderMain = sliderRow("Me", 3, 20, game.targetLen, 1, (v)=>game.setTargetLen(v), { accent: "#22c55e", valueColor: "#86efac" });
  const specLenSlider = sliderRow("Spectator", 3, 20, game.specTargetLen, 1, (v)=>game.setSpecTargetLen(v), { accent: "#22c55e", valueColor: "#86efac" });
  lenSliderWrap.appendChild(lenSliderMain);
  lenSliderWrap.appendChild(specLenSlider);
  overviewCard.appendChild(lenSliderWrap);

  const lenNoticeMain = noticeBar();
  overviewCard.appendChild(lenNoticeMain);
  wordsGrid.appendChild(overviewCard);

  const suggestionsCard = createCard("Live suggestions");
  const dynamicTitle = document.createElement("div");
  Object.assign(dynamicTitle.style, { fontWeight:800, fontSize:"15px" });
  suggestionsCard.appendChild(dynamicTitle);

  const turnNotice = noticeBar();
  suggestionsCard.appendChild(turnNotice);

  const wordList = listBox(22);
  suggestionsCard.appendChild(wordList);
  wordsGrid.appendChild(suggestionsCard);

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
        position:"relative"
      });
      if (coverageEditMode !== "off") {
        box.style.cursor = "pointer";
        box.style.boxShadow = "0 0 0 1px rgba(96,165,250,0.45)";
      } else {
        box.style.cursor = "default";
        box.style.boxShadow = "none";
      }

      const letter = String.fromCharCode(97 + i);
      const actualTarget = Math.max(0, Math.floor(targets[i] || 0));
      const shownTarget = actualTarget;
      const currentCount = Math.max(0, Math.floor(counts[i] || 0));
      const limitedCount = shownTarget > 0 ? Math.min(currentCount, shownTarget) : 0;

      const top = document.createElement("div");
      if (actualTarget <= 0) {
        top.textContent = `${letter} (excluded)`;
      } else {
        top.textContent = `${letter} ${limitedCount}/${shownTarget}`;
      }
      Object.assign(top.style, {
        fontWeight:800,
        marginBottom:"4px",
        color: actualTarget <= 0 ? "#9ca3af" : "#fff",
        textDecoration: actualTarget <= 0 ? "line-through" : "none"
      });
      box.appendChild(top);

      const bar = document.createElement("div");
      Object.assign(bar.style, { height:"6px", width:"100%", borderRadius:"999px", background:"rgba(255,255,255,0.1)", overflow:"hidden" });
      const fill = document.createElement("div");
      const pct = shownTarget > 0 ? Math.min(100, Math.round((limitedCount / shownTarget) * 100)) : 0;
      Object.assign(fill.style, { height:"100%", width:`${pct}%`, background: pct>=100 ? "rgba(34,197,94,0.9)" : "rgba(250,204,21,0.85)" });
      bar.appendChild(fill);
      box.appendChild(bar);

      if (coverageEditMode !== "off") {
        const applyDelta = (delta) => {
          if (coverageEditMode === "counts") {
            game.adjustCoverageCountAt(i, delta);
          } else if (coverageEditMode === "targets") {
            const next = Math.floor((game.targetCounts[i] || 0)) + delta;
            game.setTargetCountAt(i, next);
          }
        };
        box.addEventListener("click", (ev) => {
          if (coverageEditMode === "off") return;
          ev.preventDefault();
          applyDelta(1);
          renderCoverageGrid();
        });
        box.addEventListener("contextmenu", (ev) => {
          if (coverageEditMode === "off") return;
          ev.preventDefault();
          applyDelta(-1);
          renderCoverageGrid();
        });

        if (coverageEditMode === "targets") {
          const goalInput = document.createElement("input");
          Object.assign(goalInput, { type:"number", min:"0", max:"99" });
          Object.assign(goalInput.style, {
            marginTop:"6px",
            width:"100%",
            borderRadius:"8px",
            border:"1px solid rgba(148,163,184,0.45)",
            background:"rgba(15,23,42,0.72)",
            color:"#e2e8f0",
            fontWeight:"600",
            padding:"6px 8px"
          });
          goalInput.value = String(actualTarget);
          goalInput.inputMode = "numeric";
          goalInput.addEventListener("click", (ev) => ev.stopPropagation());
          goalInput.addEventListener("contextmenu", (ev) => ev.preventDefault());
          const syncInput = () => {
            goalInput.value = String(Math.max(0, Math.floor(game.targetCounts[i] || 0)));
          };
          goalInput.addEventListener("change", () => {
            const raw = Math.floor(Number(goalInput.value));
            if (!Number.isFinite(raw)) { syncInput(); return; }
            const next = Math.max(0, Math.min(99, raw));
            game.setTargetCountAt(i, next);
            syncInput();
            renderCoverageGrid();
          });
          goalInput.addEventListener("blur", () => {
            const raw = Math.floor(Number(goalInput.value));
            const next = Number.isFinite(raw) ? Math.max(0, Math.min(99, raw)) : Math.max(0, Math.floor(game.targetCounts[i] || 0));
            game.setTargetCountAt(i, next);
            syncInput();
            renderCoverageGrid();
          });
          box.appendChild(goalInput);
        }
      }

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
    toggleRefs.forEach(row => applyToggleBtn(row._btn, row._get(), row._scheme, row._mode));
    dualToggleRows.forEach(row => {
      row._buttons.forEach(info => applyToggleBtn(info.btn, info.getOn(), info.scheme, info.mode));
    });

    updateCoverageEditUi();
    renderCoverageGrid();

    const updateSlider = (row, value) => {
      if (!row || !row._range) return;
      const str = String(value);
      if (row._range.value !== str) row._range.value = str;
      if (row._valueEl && row._valueEl.textContent !== str) row._valueEl.textContent = str;
    };
    updateSlider(lenSliderMain, game.targetLen);
    updateSlider(specLenSlider, game.specTargetLen);
    updateSlider(suggRow, game.suggestionsLimit);

    const noticeParts = [];
    if (game.lengthMode) {
      if (game.coverageMode && game.foulMode) {
        noticeParts.push(`Target length (me): with coverage on it acts as a max (<= ${game.targetLen}); foul words still take priority.`);
      } else if (game.coverageMode) {
        noticeParts.push(`Target length (me): acts as a max (<= ${game.targetLen}) while optimizing alphabet coverage.`);
      } else if (game.foulMode) {
        noticeParts.push("Target length (me): ignored when foul words are available; used only if none match.");
      } else {
        noticeParts.push("Target length (me): exact matches show green, nearby lengths appear in yellow when needed.");
      }
    }
    if (game.specLengthMode) {
      if (game.specFoulMode) {
        noticeParts.push("Target length (spectator): ignored whenever foul words are available for the prompt.");
      } else {
        noticeParts.push("Target length (spectator): exact matches show green; nearby lengths are marked in yellow.");
      }
    }
    lenNoticeMain._show(noticeParts.join(" "));

    const isMyTurn = !!game.myTurn;
    dynamicTitle.textContent = isMyTurn ? "My top picks" : "Spectator suggestions";
    const entries = isMyTurn
      ? ((game.lastTopPicksSelfDisplay && game.lastTopPicksSelfDisplay.length) ? game.lastTopPicksSelfDisplay : game.lastTopPicksSelf)
      : ((game.spectatorSuggestionsDisplay && game.spectatorSuggestionsDisplay.length) ? game.spectatorSuggestionsDisplay : game.spectatorSuggestions);
    const syllable = isMyTurn ? (game.syllable || "") : (game.lastSpectatorSyllable || "");
    clickableWords(wordList, entries, syllable);

    const noticeContext = isMyTurn ? "self" : "spectator";
    turnNotice._show(buildNotice(noticeContext));
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


















