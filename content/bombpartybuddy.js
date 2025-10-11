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
  const payload = text ?? "";
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(payload);
      return true;
    } catch (_) { /* fall through to execCommand */ }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = payload;
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

  const STORAGE_KEY = "bombpartybuddy.settings.v1";
  const SESSION_KEY = "bombpartybuddy.session.v1";

  const safeParse = (text) => {
    if (!text) return null;
    try { return JSON.parse(text); } catch (_) { return null; }
  };

  const loadSettings = () => {
    try { return safeParse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (err) { console.warn("[BombPartyShark] Failed to load settings", err); return {}; }
  };
  const saveSettingsNow = (payload) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); }
    catch (err) { console.warn("[BombPartyShark] Failed to save settings", err); }
  };
  const loadTallies = () => {
    try { return safeParse(sessionStorage.getItem(SESSION_KEY)) || {}; }
    catch (_) { return {}; }
  };
  const saveTalliesNow = (payload) => {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload)); }
    catch (_) { /* ignore */ }
  };

  const savedSettings = loadSettings();
  const sessionData = loadTallies();

  const clampNumber = (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };
  const getBool = (value, fallback) => (typeof value === "boolean" ? value : fallback);

  let hudSizePercent = clampNumber(savedSettings?.hudSizePercent, 20, 70, 45);

  const setIfString = (val, setter) => { if (typeof val === "string") setter(val); };

  const formatTargetLenLabel = (pref, actual) => {
    if (pref >= 21) {
      return actual ? `${actual} (max)` : "max";
    }
    return `${pref}`;
  };

  game.paused = !getBool(savedSettings?.autoTypeEnabled, true);
  game.instantMode = getBool(savedSettings?.instantMode, game.instantMode);
  game.mistakesEnabled = getBool(savedSettings?.mistakesEnabled, game.mistakesEnabled);
  game.superRealisticEnabled = getBool(savedSettings?.superRealisticEnabled, game.superRealisticEnabled);
  game.autoSuicide = getBool(savedSettings?.autoSuicide, game.autoSuicide);
  game.setAutoJoinAlways(getBool(savedSettings?.autoJoinAlways, game.autoJoinAlways));
  game.foulMode = getBool(savedSettings?.foulMode, game.foulMode);
  game.coverageMode = getBool(savedSettings?.coverageMode, game.coverageMode);
  game.lengthMode = getBool(savedSettings?.lengthMode, game.lengthMode);
  game.specLengthMode = getBool(savedSettings?.specLengthMode, game.specLengthMode);
  game.specFoulMode = getBool(savedSettings?.specFoulMode, game.specFoulMode);
  game.hyphenMode = getBool(savedSettings?.hyphenMode, game.hyphenMode);
  game.specHyphenMode = getBool(savedSettings?.specHyphenMode, game.specHyphenMode);
  game.containsMode = getBool(savedSettings?.containsMode, game.containsMode);
  game.specContainsMode = getBool(savedSettings?.specContainsMode, game.specContainsMode);
  game.pokemonMode = getBool(savedSettings?.pokemonMode, game.pokemonMode);
  game.specPokemonMode = getBool(savedSettings?.specPokemonMode, game.specPokemonMode);
  game.mineralsMode = getBool(savedSettings?.mineralsMode, game.mineralsMode);
  game.specMineralsMode = getBool(savedSettings?.specMineralsMode, game.specMineralsMode);
  game.rareMode = getBool(savedSettings?.rareMode, game.rareMode);
  game.specRareMode = getBool(savedSettings?.specRareMode, game.specRareMode);
  game.preMsgEnabled = getBool(savedSettings?.preMsgEnabled, game.preMsgEnabled);
  game.postfixEnabled = getBool(savedSettings?.postfixEnabled, game.postfixEnabled);

  game.setSpeed(clampNumber(savedSettings?.speed, 1, 12, game.speed));
  game.setThinkingDelaySec(clampNumber(savedSettings?.thinkingDelaySec, 0, 5, game.thinkingDelaySec));
  const savedMistakeProb = typeof savedSettings?.mistakesProb === "number" ? savedSettings.mistakesProb : game.mistakesProb;
  game.setMistakesProb(Math.max(0, Math.min(0.30, Number(savedMistakeProb))));
  const savedRealAgg = typeof savedSettings?.superRealisticAggression === "number" ? savedSettings.superRealisticAggression : game.superRealisticAggression;
  game.setSuperRealisticAggression(savedRealAgg);
  const savedRealPause = typeof savedSettings?.superRealisticPauseSec === "number" ? savedSettings.superRealisticPauseSec : game.superRealisticPauseSec;
  game.setSuperRealisticPauseSec(savedRealPause);
  game.setSuggestionsLimit(clampNumber(savedSettings?.suggestionsLimit, 1, 20, game.suggestionsLimit));
  const defaultTargetPref = Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen;
  const defaultSpecTargetPref = Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen;
  game.setTargetLen(clampNumber(savedSettings?.targetLen, 3, 21, defaultTargetPref));
  game.setSpecTargetLen(clampNumber(savedSettings?.specTargetLen, 3, 21, defaultSpecTargetPref));

  setIfString(savedSettings?.preMsgText, (val) => game.setPreMsgText(val));
  setIfString(savedSettings?.postfixText, (val) => game.setPostfixText(val));
  setIfString(savedSettings?.containsText, (val) => game.setContainsText(val));
  setIfString(savedSettings?.specContainsText, (val) => game.setSpecContainsText(val));
  setIfString(savedSettings?.excludeSpec, (val) => game.setExcludeSpec(val));

  game.setExcludeEnabled(getBool(savedSettings?.excludeEnabled, game.excludeEnabled));
  if (Array.isArray(savedSettings?.priorityOrder)) {
    game.setPriorityOrder(savedSettings.priorityOrder);
  }

  if (Array.isArray(sessionData?.coverageCounts) && sessionData.coverageCounts.length === 26) {
    for (let i = 0; i < 26; i++) {
      const raw = Number(sessionData.coverageCounts[i]);
      if (Number.isFinite(raw)) {
        game.coverageCounts[i] = Math.max(0, Math.min(99, Math.floor(raw)));
      }
    }
  }

  const collectSettings = () => ({
    hudSizePercent,
    autoTypeEnabled: !game.paused,
    instantMode: !!game.instantMode,
    mistakesEnabled: !!game.mistakesEnabled,
    autoSuicide: !!game.autoSuicide,
    autoJoinAlways: !!game.autoJoinAlways,
    foulMode: !!game.foulMode,
    coverageMode: !!game.coverageMode,
    excludeEnabled: !!game.excludeEnabled,
    lengthMode: !!game.lengthMode,
    specLengthMode: !!game.specLengthMode,
    specFoulMode: !!game.specFoulMode,
    hyphenMode: !!game.hyphenMode,
    specHyphenMode: !!game.specHyphenMode,
    containsMode: !!game.containsMode,
    specContainsMode: !!game.specContainsMode,
    pokemonMode: !!game.pokemonMode,
    specPokemonMode: !!game.specPokemonMode,
    mineralsMode: !!game.mineralsMode,
    specMineralsMode: !!game.specMineralsMode,
    rareMode: !!game.rareMode,
    specRareMode: !!game.specRareMode,
    speed: game.speed,
    thinkingDelaySec: game.thinkingDelaySec,
    mistakesProb: game.mistakesProb,
    superRealisticEnabled: !!game.superRealisticEnabled,
    superRealisticAggression: game.superRealisticAggression,
    superRealisticPauseSec: game.superRealisticPauseSec,
    suggestionsLimit: game.suggestionsLimit,
    targetLen: Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen,
    specTargetLen: Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen,
    preMsgEnabled: !!game.preMsgEnabled,
    preMsgText: game.preMsgText || "",
    postfixEnabled: !!game.postfixEnabled,
    postfixText: game.postfixText || "",
    containsText: game.containsText || "",
    specContainsText: game.specContainsText || "",
    excludeSpec: game.excludeSpec || "",
    priorityOrder: Array.isArray(game.priorityOrder) ? game.priorityOrder.slice() : []
  });

  let saveTimer = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveSettingsNow(collectSettings()); }, 120);
  };

  let talliesTimer = null;
  const scheduleTalliesSave = () => {
    if (talliesTimer) clearTimeout(talliesTimer);
    talliesTimer = setTimeout(() => {
      const counts = Array.isArray(game.coverageCounts) ? game.coverageCounts.slice(0, 26) : [];
      saveTalliesNow({ coverageCounts: counts });
    }, 120);
  };

  const recomputeSuggestions = () => {
    if (game.myTurn && game.syllable) {
      game.lastTopPicksSelf = game.getTopCandidates(game.syllable, game.suggestionsLimit);
    } else if (game.lastSpectatorSyllable) {
      game.generateSpectatorSuggestions(game.lastSpectatorSyllable, game.suggestionsLimit);
    }
  };

  const requestSave = (opts = {}) => {
    if (opts.recompute) recomputeSuggestions();
    scheduleSave();
  };

  game._notifySettingsChanged = (opts = {}) => {
    requestSave(opts);
  };

  const autoJoinManager = (() => {
    let enabled = false;
    let checkTimer = null;
    let bodyObserver = null;
    let buttonObserver = null;
    let observedButton = null;
    let lastClickTime = 0;

    const ATTRIBUTE_NAMES = [
      "aria-pressed",
      "aria-checked",
      "data-active",
      "data-selected",
      "data-state",
      "data-enabled",
      "data-checked",
      "data-pressed"
    ];
    const ATTRIBUTE_FILTER = ["class", ...ATTRIBUTE_NAMES];
    const TRUTHY_VALUES = new Set(["true", "1", "on", "yes", "y"]);
    const FALSY_VALUES = new Set(["false", "0", "off", "no", "n"]);
    const CLASS_INDICATORS = ["red", "selected", "active", "enabled", "on", "pressed", "checked"];
    const DATA_KEYS = ["active", "selected", "state", "enabled", "checked", "pressed"];

    const interpret = (value) => {
      if (typeof value !== "string") return null;
      const normalized = value.trim().toLowerCase();
      if (TRUTHY_VALUES.has(normalized)) return true;
      if (FALSY_VALUES.has(normalized)) return false;
      return null;
    };

    const isButtonActive = (btn) => {
      if (!btn) return false;
      for (const cls of CLASS_INDICATORS) {
        if (btn.classList.contains(cls)) return true;
      }
      for (const attr of ATTRIBUTE_NAMES) {
        const interpreted = interpret(btn.getAttribute(attr));
        if (interpreted !== null) return interpreted;
      }
      const dataset = btn.dataset || {};
      for (const key of DATA_KEYS) {
        const interpreted = interpret(dataset[key]);
        if (interpreted !== null) return interpreted;
      }
      return false;
    };

    const detachButtonObserver = () => {
      if (buttonObserver) {
        buttonObserver.disconnect();
        buttonObserver = null;
      }
      observedButton = null;
    };

    const ensureButtonObserved = (btn) => {
      if (!btn || observedButton === btn) return;
      detachButtonObserver();
      observedButton = btn;
      buttonObserver = new MutationObserver(() => ensureAutoJoin());
      try {
        buttonObserver.observe(btn, {
          attributes: true,
          attributeFilter: ATTRIBUTE_FILTER,
          childList: true,
          characterData: true,
          subtree: true
        });
      } catch (err) {
        console.warn("[BombPartyShark] Failed to observe auto-join button", err);
      }
    };

    const clickButton = (btn) => {
      if (!btn) return;
      if (typeof btn.click === "function") {
        btn.click();
      } else {
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      }
    };

    const ensureAutoJoin = () => {
      if (!enabled) return;
      const btn = document.querySelector("button.autojoinButton");
      if (!btn) {
        detachButtonObserver();
        return;
      }
      ensureButtonObserved(btn);
      if (isButtonActive(btn)) return;
      const now = Date.now();
      if (now - lastClickTime < 200) return;
      lastClickTime = now;
      clickButton(btn);
    };

    const start = () => {
      if (!bodyObserver) {
        bodyObserver = new MutationObserver(() => ensureAutoJoin());
        bodyObserver.observe(document.body, { childList: true, subtree: true });
      }
      if (!checkTimer) {
        checkTimer = window.setInterval(ensureAutoJoin, 2000);
      }
      ensureAutoJoin();
    };

    const stop = () => {
      if (bodyObserver) {
        bodyObserver.disconnect();
        bodyObserver = null;
      }
      if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
      }
      detachButtonObserver();
    };

    return {
      update(value) {
        const next = !!value;
        if (next === enabled) {
          if (enabled) ensureAutoJoin();
          return;
        }
        enabled = next;
        if (enabled) start();
        else stop();
      },
      poke() {
        if (enabled) ensureAutoJoin();
      },
      disconnect() {
        stop();
      }
    };
  })();

  game.setTalliesChangedCallback(() => {
    scheduleTalliesSave();
    recomputeSuggestions();
  });
  scheduleTalliesSave();

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
  let hudScale = hudSizePercent / 100;
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
  let coverageEditMode = "off";
  const setActive = (name) => {
    active = name;
    mainSec.style.display  = name==="Main" ? "block" : "none";
    covSec.style.display   = name==="Coverage" ? "block" : "none";
    wordsSec.style.display = name==="Words" ? "block" : "none";
    mainTabBtn._setActive(name==="Main");
    covTabBtn._setActive(name==="Coverage");
    wordsTabBtn._setActive(name==="Words");
    if (name !== "Coverage") coverageEditMode = "off";
  };
  mainTabBtn.onclick = () => setActive("Main");
  covTabBtn.onclick  = () => setActive("Coverage");
  wordsTabBtn.onclick= () => setActive("Words");
  setActive("Words");

  // helpers
  const toggleThemes = {
    default: { onBg: "rgba(59,130,246,0.24)", onBorder: "rgba(59,130,246,0.55)", onColor: "#bfdbfe" },
    purple:  { onBg: "rgba(168,85,247,0.26)", onBorder: "rgba(147,51,234,0.65)", onColor: "#e9d5ff" },
    white:   { onBg: "rgba(248,250,252,0.28)", onBorder: "rgba(226,232,240,0.65)", onColor: "#f8fafc" },
    yellow:  { onBg: "rgba(253,224,71,0.24)", onBorder: "rgba(250,204,21,0.70)", onColor: "#facc15" },
    gold:    { onBg: "rgba(250,204,21,0.28)", onBorder: "rgba(234,179,8,0.72)", onColor: "#fde047" },
    red:     { onBg: "rgba(248,113,113,0.26)", onBorder: "rgba(239,68,68,0.70)", onColor: "#fecaca" },
    green:   { onBg: "rgba(74,222,128,0.26)", onBorder: "rgba(34,197,94,0.65)", onColor: "#bbf7d0" },
    pink:    { onBg: "rgba(236,72,153,0.25)", onBorder: "rgba(244,114,182,0.68)", onColor: "#fce7f3" },
    teal:    { onBg: "rgba(45,212,191,0.26)", onBorder: "rgba(20,184,166,0.68)", onColor: "#ccfbf1" },
    brown:   { onBg: "rgba(120,53,15,0.32)", onBorder: "rgba(146,64,14,0.68)", onColor: "#fbbf24" },
    cyan:    { onBg: "rgba(34,211,238,0.28)", onBorder: "rgba(6,182,212,0.65)", onColor: "#a5f3fc" }
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

  const priorityControls = new Map();
  const priorityKeys = ["contains", "foul", "coverage", "hyphen", "length"];
  const attachPriorityControl = (row, key) => {
    if (!row || !row._labelSpan || priorityControls.has(key)) return;
    const span = row._labelSpan;
    span.style.display = "inline-flex";
    span.style.alignItems = "center";
    span.style.gap = "6px";
    const select = document.createElement("select");
    for (let i = 1; i <= priorityKeys.length; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `#${i}`;
      select.appendChild(opt);
    }
    Object.assign(select.style, {
      background: "rgba(15,23,42,0.65)",
      color: "#e2e8f0",
      border: "1px solid rgba(148,163,184,0.4)",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: "700",
      padding: "2px 4px",
      cursor: "pointer"
    });
    select.addEventListener("change", () => {
      const pos = Math.max(0, Math.min(priorityKeys.length - 1, parseInt(select.value, 10) - 1 || 0));
      game.setPriorityPosition(key, pos);
      requestSave({ recompute: true });
      render();
    });
    span.appendChild(select);
    priorityControls.set(key, select);
  };

  const mkRow = (label, onClick, getOn, scheme = "default", mode = "status", options = {}) => {
    const r = document.createElement("div");
    Object.assign(r.style, { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", margin:"8px 0" });
    const span = document.createElement("span"); span.textContent = label; span.style.fontWeight = "600"; r.appendChild(span);
    r._labelSpan = span;
    const btn = document.createElement("button");
    btn.onclick = () => {
      onClick();
      if (typeof options.after === "function") options.after();
      if (options.recompute) requestSave({ recompute: true });
      else requestSave();
      render();
    };
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
    row._labelSpan = span;
    const btnWrap = document.createElement("div");
    Object.assign(btnWrap.style, { display:"flex", gap:"8px", flexWrap:"wrap" });
    row.appendChild(btnWrap);
    row._buttons = [];
    configs.forEach(cfg => {
      const btn = document.createElement("button");
      btn.dataset.label = cfg.label;
      btn.dataset.mode = "label";
      btn.addEventListener("click", () => {
        cfg.onClick();
        if (typeof cfg.after === "function") cfg.after();
        if (cfg.recompute) requestSave({ recompute: true });
        else requestSave();
        render();
      });
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
    const valEl = document.createElement("span"); valEl.style.opacity = "0.9"; valEl.style.fontWeight = "700";
    if (options.valueColor) valEl.style.color = options.valueColor;
    const formatValue = typeof options.formatValue === "function" ? options.formatValue : (value) => String(value);
    const coerceValue = (raw) => {
      let num = typeof raw === "number" ? raw : Number.parseFloat(raw);
      if (!Number.isFinite(num)) num = min;
      if (Math.abs(step - 1) < 1e-9) {
        num = Math.round(num);
      } else {
        num = Math.round(num * 1000) / 1000;
      }
      return Math.max(min, Math.min(max, num));
    };
    const updateDisplay = (value) => {
      valEl.textContent = formatValue(value);
    };
    updateDisplay(val);
    input.addEventListener("input", (e)=>{
      const v = coerceValue(input.value);
      oninput(v);
      updateDisplay(v);
      if (typeof options.onChange === "function") options.onChange(v);
      e.stopPropagation();
    });
    row.appendChild(span); row.appendChild(input); row.appendChild(valEl);
    row._range = input;
    row._valueEl = valEl;
    row._formatValue = formatValue;
    row._coerceValue = coerceValue;
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
    } else if (options.theme === "blue") {
      Object.assign(baseStyle, { border:"1px solid rgba(96,165,250,0.6)", background:"rgba(59,130,246,0.18)", color:"#dbeafe" });
    }
    Object.assign(inp.style, baseStyle);
    inp.addEventListener("input", (e)=>{
      oninput(inp.value);
      if (typeof options.onChange === "function") options.onChange(inp.value);
      e.stopPropagation();
    });
    wrap.appendChild(inp);
    wrap._input = inp;
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
    mkRow("AutoType", () => game.togglePause(), () => !game.paused, "purple"),
    mkRow("Instant mode", () => game.toggleInstantMode(), () => game.instantMode, "white"),
    mkRow("Butterfingers", () => game.toggleMistakes(), () => game.mistakesEnabled, "yellow"),
    mkRow("Auto /suicide", () => game.toggleAutoSuicide(), () => game.autoSuicide, "red"),
  ];
  const autoJoinToggle = mkRow(
    "Always auto-join",
    () => game.toggleAutoJoinAlways(),
    () => game.autoJoinAlways,
    "green",
    "status",
    { after: () => autoJoinManager.update(game.autoJoinAlways) }
  );
  rows.push(autoJoinToggle);

  const toggleRefs = [...rows];
  const dualToggleRows = [];
  let wordModesCollapsed = false;
  let superRealWrap = null;
  let superAggRow = null;
  let superPauseRow = null;

  const mainGrid = document.createElement("div");
  Object.assign(mainGrid.style, { display:"grid", gap:"16px" });
  mainSec.appendChild(mainGrid);

  const automationCard = createCard("Automation");
  rows.forEach(r => automationCard.appendChild(r));
  const superRealToggle = mkRow("Super realistic", () => game.toggleSuperRealistic(), () => game.superRealisticEnabled, "yellow");
  toggleRefs.push(superRealToggle);
  automationCard.appendChild(superRealToggle);

  superRealWrap = document.createElement("div");
  Object.assign(superRealWrap.style, {
    display:"grid",
    gap:"12px 16px",
    gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))",
    marginTop:"4px"
  });

  superAggRow = sliderRow("Aggressiveness (%)", 0, 100, Math.round(game.superRealisticAggression * 100), 1, (v)=>game.setSuperRealisticAggression(v/100), { accent: "#facc15", valueColor: "#fde047", onChange: () => requestSave(), formatValue: (val) => `${Math.round(val)}%` });
  superPauseRow = sliderRow("Mid-word pause (s)", 0, 3, Math.round(game.superRealisticPauseSec * 10) / 10, 0.1, (v)=>game.setSuperRealisticPauseSec(v), { accent: "#facc15", valueColor: "#fde68a", onChange: () => requestSave(), formatValue: (val) => `${val.toFixed(1)}s` });

  const polishSliderLayout = (row) => {
    if (!row) return;
    Object.assign(row.style, {
      width:"100%",
      margin:"6px 0",
      gridTemplateColumns:"minmax(150px, 1fr) minmax(0, 1fr) auto"
    });
    if (row.firstChild) {
      Object.assign(row.firstChild.style, { whiteSpace:"normal", lineHeight:"1.3" });
    }
    if (row._valueEl) {
      row._valueEl.style.justifySelf = "end";
    }
  };
  polishSliderLayout(superAggRow);
  polishSliderLayout(superPauseRow);

  superRealWrap.appendChild(superAggRow);
  superRealWrap.appendChild(superPauseRow);
  automationCard.appendChild(superRealWrap);

  if (!game.superRealisticEnabled) {
    superRealWrap.style.opacity = "0.55";
    superRealWrap.style.pointerEvents = "none";
    if (superAggRow?._range) {
      superAggRow._range.disabled = true;
      superAggRow._range.setAttribute("aria-disabled", "true");
    }
    if (superPauseRow?._range) {
      superPauseRow._range.disabled = true;
      superPauseRow._range.setAttribute("aria-disabled", "true");
    }
  }
  mainGrid.appendChild(automationCard);

  const hudCard = createCard("HUD & Rhythm");
  const hudSizeRow = sliderRow("HUD size", 20, 70, hudSizePercent, 1, (v)=>{ hudSizePercent = v; hudScale = v/100; applyScale(); }, { accent: "#3b82f6", valueColor: "#93c5fd", onChange: () => requestSave() });
  hudCard.appendChild(hudSizeRow);
  hudCard.appendChild(sliderRow("Speed", 1, 12, game.speed, 1, (v)=>game.setSpeed(v), { accent: "#22c55e", valueColor: "#4ade80", onChange: () => requestSave() }));
  hudCard.appendChild(sliderRow("Thinking delay (s)", 0, 5, game.thinkingDelaySec, 0.1, (v)=>game.setThinkingDelaySec(v), { accent: "#fb923c", valueColor: "#fdba74", onChange: () => requestSave(), formatValue: (val) => `${val.toFixed(1)}s` }));
  hudCard.appendChild(sliderRow("Butterfingers (%)", 0, 30, Math.round(game.mistakesProb * 100), 1, (v)=>game.setMistakesProb(v/100), { accent: "#facc15", valueColor: "#facc15", onChange: () => requestSave(), formatValue: (val) => `${Math.round(val)}%` }));
  mainGrid.appendChild(hudCard);

  const messageCard = createCard("Messages");
  Object.assign(messageCard.style, { background:"rgba(236,72,153,0.18)", border:"1px solid rgba(244,114,182,0.45)" });
  const preTop = mkRow("Premessage", ()=>game.setPreMsgEnabled(!game.preMsgEnabled), ()=>game.preMsgEnabled, "pink");
  toggleRefs.push(preTop);
  messageCard.appendChild(preTop);
  messageCard.appendChild(textInput("Message to flash before your word", game.preMsgText, (v)=>game.setPreMsgText(v), { theme:"pink", onChange: () => requestSave() }));
  const postTop = mkRow("Postfix", ()=>game.setPostfixEnabled(!game.postfixEnabled), ()=>game.postfixEnabled, "pink");
  toggleRefs.push(postTop);
  messageCard.appendChild(postTop);
  messageCard.appendChild(textInput("Characters to append (e.g., <3)", game.postfixText, (v)=>game.setPostfixText(v), { theme:"pink", onChange: () => requestSave() }));
  mainGrid.appendChild(messageCard);

  // =============== COVERAGE TAB =================
  const coverageCard = createCard("Alphabet mastery");
  Object.assign(coverageCard.style, {
    background:"linear-gradient(135deg, rgba(56,189,248,0.18), rgba(244,114,182,0.10), rgba(14,165,233,0.18))",
    border:"1px solid rgba(148,163,184,0.45)"
  });
  const coverageToggle = mkRow("Alphabet coverage", () => game.toggleCoverageMode(), () => game.coverageMode, "teal", "status", { recompute: true });
  toggleRefs.push(coverageToggle);
  coverageCard.appendChild(coverageToggle);
  attachPriorityControl(coverageToggle, "coverage");

  const exTop = mkRow("A-Z goals / exclusions", ()=>game.setExcludeEnabled(!game.excludeEnabled), ()=>game.excludeEnabled, "teal", "status", { recompute: true });
  toggleRefs.push(exTop);
  coverageCard.appendChild(exTop);

  const coverageEditButtons = [];
  const coverageCells = [];

  const editControls = document.createElement("div");
  Object.assign(editControls.style, { display:"grid", gap:"6px", marginTop:"8px" });
  coverageCard.appendChild(editControls);

  const editLabel = document.createElement("div");
  editLabel.textContent = "Editing mode";
  Object.assign(editLabel.style, { fontWeight:"600", color:"rgba(226,232,240,0.9)" });
  editControls.appendChild(editLabel);

  const editButtonsRow = document.createElement("div");
  Object.assign(editButtonsRow.style, { display:"flex", flexWrap:"wrap", gap:"8px" });
  editControls.appendChild(editButtonsRow);

  const editModes = [
    { key:"off", label:"Off" },
    { key:"tally", label:"Edit tallies" },
    { key:"goal", label:"Edit goals" }
  ];
  const setCoverageEditMode = (mode) => {
    const next = editModes.some(m => m.key === mode) ? mode : "off";
    if (coverageEditMode === next) return;
    coverageEditMode = next;
    render();
  };
  if (coverageToggle?._btn) coverageToggle._btn.addEventListener("click", () => { coverageEditMode = "off"; });
  if (exTop?._btn) exTop._btn.addEventListener("click", () => { coverageEditMode = "off"; });
  editModes.forEach(cfg => {
    const btn = document.createElement("button");
    btn.dataset.label = cfg.label;
    btn.dataset.mode = "label";
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (coverageEditMode === cfg.key) {
        setCoverageEditMode("off");
      } else {
        setCoverageEditMode(cfg.key);
      }
    });
    editButtonsRow.appendChild(btn);
    coverageEditButtons.push({ key: cfg.key, btn });
  });

  const editNotice = document.createElement("div");
  Object.assign(editNotice.style, {
    display:"none",
    background:"rgba(15,118,110,0.22)",
    border:"1px solid rgba(20,184,166,0.45)",
    borderRadius:"10px",
    padding:"8px 10px",
    fontSize:"12px",
    color:"#ccfbf1",
    lineHeight:"1.4"
  });
  coverageCard.appendChild(editNotice);

  const setAllWrap = document.createElement("div");
  Object.assign(setAllWrap.style, { display:"none", flexWrap:"wrap", gap:"8px", alignItems:"center", marginTop:"6px" });
  const setAllLabel = document.createElement("span");
  setAllLabel.textContent = "Set all goals to:";
  Object.assign(setAllLabel.style, { fontWeight:"600" });
  setAllWrap.appendChild(setAllLabel);
  const setAllInput = document.createElement("input");
  Object.assign(setAllInput, { type:"number", min:"0", max:"99", value:"1" });
  Object.assign(setAllInput.style, {
    width:"72px",
    padding:"6px 8px",
    borderRadius:"8px",
    border:"1px solid rgba(148,163,184,0.45)",
    background:"rgba(15,23,42,0.6)",
    color:"#e2e8f0",
    fontWeight:"600"
  });
  setAllWrap.appendChild(setAllInput);
  const setAllBtn = document.createElement("button");
  setAllBtn.textContent = "Apply";
  Object.assign(setAllBtn.style, {
    padding:"6px 12px",
    borderRadius:"8px",
    border:"1px solid rgba(20,184,166,0.55)",
    background:"rgba(13,148,136,0.35)",
    color:"#ccfbf1",
    fontWeight:"700",
    cursor:"pointer"
  });
  setAllBtn.addEventListener("click", () => {
    const val = Number.parseInt(setAllInput.value, 10);
    if (!Number.isFinite(val)) return;
    const clamped = Math.max(0, Math.min(99, val));
    game.setAllTargetCounts(clamped);
    setAllInput.value = String(clamped);
    coverageEditMode = "off";
    render();
  });
  setAllInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      setAllBtn.click();
    }
  });
  setAllWrap.appendChild(setAllBtn);
  coverageCard.appendChild(setAllWrap);

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
  Object.assign(resetBtn.style,{ padding:"8px 12px", borderRadius:"10px", cursor:"pointer", background:"rgba(15,118,110,0.32)",color:"#ccfbf1", border:"1px solid rgba(20,184,166,0.55)", fontWeight:"700" });
  resetBtn.onclick = ()=>{ game.resetCoverage(); setCoverageEditMode("off"); render(); };
  coverageCard.appendChild(resetBtn);

  covSec.appendChild(coverageCard);

  // =============== WORDS TAB =================
  const wordsGrid = document.createElement("div");
  Object.assign(wordsGrid.style, { display:"grid", gap:"16px" });
  wordsSec.appendChild(wordsGrid);

  const overviewCard = createCard("Word targeting");
  const colorGuide = document.createElement("div");
  const colorDot = (hex) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${hex};"></span>`;
  colorGuide.innerHTML = `${colorDot('#f87171')} foul • ${colorDot('#22c55e')} matches target length • ${colorDot('#facc15')} nearby length • ${colorDot('#ec4899')} hyphen words • ${colorDot('#3b82f6')} contains filter • ${colorDot('#fde047')} Pokémon • ${colorDot('#92400e')} minerals • ${colorDot('#22d3ee')} rare • ${colorDot('#e2e8f0')} regular <span style="font-size:10px; opacity:0.65; margin-left:6px;">click me to go away</span>`;
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

  const suggRow = sliderRow("Suggestions", 1, 20, game.suggestionsLimit, 1, (v)=>game.setSuggestionsLimit(v), { accent: "#e2e8f0", valueColor: "#cbd5f5", onChange: () => requestSave({ recompute: true }), formatValue: (val) => `${Math.round(val)}` });
  overviewCard.appendChild(suggRow);

  const modesToggleBtn = document.createElement("button");
  modesToggleBtn.type = "button";
  Object.assign(modesToggleBtn.style, {
    display:"flex",
    alignItems:"center",
    justifyContent:"space-between",
    gap:"12px",
    padding:"6px 10px",
    borderRadius:"10px",
    border:"1px solid rgba(148,163,184,0.35)",
    background:"rgba(15,23,42,0.5)",
    color:"#e2e8f0",
    fontWeight:"700",
    cursor:"pointer"
  });
  const modesLabel = document.createElement("span");
  modesLabel.textContent = "Word modes";
  const modesArrow = document.createElement("span");
  modesArrow.textContent = "▾";
  modesArrow.style.fontSize = "16px";
  modesToggleBtn.appendChild(modesLabel);
  modesToggleBtn.appendChild(modesArrow);
  modesToggleBtn.setAttribute("aria-expanded", "true");
  modesToggleBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    wordModesCollapsed = !wordModesCollapsed;
    render();
  });
  overviewCard.appendChild(modesToggleBtn);

  const wordModesBody = document.createElement("div");
  wordModesBody.id = "wordModesSection";
  modesToggleBtn.setAttribute("aria-controls", wordModesBody.id);
  Object.assign(wordModesBody.style, { display:"flex", flexDirection:"column", gap:"8px", marginTop:"8px" });
  wordModesBody.setAttribute("aria-hidden", "false");
  overviewCard.appendChild(wordModesBody);

  const foulDualRow = mkDualRow("Foul words", [
    { label: "Me", onClick: () => game.toggleFoulMode(), getOn: () => game.foulMode, scheme: "red", recompute: true },
    { label: "Spectator", onClick: () => game.toggleSpecFoul(), getOn: () => game.specFoulMode, scheme: "red", recompute: true }
  ]);
  dualToggleRows.push(foulDualRow);
  wordModesBody.appendChild(foulDualRow);
  attachPriorityControl(foulDualRow, "foul");

  const pokemonRow = mkDualRow("Pokémon words", [
    { label: "Me", onClick: () => game.togglePokemonMode(), getOn: () => game.pokemonMode, scheme: "gold", recompute: true },
    { label: "Spectator", onClick: () => game.toggleSpecPokemonMode(), getOn: () => game.specPokemonMode, scheme: "gold", recompute: true }
  ]);
  dualToggleRows.push(pokemonRow);
  wordModesBody.appendChild(pokemonRow);

  const mineralsRow = mkDualRow("Minerals", [
    { label: "Me", onClick: () => game.toggleMineralsMode(), getOn: () => game.mineralsMode, scheme: "brown", recompute: true },
    { label: "Spectator", onClick: () => game.toggleSpecMineralsMode(), getOn: () => game.specMineralsMode, scheme: "brown", recompute: true }
  ]);
  dualToggleRows.push(mineralsRow);
  wordModesBody.appendChild(mineralsRow);

  const rareRow = mkDualRow("Rare words", [
    { label: "Me", onClick: () => game.toggleRareMode(), getOn: () => game.rareMode, scheme: "cyan", recompute: true },
    { label: "Spectator", onClick: () => game.toggleSpecRareMode(), getOn: () => game.specRareMode, scheme: "cyan", recompute: true }
  ]);
  dualToggleRows.push(rareRow);
  wordModesBody.appendChild(rareRow);

  const lenDualRow = mkDualRow("Target length", [
    { label: "Me", onClick: () => game.toggleLengthMode(), getOn: () => game.lengthMode, scheme: "green", recompute: true },
    { label: "Spectator", onClick: () => game.toggleSpecLength(), getOn: () => game.specLengthMode, scheme: "green", recompute: true }
  ]);
  dualToggleRows.push(lenDualRow);
  wordModesBody.appendChild(lenDualRow);
  attachPriorityControl(lenDualRow, "length");
  const lenSliderWrap = document.createElement("div");
  Object.assign(lenSliderWrap.style, { display:"grid", gap:"12px", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))" });
  const lenValueDisplay = (v) => (v >= 21 ? "Max" : `${Math.round(v)}`);
  const lenSliderMain = sliderRow("Me", 3, 21, Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen, 1, (v)=>game.setTargetLen(v), { accent: "#22c55e", valueColor: "#86efac", onChange: () => requestSave({ recompute: true }), formatValue: lenValueDisplay });
  const specLenSlider = sliderRow("Spectator", 3, 21, Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen, 1, (v)=>game.setSpecTargetLen(v), { accent: "#22c55e", valueColor: "#86efac", onChange: () => requestSave({ recompute: true }), formatValue: lenValueDisplay });
  lenSliderWrap.appendChild(lenSliderMain);
  lenSliderWrap.appendChild(specLenSlider);
  wordModesBody.appendChild(lenSliderWrap);

  const hyphenRow = mkDualRow("Hyphen only", [
    { label: "Me", onClick: () => game.toggleHyphenMode(), getOn: () => game.hyphenMode, scheme: "pink", recompute: true },
    { label: "Spectator", onClick: () => game.toggleSpecHyphenMode(), getOn: () => game.specHyphenMode, scheme: "pink", recompute: true }
  ]);
  dualToggleRows.push(hyphenRow);
  wordModesBody.appendChild(hyphenRow);
  attachPriorityControl(hyphenRow, "hyphen");

  const containsRow = mkDualRow("Contains", [
    { label: "Me", onClick: () => game.toggleContainsMode(), getOn: () => game.containsMode, scheme: "default", recompute: true },
    { label: "Spectator", onClick: () => game.toggleSpecContainsMode(), getOn: () => game.specContainsMode, scheme: "default", recompute: true }
  ]);
  dualToggleRows.push(containsRow);
  wordModesBody.appendChild(containsRow);
  attachPriorityControl(containsRow, "contains");

  const containsInputWrap = document.createElement("div");
  Object.assign(containsInputWrap.style, { display:"grid", gap:"12px", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))" });
  const containsMeInput = textInput("Letters or fragment (me)", game.containsText, (v)=>game.setContainsText(v), { theme:"blue", onChange: () => requestSave({ recompute: true }) });
  const containsSpecInput = textInput("Letters or fragment (spectator)", game.specContainsText, (v)=>game.setSpecContainsText(v), { theme:"blue", onChange: () => requestSave({ recompute: true }) });
  containsInputWrap.appendChild(containsMeInput);
  containsInputWrap.appendChild(containsSpecInput);
  wordModesBody.appendChild(containsInputWrap);

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
  suggRow._range.addEventListener("input", () => { render(); });

  function toneStyle(tone) {
    if (tone === "foul") return { bg:"rgba(248,113,113,0.18)", border:"rgba(248,113,113,0.55)", color:"#fecaca" };
    if (tone === "pokemon") return { bg:"rgba(250,204,21,0.22)", border:"rgba(234,179,8,0.6)", color:"#fde047" };
    if (tone === "minerals") return { bg:"rgba(120,53,15,0.28)", border:"rgba(146,64,14,0.65)", color:"#fcd34d" };
    if (tone === "rare") return { bg:"rgba(14,165,233,0.22)", border:"rgba(6,182,212,0.6)", color:"#bae6fd" };
    if (tone === "hyphen") return { bg:"rgba(236,72,153,0.20)", border:"rgba(244,114,182,0.6)", color:"#fbcfe8" };
    if (tone === "contains") return { bg:"rgba(59,130,246,0.20)", border:"rgba(59,130,246,0.55)", color:"#bfdbfe" };
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
        justifyContent:"center",
        position:"relative",
        overflow:"visible"
      });
      btn.addEventListener("mouseenter", ()=>{ btn.style.transform = "translateY(-1px)"; });
      btn.addEventListener("mouseleave", ()=>{ btn.style.transform = "none"; });
      const showCopyNotice = (ok) => {
        const existing = btn.querySelector(".bps-copy-pop");
        if (existing) existing.remove();
        const pop = document.createElement("span");
        pop.className = "bps-copy-pop";
        pop.textContent = ok ? "Copied" : "Copy failed";
        Object.assign(pop.style, {
          position:"absolute",
          left:"50%",
          top:"-18px",
          transform:"translate(-50%, 0)",
          background:"rgba(15,118,110,0.92)",
          color:"#ecfeff",
          padding:"2px 8px",
          borderRadius:"999px",
          fontSize:"0.7rem",
          fontWeight:"600",
          pointerEvents:"none",
          opacity:"0",
          transition:"opacity 0.18s ease, transform 0.18s ease",
          zIndex:"2"
        });
        if (!ok) {
          pop.style.background = "rgba(190,18,60,0.92)";
          pop.style.color = "#fff1f2";
        }
        btn.appendChild(pop);
        requestAnimationFrame(() => {
          pop.style.opacity = "1";
          pop.style.transform = "translate(-50%, -6px)";
        });
        setTimeout(() => {
          pop.style.opacity = "0";
          pop.style.transform = "translate(-50%, -14px)";
        }, 600);
        setTimeout(() => { pop.remove(); }, 900);
      };
      const handleCopy = async (event) => {
        if (event) event.preventDefault();
        if (btn.dataset.copyBusy === "1") return;
        btn.dataset.copyBusy = "1";
        try {
          const ok = await copyPlain(word);
          btn.style.boxShadow = ok ? "0 0 0 2px rgba(34,197,94,0.45)" : "0 0 0 2px rgba(239,68,68,0.45)";
          showCopyNotice(ok);
          setTimeout(()=>{ btn.style.boxShadow = "none"; }, 420);
        } finally {
          setTimeout(() => { delete btn.dataset.copyBusy; }, 120);
        }
      };
      btn.addEventListener("pointerdown", handleCopy);
      btn.addEventListener("click", handleCopy);
      container.appendChild(btn);
    });
  }

  function ensureCoverageCells() {
    if (coverageCells.length) return;
    for (let i = 0; i < 26; i++) {
      const box = document.createElement("div");
      Object.assign(box.style, {
        padding:"8px 8px 10px",
        borderRadius:"10px",
        border:"1px solid rgba(255,255,255,0.18)",
        background:"rgba(255,255,255,0.05)",
        display:"flex",
        flexDirection:"column",
        gap:"6px",
        minHeight:"64px"
      });
      const header = document.createElement("div");
      Object.assign(header.style, {
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
        gap:"6px"
      });
      const letterSpan = document.createElement("span");
      Object.assign(letterSpan.style, { fontWeight:800, fontSize:"15px", textTransform:"uppercase" });
      const progressSpan = document.createElement("span");
      Object.assign(progressSpan.style, { fontWeight:700, fontSize:"12px" });
      header.appendChild(letterSpan);
      header.appendChild(progressSpan);
      const input = document.createElement("input");
      Object.assign(input, { type:"number", min:"0", max:"99" });
      Object.assign(input.style, {
        display:"none",
        width:"100%",
        padding:"5px 6px",
        borderRadius:"8px",
        border:"1px solid rgba(148,163,184,0.45)",
        background:"rgba(15,23,42,0.65)",
        color:"#e2e8f0",
        fontWeight:"600"
      });
      const bar = document.createElement("div");
      Object.assign(bar.style, {
        height:"6px",
        width:"100%",
        borderRadius:"999px",
        background:"rgba(255,255,255,0.1)",
        overflow:"hidden"
      });
      const fill = document.createElement("div");
      Object.assign(fill.style, { height:"100%", width:"0%", background:"rgba(250,204,21,0.85)" });
      bar.appendChild(fill);
      box.appendChild(header);
      box.appendChild(input);
      box.appendChild(bar);

      const idx = i;
      box.addEventListener("click", (ev) => {
        if (coverageEditMode === "off") return;
        if (ev.target === input) return;
        if (coverageEditMode === "tally") {
          game.adjustCoverageCount(idx, 1);
        } else if (coverageEditMode === "goal") {
          game.adjustTargetCount(idx, 1);
        }
        render();
      });
      box.addEventListener("contextmenu", (ev) => {
        if (coverageEditMode === "off") return;
        if (ev.target === input) return;
        ev.preventDefault();
        if (coverageEditMode === "tally") {
          game.adjustCoverageCount(idx, -1);
        } else if (coverageEditMode === "goal") {
          game.adjustTargetCount(idx, -1);
        }
        render();
      });

      input.addEventListener("click", (ev) => ev.stopPropagation());
      input.addEventListener("keydown", (ev) => {
        ev.stopPropagation();
        if (ev.key === "Enter") {
          ev.preventDefault();
          input.blur();
        }
      });
      input.addEventListener("change", () => {
        const val = Number.parseInt(input.value, 10);
        if (!Number.isFinite(val)) {
          input.value = String(game.targetCounts[idx] || 0);
          return;
        }
        game.setTargetCount(idx, val);
        input.value = String(game.targetCounts[idx] || 0);
        render();
      });
      input.addEventListener("contextmenu", (ev) => {
        if (coverageEditMode !== "goal") return;
        ev.preventDefault();
        game.adjustTargetCount(idx, -1);
        input.value = String(game.targetCounts[idx] || 0);
        render();
      });

      coverageCells.push({ idx, box, letterSpan, progressSpan, input, fill });
      grid.appendChild(box);
    }
  }

  function renderCoverageGrid() {
    ensureCoverageCells();
    const counts = game.coverageCounts || new Array(26).fill(0);
    const targets = game.targetCounts || new Array(26).fill(1);
    coverageCells.forEach(cell => {
      const { idx, box, letterSpan, progressSpan, input, fill } = cell;
      const letter = String.fromCharCode(97 + idx);
      letterSpan.textContent = letter;
      const target = Math.max(0, targets[idx] || 0);
      const haveRaw = Math.max(0, counts[idx] || 0);
      const have = Math.min(haveRaw, target);
      if (target <= 0) {
        progressSpan.textContent = "excluded";
        progressSpan.style.color = "#9ca3af";
        letterSpan.style.color = "#9ca3af";
        letterSpan.style.textDecoration = "line-through";
      } else {
        progressSpan.textContent = `${have}/${target}`;
        progressSpan.style.color = have >= target ? "#bbf7d0" : "#e0f2fe";
        letterSpan.style.color = "#fff";
        letterSpan.style.textDecoration = "none";
      }
      const pct = target > 0 ? Math.round((have / (target || 1)) * 100) : 0;
      fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      fill.style.background = target > 0 && have >= target ? "rgba(34,197,94,0.9)" : "rgba(250,204,21,0.85)";
      box.style.border = target <= 0 ? "1px solid rgba(148,163,184,0.32)" : "1px solid rgba(255,255,255,0.18)";
      box.style.background = coverageEditMode === "off" ? "rgba(255,255,255,0.05)" : "rgba(15,118,110,0.10)";
      box.style.cursor = coverageEditMode === "off" ? "default" : "pointer";
      if (coverageEditMode === "tally") {
        box.title = "Left click to add progress, right click to remove.";
      } else if (coverageEditMode === "goal") {
        box.title = "Left click to raise the goal, right click to lower.";
      } else {
        box.title = "";
      }

      input.style.display = coverageEditMode === "goal" ? "block" : "none";
      input.disabled = coverageEditMode !== "goal";
      if (document.activeElement !== input) {
        input.value = String(target);
      }
    });
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
    const containsFallback = context==="self" ? game.lastContainsFallbackSelf : game.lastContainsFallbackSpectator;
    const hyphenFallback = context==="self" ? game.lastHyphenFallbackSelf : game.lastHyphenFallbackSpectator;
    const pokemonFallback = context==="self" ? game.lastPokemonFallbackSelf : game.lastPokemonFallbackSpectator;
    const mineralsFallback = context==="self" ? game.lastMineralsFallbackSelf : game.lastMineralsFallbackSpectator;
    const rareFallback = context==="self" ? game.lastRareFallbackSelf : game.lastRareFallbackSpectator;
    const targetPref = context==="self" ? (Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen) : (Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen);
    const targetActual = context==="self" ? game.targetLen : game.specTargetLen;

    const parts = [];
    if ((context==="self" && game.foulMode) || (context==="spectator" && game.specFoulMode)) {
      if (foulFallback) parts.push("No foul words matched this prompt; using the normal word list.");
    }
    if ((context==="self" && game.pokemonMode) || (context==="spectator" && game.specPokemonMode)) {
      if (pokemonFallback) parts.push("No Pokémon words matched this prompt; falling back to regular suggestions.");
    }
    if ((context==="self" && game.mineralsMode) || (context==="spectator" && game.specMineralsMode)) {
      if (mineralsFallback) parts.push("No mineral words matched this prompt; showing main list instead.");
    }
    if ((context==="self" && game.rareMode) || (context==="spectator" && game.specRareMode)) {
      if (rareFallback) parts.push("No rare words matched this prompt; showing normal suggestions.");
    }
    if (context==="self" && game.lengthMode && game.coverageMode && capApplied)
      parts.push(`Limiting to words of <= ${formatTargetLenLabel(targetPref, targetActual)} letters while maximizing alphabet coverage.`);
    if (context==="self" && game.lengthMode && game.coverageMode && capRelaxed)
      parts.push(`No words of <= ${formatTargetLenLabel(targetPref, targetActual)} letters found; using best coverage regardless of length.`);
    if ((context==="self" && game.lengthMode && !game.coverageMode) ||
        (context==="spectator" && game.specLengthMode)) {
      if (lenFallback) {
        if (targetPref >= 21) {
          parts.push("No words at the maximum length; trying nearby lengths.");
        } else {
          parts.push(`No words with exactly ${formatTargetLenLabel(targetPref, targetActual)} letters; trying nearby lengths.`);
        }
      }
      if (lenSuppressed) parts.push("Target length ignored because higher-priority lists supplied enough options.");
    }
    if ((context==="self" && game.containsMode) || (context==="spectator" && game.specContainsMode)) {
      if (containsFallback) parts.push("Contains filter: no matches found; showing broader results.");
    }
    if ((context==="self" && game.hyphenMode) || (context==="spectator" && game.specHyphenMode)) {
      if (hyphenFallback) parts.push("Hyphen mode: no hyphenated words matched this prompt.");
    }
    return parts.join(" ");
  }

  function render() {
    toggleRefs.forEach(row => applyToggleBtn(row._btn, row._get(), row._scheme, row._mode));
    dualToggleRows.forEach(row => {
      row._buttons.forEach(info => applyToggleBtn(info.btn, info.getOn(), info.scheme, info.mode));
    });

    if (modesArrow) {
      modesArrow.textContent = wordModesCollapsed ? "▸" : "▾";
    }
    if (modesToggleBtn) {
      modesToggleBtn.setAttribute("aria-expanded", wordModesCollapsed ? "false" : "true");
    }
    if (wordModesBody) {
      wordModesBody.style.display = wordModesCollapsed ? "none" : "flex";
      wordModesBody.setAttribute("aria-hidden", wordModesCollapsed ? "true" : "false");
    }

    renderCoverageGrid();
    coverageEditButtons.forEach(({ key, btn }) => {
      applyToggleStyle(btn, coverageEditMode === key, "teal", "label");
    });
    if (coverageEditMode === "tally") {
      editNotice.style.display = "block";
      editNotice.textContent = "Editing tallies: left-click to add progress, right-click to remove. Values stay within each letter's goal.";
    } else if (coverageEditMode === "goal") {
      editNotice.style.display = "block";
      editNotice.textContent = "Editing goals: left-click to raise, right-click to lower, or type a number inside any letter box.";
    } else {
      editNotice.style.display = "none";
      editNotice.textContent = "";
    }

    if (setAllWrap) {
      const showSetAll = coverageEditMode === "goal";
      setAllWrap.style.display = showSetAll ? "flex" : "none";
      if (setAllInput) {
        setAllInput.disabled = !showSetAll;
        setAllInput.setAttribute("aria-disabled", showSetAll ? "false" : "true");
      }
      if (setAllBtn) {
        setAllBtn.disabled = !showSetAll;
        setAllBtn.setAttribute("aria-disabled", showSetAll ? "false" : "true");
      }
    }

    const updateSlider = (row, value) => {
      if (!row || !row._range) return;
      const coerced = row._coerceValue ? row._coerceValue(value) : value;
      const str = String(coerced);
      if (row._range.value !== str) row._range.value = str;
      if (row._valueEl) {
        const formatted = row._formatValue ? row._formatValue(coerced) : str;
        if (row._valueEl.textContent !== formatted) row._valueEl.textContent = formatted;
      }
    };
    updateSlider(hudSizeRow, hudSizePercent);
    updateSlider(lenSliderMain, Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen);
    updateSlider(specLenSlider, Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen);
    updateSlider(suggRow, game.suggestionsLimit);
    updateSlider(superAggRow, Math.round((game.superRealisticAggression || 0) * 100));
    updateSlider(superPauseRow, Math.round((game.superRealisticPauseSec || 0) * 10) / 10);

    const superEnabled = !!game.superRealisticEnabled;
    if (superRealWrap) {
      superRealWrap.style.opacity = superEnabled ? "1" : "0.55";
      superRealWrap.style.pointerEvents = superEnabled ? "auto" : "none";
    }
    if (superAggRow?._range) {
      superAggRow._range.disabled = !superEnabled;
      superAggRow._range.setAttribute("aria-disabled", superEnabled ? "false" : "true");
    }
    if (superPauseRow?._range) {
      superPauseRow._range.disabled = !superEnabled;
      superPauseRow._range.setAttribute("aria-disabled", superEnabled ? "false" : "true");
    }

    if (containsMeInput && containsMeInput._input) {
      const val = game.containsText || "";
      if (containsMeInput._input.value !== val) containsMeInput._input.value = val;
    }
    if (containsSpecInput && containsSpecInput._input) {
      const val = game.specContainsText || "";
      if (containsSpecInput._input.value !== val) containsSpecInput._input.value = val;
    }

    const basePriority = typeof game.priorityFeatures === "function" ? game.priorityFeatures() : priorityKeys;
    const rawPriority = Array.isArray(game.priorityOrder) ? game.priorityOrder.slice() : [];
    const seenPriority = new Set();
    const finalPriority = [];
    rawPriority.forEach((item) => {
      const key = (item || "").toString().toLowerCase();
      if (basePriority.includes(key) && !seenPriority.has(key)) {
        finalPriority.push(key);
        seenPriority.add(key);
      }
    });
    basePriority.forEach((key) => {
      if (!seenPriority.has(key)) {
        finalPriority.push(key);
        seenPriority.add(key);
      }
    });
    finalPriority.forEach((key, idx) => {
      const select = priorityControls.get(key);
      if (select) {
        const target = String(idx + 1);
        if (select.value !== target) select.value = target;
      }
    });

    const targetPrefSelf = Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen;
    const noticeParts = [];
    if (game.lengthMode) {
      if (game.coverageMode && game.foulMode) {
        noticeParts.push(`Target length (me): with coverage on it acts as a max (<= ${formatTargetLenLabel(targetPrefSelf, game.targetLen)}); foul words still take priority.`);
      } else if (game.coverageMode) {
        noticeParts.push(`Target length (me): acts as a max (<= ${formatTargetLenLabel(targetPrefSelf, game.targetLen)}) while optimizing alphabet coverage.`);
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
  window.addEventListener("beforeunload", () => {
    clearInterval(iv);
    autoJoinManager.disconnect();
  });

  document.body.appendChild(wrap);
  autoJoinManager.update(game.autoJoinAlways);
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

  const notifySettingsChanged = (opts = {}) => {
    if (typeof game._notifySettingsChanged === "function") {
      try {
        game._notifySettingsChanged(opts);
      } catch (err) {
        console.warn("[BombPartyShark] Failed to persist settings", err);
      }
    }
  };

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
    let handled = false;
    let recompute = false;
    if (k === "w") { game.togglePause(); handled = true; }
    else if (k === "arrowup") { game.setSpeed(Math.min(12, game.speed+1)); handled = true; }
    else if (k === "arrowdown") { game.setSpeed(Math.max(1, game.speed-1)); handled = true; }
    else if (k === "f") { game.toggleFoulMode(); handled = true; recompute = true; }
    else if (k === "c") { game.toggleCoverageMode(); handled = true; recompute = true; }
    else if (k === "s") { game.toggleAutoSuicide(); handled = true; }
    else if (k === "b") { game.toggleMistakes(); handled = true; }
    else if (k === "r") { game.resetCoverage(); handled = true; recompute = true; }
    else if (k === "t") { game.toggleLengthMode(); handled = true; recompute = true; }

    if (!handled) return;
    notifySettingsChanged({ recompute });
    render();
    ev.preventDefault();
  });
}

if (isBombPartyFrame()) setupBuddy();


















