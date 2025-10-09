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
  const togglePalettes = {
    neutral: {
      on:   { background: "rgba(59,130,246,0.24)", border: "rgba(59,130,246,0.55)", color: "#dbeafe" },
      off:  { background: "rgba(30,41,59,0.55)",  border: "rgba(148,163,184,0.28)", color: "#e2e8f0" }
    },
    ivory: {
      on:   { background: "rgba(255,255,255,0.82)", border: "rgba(255,255,255,0.72)", color: "#111827", shadow: "0 4px 14px rgba(255,255,255,0.15)" },
      off:  { background: "rgba(148,163,184,0.16)", border: "rgba(148,163,184,0.32)", color: "#e2e8f0" }
    },
    amber: {
      on:   { background: "rgba(251,191,36,0.26)", border: "rgba(251,191,36,0.60)", color: "#fde68a", shadow: "0 0 18px rgba(251,191,36,0.22)" },
      off:  { background: "rgba(120,53,15,0.28)", border: "rgba(217,119,6,0.45)", color: "#fcd34d" }
    },
    crimson: {
      on:   { background: "rgba(220,38,38,0.32)", border: "rgba(220,38,38,0.60)", color: "#fecaca", shadow: "0 0 18px rgba(220,38,38,0.25)" },
      off:  { background: "rgba(76,29,29,0.38)", border: "rgba(127,29,29,0.48)", color: "#fca5a5" }
    },
    length: {
      on:   { background: "rgba(34,197,94,0.26)", border: "rgba(34,197,94,0.58)", color: "#bbf7d0", shadow: "0 0 18px rgba(34,197,94,0.22)" },
      off:  { background: "rgba(15,57,37,0.36)", border: "rgba(34,197,94,0.32)", color: "#86efac" }
    },
    pink: {
      on:   { background: "rgba(236,72,153,0.30)", border: "rgba(236,72,153,0.62)", color: "#fbcfe8", shadow: "0 0 18px rgba(236,72,153,0.25)" },
      off:  { background: "rgba(120,15,57,0.36)", border: "rgba(236,72,153,0.32)", color: "#f472b6" }
    },
    cobalt: {
      on:   { background: "rgba(14,165,233,0.26)", border: "rgba(56,189,248,0.58)", color: "#bae6fd" },
      off:  { background: "rgba(12,74,110,0.36)", border: "rgba(14,165,233,0.32)", color: "#38bdf8" }
    }
  };

  function styleToggleButton(btn, on, paletteName, labelFn, options = {}) {
    const palette = togglePalettes[paletteName] || togglePalettes.neutral;
    const state = on ? palette.on : palette.off;
    const label = labelFn ? labelFn(on) : (on ? "ON" : "OFF");
    btn.textContent = label;
    btn.style.background = state.background;
    btn.style.border = `1px solid ${state.border}`;
    btn.style.color = state.color;
    btn.style.fontWeight = "800";
    btn.style.borderRadius = "999px";
    btn.style.padding = options.padding || "6px 14px";
    btn.style.cursor = "pointer";
    btn.style.minWidth = options.minWidth || "72px";
    btn.style.textAlign = "center";
    btn.style.boxShadow = state.shadow || "none";
    btn.style.transition = "transform 0.18s ease, box-shadow 0.18s ease";
  }

  const mkRow = (label, onClick, getOn, palette = "neutral", options = {}) => {
    const r = document.createElement("div");
    Object.assign(r.style, { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", margin:"8px 0" });
    const span = document.createElement("span"); span.textContent = label; span.style.fontWeight = "600"; r.appendChild(span);
    const btn = document.createElement("button"); btn.onclick = () => { onClick(); render(); };
    btn.addEventListener("mouseenter", ()=>{ btn.style.transform = "translateY(-1px)"; });
    btn.addEventListener("mouseleave", ()=>{ btn.style.transform = "none"; });
    r.appendChild(btn);
    r._btn = btn; r._get = getOn; r._palette = palette; r._toggleOpts = options;
    return r;
  };

  function dualToggleRow(label, configs) {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      margin: "8px 0"
    });
    const title = document.createElement("span");
    title.textContent = label;
    title.style.fontWeight = "700";
    row.appendChild(title);
    const btnWrap = document.createElement("div");
    Object.assign(btnWrap.style, { display:"flex", gap:"10px", flexWrap:"wrap" });
    const meta = configs.map(cfg => {
      const btn = document.createElement("button");
      btn.textContent = cfg.label;
      btn.addEventListener("mouseenter", ()=>{ btn.style.transform = "translateY(-1px)"; });
      btn.addEventListener("mouseleave", ()=>{ btn.style.transform = "none"; });
      btn.onclick = () => { cfg.toggle(); render(); };
      btnWrap.appendChild(btn);
      return { btn, cfg };
    });
    row.appendChild(btnWrap);
    row._buttons = meta;
    return row;
  }

  function refreshRow(row) {
    if (!row || !row._btn || typeof row._get !== "function") return;
    const value = row._get();
    styleToggleButton(row._btn, !!value, row._palette, undefined, row._toggleOpts);
  }

  function refreshDual(row) {
    if (!row || !Array.isArray(row._buttons)) return;
    row._buttons.forEach(({ btn, cfg }) => {
      if (!btn || !cfg || typeof cfg.get !== "function") return;
      const palette = cfg.palette || "neutral";
      const value = cfg.get();
      styleToggleButton(btn, !!value, palette, (on) => on ? `${cfg.label} ✓` : cfg.label, {
        minWidth: cfg.compact ? "0" : undefined,
        padding: cfg.compact ? "6px 14px" : undefined
      });
    });
  }

  function sliderRow(label, min, max, val, step, oninput, options = {}){
    const row = document.createElement("div");
    Object.assign(row.style, {
      display:"grid",
      gridTemplateColumns:"auto 1fr auto",
      alignItems:"center",
      gap:"14px",
      margin:"10px 0"
    });
    const span = document.createElement("span");
    span.textContent = label;
    span.style.fontWeight = "700";
    span.style.letterSpacing = "0.3px";
    span.style.color = options.labelColor || "#f8fafc";
    const input = document.createElement("input");
    input.type = "range"; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(val);
    Object.assign(input.style, {
      accentColor: options.accent || "#60a5fa",
      height: "4px"
    });
    const valEl = document.createElement("span"); valEl.textContent = String(val); valEl.style.opacity = "0.9"; valEl.style.fontWeight = "700";
    valEl.style.color = options.valueColor || "#e2e8f0";
    input.addEventListener("input", (e)=>{ const v = step===1?parseInt(input.value,10):parseFloat(input.value); oninput(v); valEl.textContent = String(v); e.stopPropagation(); });
    row.appendChild(span); row.appendChild(input); row.appendChild(valEl);
    row._range = input;
    return row;
  }
  function textInput(placeholder, value, oninput, options = {}){
    const wrap = document.createElement("div");
    const inp = document.createElement("input");
    inp.type = "text"; inp.placeholder = placeholder; inp.value = value || "";
    Object.assign(inp.style, {
      width:"100%",
      padding:"8px 10px",
      borderRadius:"10px",
      border: options.border || "1px solid rgba(255,255,255,0.25)",
      background: options.background || "rgba(255,255,255,0.06)",
      color: options.color || "#fff",
      fontWeight:"600",
      letterSpacing:"0.2px"
    });
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
    mkRow("AutoType", () => game.togglePause(), () => !game.paused, "ivory", { minWidth: "96px", padding: "6px 18px" }),
    mkRow("Butterfingers", () => game.toggleMistakes(), () => game.mistakesEnabled, "amber", { minWidth: "120px" }),
    mkRow("Auto /suicide", () => game.toggleAutoSuicide(), () => game.autoSuicide, "crimson", { minWidth: "120px" }),
  ];

  const mainGrid = document.createElement("div");
  Object.assign(mainGrid.style, { display:"grid", gap:"16px" });
  mainSec.appendChild(mainGrid);

  const automationCard = createCard("Automation");
  rows.forEach(r => automationCard.appendChild(r));
  mainGrid.appendChild(automationCard);

  const hudCard = createCard("HUD & Rhythm");
  hudCard.appendChild(sliderRow("HUD size", 20, 70, 45, 1, (v)=>{ hudScale = v/100; applyScale(); }, {
    accent: "#38bdf8",
    valueColor: "#bae6fd",
    labelColor: "#e0f2fe"
  }));
  hudCard.appendChild(sliderRow("Speed", 1, 12, game.speed, 1, (v)=>game.setSpeed(v), {
    accent: "#22c55e",
    valueColor: "#bbf7d0",
    labelColor: "#bbf7d0"
  }));
  hudCard.appendChild(sliderRow("Thinking delay (s)", 0, 5, game.thinkingDelaySec, 0.1, (v)=>game.setThinkingDelaySec(v), {
    accent: "#fb923c",
    valueColor: "#fed7aa",
    labelColor: "#fed7aa"
  }));
  hudCard.appendChild(sliderRow("Butterfingers (%)", 0, 30, Math.round(game.mistakesProb * 100), 1, (v)=>game.setMistakesProb(v/100), {
    accent: "#facc15",
    valueColor: "#fde68a",
    labelColor: "#fde68a"
  }));
  mainGrid.appendChild(hudCard);

  const messageCard = createCard("Messages");
  Object.assign(messageCard.style, {
    background: "linear-gradient(140deg, rgba(76,29,149,0.58), rgba(190,24,93,0.52))",
    border: "1px solid rgba(244,114,182,0.45)"
  });
  const preTop = mkRow("Premessage", ()=>game.setPreMsgEnabled(!game.preMsgEnabled), ()=>game.preMsgEnabled, "pink");
  messageCard.appendChild(preTop);
  messageCard.appendChild(textInput("Message to flash before your word", game.preMsgText, (v)=>game.setPreMsgText(v), {
    background: "rgba(236,72,153,0.18)",
    border: "1px solid rgba(244,114,182,0.55)",
    color: "#fde2f3"
  }));
  const postTop = mkRow("Postfix", ()=>game.setPostfixEnabled(!game.postfixEnabled), ()=>game.postfixEnabled, "pink");
  messageCard.appendChild(postTop);
  messageCard.appendChild(textInput("Characters to append (e.g., <3)", game.postfixText, (v)=>game.setPostfixText(v), {
    background: "rgba(236,72,153,0.18)",
    border: "1px solid rgba(244,114,182,0.55)",
    color: "#fde2f3"
  }));
  mainGrid.appendChild(messageCard);

  // =============== COVERAGE TAB =================
  const coverageCard = createCard("Alphabet mastery");
  Object.assign(coverageCard.style, {
    background: "linear-gradient(145deg, rgba(30,41,59,0.78), rgba(79,70,229,0.24))",
    border: "1px solid rgba(129,140,248,0.32)"
  });
  const coverageToggle = mkRow("Alphabet coverage", () => game.toggleCoverageMode(), () => game.coverageMode, "cobalt");
  coverageCard.appendChild(coverageToggle);

  const exTop = mkRow("A-Z goals / exclusions", ()=>game.setExcludeEnabled(!game.excludeEnabled), ()=>game.excludeEnabled, "cobalt");
  coverageCard.appendChild(exTop);

  const help = document.createElement("div");
  help.innerHTML = "Format examples: <b>a3 f2 c8 x0 z0</b> (0 = exclude). You can also set <b>majority5</b> to set a default for all letters; explicit tokens like <b>a3</b> override the majority.";
  Object.assign(help.style, { color:"rgba(255,255,255,0.78)", fontSize:"12px" });
  coverageCard.appendChild(help);

  const exInputWrap = textInput("a3 f2 c8 x0 z0  majority0", game.excludeSpec || "x0 z0", (v)=>game.setExcludeSpec(v), {
    background: "rgba(59,130,246,0.18)",
    border: "1px solid rgba(129,140,248,0.45)",
    color: "#dbeafe"
  });
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
  Object.assign(wordsGrid.style, { display:"flex", flexDirection:"column", gap:"16px" });
  wordsSec.appendChild(wordsGrid);

  const strategyCard = createCard("Word strategy");
  Object.assign(strategyCard.style, {
    background: "linear-gradient(148deg, rgba(17,24,39,0.92), rgba(30,41,59,0.78))",
    border: "1px solid rgba(148,163,184,0.35)"
  });
  const suggRow = sliderRow("Suggestions", 1, 10, game.suggestionsLimit, 1, (v)=>game.setSuggestionsLimit(v), {
    accent: "#38bdf8",
    valueColor: "#bae6fd",
    labelColor: "#e0f2fe"
  });
  strategyCard.appendChild(suggRow);

  const foulDual = dualToggleRow("Foul words", [
    { label: "Me", palette: "crimson", get: () => game.foulMode, toggle: () => game.toggleFoulMode(), compact: true },
    { label: "Spectator", palette: "crimson", get: () => game.specFoulMode, toggle: () => game.toggleSpecFoul(), compact: true }
  ]);
  strategyCard.appendChild(foulDual);

  const lengthDual = dualToggleRow("Target length", [
    { label: "Me", palette: "length", get: () => game.lengthMode, toggle: () => game.toggleLengthMode(), compact: true },
    { label: "Spectator", palette: "length", get: () => game.specLengthMode, toggle: () => game.toggleSpecLength(), compact: true }
  ]);
  strategyCard.appendChild(lengthDual);

  const lenWrap = document.createElement("div");
  Object.assign(lenWrap.style, {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px"
  });
  const lenSliderMain = sliderRow("Me", 3, 20, game.targetLen, 1, (v)=>game.setTargetLen(v), {
    accent: "#22c55e",
    valueColor: "#bbf7d0",
    labelColor: "#bbf7d0"
  });
  const lenSliderSpec = sliderRow("Spectator", 3, 20, game.specTargetLen, 1, (v)=>game.setSpecTargetLen(v), {
    accent: "#4ade80",
    valueColor: "#dcfce7",
    labelColor: "#dcfce7"
  });
  lenWrap.appendChild(lenSliderMain);
  lenWrap.appendChild(lenSliderSpec);
  strategyCard.appendChild(lenWrap);

  const lenNoticeMain = noticeBar();
  strategyCard.appendChild(lenNoticeMain);

  wordsGrid.appendChild(strategyCard);

  const suggestionsCard = createCard("Live suggestions");
  Object.assign(suggestionsCard.style, {
    background: "linear-gradient(160deg, rgba(15,23,42,0.9), rgba(17,24,39,0.82))",
    border: "1px solid rgba(148,163,184,0.28)"
  });
  const suggestionTitle = document.createElement("div");
  Object.assign(suggestionTitle.style, { fontWeight:800, fontSize:"15px", letterSpacing:"0.3px" });
  suggestionTitle.textContent = "My top picks";
  suggestionsCard.appendChild(suggestionTitle);

  const colorLegend = document.createElement("div");
  colorLegend.innerHTML = `
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
      <span>🟥 foul priority</span>
      <span>🟩 target length</span>
      <span>🟨 nearby length</span>
      <span>⬜ standard</span>
    </div>
    <span style="font-size:11px;opacity:0.72;display:block;margin-top:4px;">click anywhere to hide</span>
  `;
  Object.assign(colorLegend.style, {
    background: "rgba(45,212,191,0.16)",
    borderRadius: "12px",
    padding: "10px 12px",
    cursor: "pointer",
    color: "#e0f2fe",
    border: "1px solid rgba(45,212,191,0.35)",
    fontSize: "12px",
    lineHeight: "1.4"
  });
  colorLegend.addEventListener("click", () => {
    colorLegend.style.display = "none";
  });
  suggestionsCard.appendChild(colorLegend);

  const sharedNotice = noticeBar();
  suggestionsCard.appendChild(sharedNotice);

  const sharedList = listBox(24);
  suggestionsCard.appendChild(sharedList);

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
        padding:"10px 18px",
        border:`1px solid ${styles.border}`,
        background:styles.bg,
        color:styles.color,
        fontWeight:"800",
        fontSize:"1.08em",
        letterSpacing:"0.4px",
        transition:"transform 0.18s ease, box-shadow 0.18s ease",
        display:"inline-flex",
        alignItems:"center",
        justifyContent:"center",
        minWidth:"80px",
        boxShadow:"0 6px 18px rgba(15,23,42,0.28)"
      });
      btn.addEventListener("mouseenter", ()=>{ btn.style.transform = "translateY(-1px) scale(1.02)"; });
      btn.addEventListener("mouseleave", ()=>{ btn.style.transform = "none"; });
      btn.addEventListener("click", async () => {
        const ok = await copyPlain(word);
        btn.style.boxShadow = ok ? "0 0 0 3px rgba(34,197,94,0.55)" : "0 0 0 3px rgba(239,68,68,0.55)";
        setTimeout(()=>{ btn.style.boxShadow = "0 6px 18px rgba(15,23,42,0.28)"; }, 420);
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
    rows.forEach(refreshRow);
    refreshRow(preTop);
    refreshRow(postTop);
    refreshRow(exTop);
    refreshRow(coverageToggle);

    refreshDual(foulDual);
    refreshDual(lengthDual);

    renderCoverageGrid();

    const lenMessages = [];
    if (game.lengthMode) {
      if (game.coverageMode && game.foulMode) {
        lenMessages.push(`Me: foul reds lead, coverage keeps picks at ≤ ${game.targetLen}. Yellows appear when only nearby lengths exist.`);
      } else if (game.coverageMode) {
        lenMessages.push(`Me: coverage caps picks at ≤ ${game.targetLen}; yellows mark shorter fallbacks.`);
      } else if (game.foulMode) {
        lenMessages.push(`Me: reds beat greens. Greens hit ${game.targetLen}, yellows are nearby backups.`);
      } else {
        lenMessages.push(`Me: greens match ${game.targetLen}; yellows show ± length fallbacks.`);
      }
    }
    if (game.specLengthMode) {
      if (game.specFoulMode) {
        lenMessages.push(`Spectator: reds fill first, then greens at ${game.specTargetLen}; yellows stretch to close matches.`);
      } else {
        lenMessages.push(`Spectator: greens mean ${game.specTargetLen} letters, yellows are nearby.`);
      }
    }
    lenNoticeMain._show(lenMessages.join(" "));

    const activeContext = game.myTurn ? "self" : "spectator";
    const entries = game.myTurn
      ? (game.lastTopPicksSelfDisplay || game.lastTopPicksSelf)
      : (game.spectatorSuggestionsDisplay || game.spectatorSuggestions);
    suggestionTitle.textContent = game.myTurn ? "My top picks" : "Spectator suggestions";
    const syllableForList = game.myTurn ? (game.syllable || "") : (game.lastSpectatorSyllable || "");
    clickableWords(sharedList, entries, syllableForList);

    sharedNotice._show(buildNotice(activeContext));
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



















