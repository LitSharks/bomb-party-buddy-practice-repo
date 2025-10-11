/* Game.js - Bomb Party Shark
   - Loads word lists from LitShark API via background proxy (no CORS)
   - Coverage scoring prefers words that complete the most tallies:
       * counts how many still-needed letters a word covers
       * extra bonus for letters that are one-away (need==1)
       * rarity weighting (letters that appear in fewer words are weighted higher)
   - Exclusion/goals only affect tallying (not candidate filtering)
   - Retry next best candidate on invalid word (my turn)
   - Submit is robust (focus + input + keydown/keypress/keyup Enter)
   - Postfix ignored when auto-suicide is on
   - Butterfingers aggressiveness slider controls typo probability
   - Speed slider: slowest is slower now, fastest unchanged-ish
*/
const WORD_CACHE = new Map();
const WORD_CACHE_LOADING = new Map();
const WORD_CACHE_TTL_MS = 5 * 60 * 1000;

const LOCAL_MAIN_LISTS = Object.freeze({
  "en": "words1/en.txt",
  "de": "words1/de.txt",
  "fr": "words1/fr.txt",
  "es": "words1/es.txt",
  "pt-br": "words1/pt-br.txt",
  "nah": "words1/nah.txt",
  "pok-en": "words1/pok-en.txt",
  "pok-fr": "words1/pok-fr.txt",
  "pok-de": "words1/pok-de.txt"
});

const LOCAL_FOUL_LISTS = Object.freeze({
  "en": "words1/foul-words-en.txt",
  "default": "words1/foul-words-en.txt"
});

function pushWordCandidate(output, seen, candidate) {
  const word = (candidate ?? "").toString().trim().toLowerCase();
  if (!word || seen.has(word)) return;
  seen.add(word);
  output.push(word);
}

function toWordArrayFromText(text) {
  const out = [];
  const seen = new Set();
  if (!text) return out;
  const trimmed = text.trim();
  if (!trimmed) return out;
  const firstChar = trimmed[0];
  if (firstChar === '[' || firstChar === '{') {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.words)
          ? parsed.words
          : [];
      for (const candidate of arr) pushWordCandidate(out, seen, candidate);
      if (out.length) return out;
    } catch (err) {
      console.warn('[BombPartyShark] Failed to parse word payload as JSON, falling back to newline list.', err);
    }
  }
  for (const line of text.split(/\r?\n/)) {
    pushWordCandidate(out, seen, line);
  }
  return out;
}

async function fetchLocalText(path) {
  if (!path) return '';
  try {
    const url = chrome.runtime.getURL(path);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return '';
    return await res.text();
  } catch (err) {
    console.warn('[BombPartyShark] Failed to load local word list', path, err);
    return '';
  }
}

class Game {
  constructor(inputEl) {
    this.input = inputEl;

    // Word data
    this.lang = "en";
    this.words = [];
    this.foulWords = [];
    this.foulSet = new Set();
    this.pokemonWords = [];
    this.mineralWords = [];
    this.rareWords = [];

    // Per-letter rarity weights for coverage scoring
    this.letterWeights = new Array(26).fill(1);

    // Modes
    this.paused = false;
    this.instantMode = false;
    this.foulMode = false;
    this.coverageMode = false;
    this.mistakesEnabled = false;
    this.superRealisticEnabled = false;
    this.autoSuicide = false;
    this.autoJoinAlways = false;
    this.hyphenMode = false;
    this.containsMode = false;
    this.containsText = "";
    this.pokemonMode = false;
    this.mineralsMode = false;
    this.rareMode = false;

    // Length (self)
    this.lengthMode = false;
    this.targetLen = 8;
    this.targetLenPref = 8;

    // Spectator modes
    this.specLengthMode = false;
    this.specTargetLen = 8;
    this.specTargetLenPref = 8;
    this.specFoulMode = false;
    this.specHyphenMode = false;
    this.specContainsMode = false;
    this.specContainsText = "";
    this.specPokemonMode = false;
    this.specMineralsMode = false;
    this.specRareMode = false;

    // Suggestions
    this.suggestionsLimit = 5;

    // Priority order (highest priority first)
    this.priorityOrder = ["contains", "foul", "coverage", "hyphen", "length"];

    // Timing
    this.speed = 5;               // 1..12 (fastest unchanged; slowest slower)
    this.thinkingDelaySec = 0.0;  // 0..5
    this.superRealisticAggression = 0.25; // 0..1 probability per word
    this.superRealisticPauseSec = 0.6;    // pause duration for realistic stop

    // Butterfingers
    this.mistakesProb = 0.08;     // 0..0.30 (set by slider)

    // Messages
    this.preMsgEnabled = false;
    this.preMsgText = "";
    this.postfixEnabled = false;
    this.postfixText = "";

    // Turn state
    this.myTurn = false;
    this.syllable = "";
    this.selfRound = 0;
    this.spectatorRound = 0;

    // Round-local failure blacklist + last pool
    this._roundFailed = new Set();
    this._roundPool = [];
    this._roundCandidatesDetailed = [];
    this._roundSelectionContext = null;

    // Notice flags (for HUD messages)
    this.flagsRoundSelf = 0;
    this.flagsRoundSpectator = 0;
    this.lastFoulFallbackSelf = false;
    this.lastLenFallbackSelf = false;
    this.lastLenCapAppliedSelf = false;
    this.lastLenCapRelaxedSelf = false;
    this.lastLenSuppressedByFoulSelf = false;
    this.lastContainsFallbackSelf = false;
    this.lastHyphenFallbackSelf = false;
    this.lastPokemonFallbackSelf = false;
    this.lastMineralsFallbackSelf = false;
    this.lastRareFallbackSelf = false;
    this.lastFoulFallbackSpectator = false;
    this.lastLenFallbackSpectator = false;
    this.lastLenCapAppliedSpectator = false;
    this.lastLenCapRelaxedSpectator = false;
    this.lastLenSuppressedByFoulSpectator = false;
    this.lastContainsFallbackSpectator = false;
    this.lastHyphenFallbackSpectator = false;
    this.lastPokemonFallbackSpectator = false;
    this.lastMineralsFallbackSpectator = false;
    this.lastRareFallbackSpectator = false;

    // Coverage / goals
    this.coverageCounts = new Array(26).fill(0);
    this.excludeEnabled = false;
    this.excludeSpec = "x0 z0";       // default goals: treat x,z as 0
    this.targetCounts = new Array(26).fill(1);
    this._targetsManualOverride = false;

    // Tallies persistence hook
    this._onTalliesChanged = null;

    // HUD lists
    this.lastTopPicksSelf = [];
    this.lastTopPicksSelfDisplay = [];
    this.spectatorSuggestions = [];
    this.spectatorSuggestionsDisplay = [];
    this.lastSpectatorSyllable = "";

    this.maxWordLength = 0;

    // Back-compat
    this._typeAndSubmit = this.typeAndSubmit.bind(this);

    this._lastLoadedLang = null;
  }

  apiBase() { return "https://extensions.litshark.ca/api"; }

  normalizeLang(name) {
    const s = (name || "").toString().trim().toLowerCase();
    const map = {
      "english":"en","en":"en",
      "german":"de","de":"de",
      "french":"fr","fr":"fr",
      "spanish":"es","es":"es",
      "portuguese":"pt-br","pt-br":"pt-br","br":"pt-br",
      "nahuatl":"nah","nah":"nah",
      "pokemon (en)":"pok-en","pok-en":"pok-en",
      "pokemon (fr)":"pok-fr","pok-fr":"pok-fr",
      "pokemon (de)":"pok-de","pok-de":"pok-de"
    };
    return map[s] || "en";
  }

  async setLang(lang) {
    const normalized = this.normalizeLang(lang);
    const previousLang = this._lastLoadedLang;
    this.lang = normalized;

    try {
      await this.loadWordlists();
      if (!previousLang || previousLang !== normalized) {
        this.resetCoverage();
      }
    } catch (err) {
      console.error('[BombPartyShark] Failed to load word lists for', normalized, err);
    }
  }

  // ---- background fetch/post (avoids CORS) ----
  async extFetch(url) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: "extFetch", url }, (resp) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          if (!resp || resp.error) return reject(new Error(resp?.error || "No response"));
          resolve(resp.text || "");
        });
      } catch (e) { reject(e); }
    });
  }
  async extPost(url, body) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type: "extPost", url, body }, (resp) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          if (!resp || resp.error) return reject(new Error(resp?.error || "No response"));
          resolve(resp.text || "");
        });
      } catch (e) { reject(e); }
    });
  }


  async loadWordlists() {
    const lang = this.lang;
    const cached = WORD_CACHE.get(lang);
    const now = Date.now();
    if (cached && (now - cached.fetchedAt) < WORD_CACHE_TTL_MS) {
      this._applyWordData(cached);
      return;
    }

    let loadPromise = WORD_CACHE_LOADING.get(lang);
    if (!loadPromise) {
      loadPromise = this._fetchWordData(lang)
        .then((data) => {
          WORD_CACHE.set(lang, data);
          WORD_CACHE_LOADING.delete(lang);
          return data;
        })
        .catch((err) => {
          WORD_CACHE_LOADING.delete(lang);
          throw err;
        });
      WORD_CACHE_LOADING.set(lang, loadPromise);
    }

    try {
      const data = await loadPromise;
      this._applyWordData(data);
    } catch (err) {
      if (cached) {
        console.warn('[BombPartyShark] Falling back to cached word data for', lang, err);
        this._applyWordData(cached);
        return;
      }
      throw err;
    }
  }
  async _fetchWordData(lang) {
    const base = this.apiBase();
    const mainUrl = `${base}/words.php?lang=${encodeURIComponent(lang)}&list=main`;
    const foulUrl = `${base}/words.php?lang=${encodeURIComponent(lang)}&list=foul`;
    const pokemonUrl = `${base}/words.php?lang=${encodeURIComponent(lang)}&list=pok`;
    const mineralsUrl = `${base}/words.php?lang=${encodeURIComponent(lang)}&list=minerals`;
    const rareUrl = `${base}/words.php?lang=${encodeURIComponent(lang)}&list=rare`;

    let mainTxt = '';
    let foulTxt = '';
    let pokemonTxt = '';
    let mineralsTxt = '';
    let rareTxt = '';

    try {
      mainTxt = await this.extFetch(mainUrl);
    } catch (err) {
      console.warn('[BombPartyShark] Failed to load main word list from API for', lang, err);
    }

    try {
      foulTxt = await this.extFetch(foulUrl);
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err || '');
      if (msg.includes('404')) {
        console.info(`[BombPartyShark] No foul word list available from API for ${lang}; falling back to local default.`);
      } else {
        console.warn('[BombPartyShark] Failed to load foul word list from API for', lang, err);
      }
    }

    try {
      pokemonTxt = await this.extFetch(pokemonUrl);
    } catch (err) {
      console.warn('[BombPartyShark] Failed to load Pokémon word list from API for', lang, err);
    }

    try {
      mineralsTxt = await this.extFetch(mineralsUrl);
    } catch (err) {
      console.warn('[BombPartyShark] Failed to load minerals word list from API for', lang, err);
    }

    try {
      rareTxt = await this.extFetch(rareUrl);
    } catch (err) {
      console.warn('[BombPartyShark] Failed to load rare word list from API for', lang, err);
    }

    let words = toWordArrayFromText(mainTxt);
    let foulWords = toWordArrayFromText(foulTxt);
    let pokemonWords = toWordArrayFromText(pokemonTxt);
    let mineralWords = toWordArrayFromText(mineralsTxt);
    let rareWords = toWordArrayFromText(rareTxt);

    if (!words.length) {
      const localPath = LOCAL_MAIN_LISTS[lang] || LOCAL_MAIN_LISTS['en'];
      if (localPath) {
        const localTxt = await fetchLocalText(localPath);
        words = toWordArrayFromText(localTxt);
      }
    }

    if (!words.length) {
      throw new Error(`No word list available for language ${lang}`);
    }

    if (!foulWords.length) {
      const foulPath = LOCAL_FOUL_LISTS[lang] || LOCAL_FOUL_LISTS.default;
      if (foulPath) {
        const foulLocalTxt = await fetchLocalText(foulPath);
        foulWords = toWordArrayFromText(foulLocalTxt);
      }
    }

    const letterWeights = Game.computeLetterWeights(words);
    return {
      lang,
      words,
      foulWords,
      pokemonWords,
      mineralWords,
      rareWords,
      letterWeights,
      fetchedAt: Date.now()
    };
  }

  _applyWordData(data) {
    if (!data || !Array.isArray(data.words)) {
      throw new Error('Invalid word cache payload');
    }
    this.words = data.words.slice();
    this.foulWords = (data.foulWords || []).slice();
    this.pokemonWords = (data.pokemonWords || []).slice();
    this.mineralWords = (data.mineralWords || []).slice();
    this.rareWords = (data.rareWords || []).slice();
    this.foulSet = new Set(this.foulWords);
    this.letterWeights = (data.letterWeights || new Array(26).fill(1)).slice(0, 26);
    if (this.letterWeights.length < 26) {
      while (this.letterWeights.length < 26) this.letterWeights.push(1);
    }
    this._lastLoadedLang = data.lang;
    this.maxWordLength = this.words.reduce((max, word) => Math.max(max, (word || '').length || 0), 0);
    this.setTargetLen(this.targetLenPref ?? this.targetLen);
    this.setSpecTargetLen(this.specTargetLenPref ?? this.specTargetLen);
  }

  static computeLetterWeights(words) {
    const docFreq = new Array(26).fill(0);
    const totalWords = words.length || 1;
    for (const word of words) {
      const seen = new Set();
      for (let i = 0; i < word.length; i++) {
        const code = word.charCodeAt(i);
        if (code >= 97 && code <= 122) {
          const idx = code - 97;
          if (!seen.has(idx)) {
            docFreq[idx]++;
            seen.add(idx);
          }
        }
      }
    }

    const weights = new Array(26).fill(1);
    let sum = 0;
    for (let i = 0; i < 26; i++) {
      const freq = docFreq[i] / totalWords;
      const weight = 1 / Math.max(0.001, freq);
      weights[i] = weight;
      sum += weight;
    }
    const mean = sum / 26 || 1;
    for (let i = 0; i < 26; i++) {
      weights[i] = weights[i] / mean;
    }
    return weights;
  }
  // ---------- setters used by HUD ----------
  setSpeed(v) { this.speed = Math.max(1, Math.min(12, Math.floor(v))); }
  setThinkingDelaySec(v) { const n = Math.max(0, Math.min(5, Number(v))); this.thinkingDelaySec = isFinite(n) ? n : 0; }
  setSuggestionsLimit(v) { this.suggestionsLimit = Math.max(1, Math.min(20, Math.floor(v))); }
  toggleSuperRealistic() { this.superRealisticEnabled = !this.superRealisticEnabled; }
  setSuperRealisticAggression(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    this.superRealisticAggression = Math.max(0, Math.min(1, n));
  }
  setSuperRealisticPauseSec(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    this.superRealisticPauseSec = Math.max(0, Math.min(5, n));
  }

  togglePause() { this.paused = !this.paused; }
  toggleInstantMode() { this.instantMode = !this.instantMode; }
  toggleFoulMode() { this.foulMode = !this.foulMode; }
  toggleCoverageMode() { this.coverageMode = !this.coverageMode; }
  toggleMistakes() { this.mistakesEnabled = !this.mistakesEnabled; }
  toggleAutoSuicide() { this.autoSuicide = !this.autoSuicide; }
  toggleAutoJoinAlways() { this.autoJoinAlways = !this.autoJoinAlways; }
  setAutoJoinAlways(v) { this.autoJoinAlways = !!v; }
  toggleHyphenMode() { this.hyphenMode = !this.hyphenMode; }
  togglePokemonMode() { this.pokemonMode = !this.pokemonMode; }
  toggleMineralsMode() { this.mineralsMode = !this.mineralsMode; }
  toggleRareMode() { this.rareMode = !this.rareMode; }

  toggleLengthMode() { this.lengthMode = !this.lengthMode; }
  _normalizeTargetLenPref(value) {
    const pref = Math.max(3, Math.min(21, Math.floor(value)));
    if (pref === 21) {
      const fallback = Math.max(3, this.maxWordLength || 0);
      return { pref, actual: fallback > 0 ? fallback : 20 };
    }
    return { pref, actual: pref };
  }
  setTargetLen(n) {
    const { pref, actual } = this._normalizeTargetLenPref(Number.isFinite(n) ? n : this.targetLenPref);
    this.targetLenPref = pref;
    this.targetLen = actual;
  }
  toggleContainsMode() { this.containsMode = !this.containsMode; }
  setContainsText(t) { this.containsText = (t ?? ""); }

  toggleSpecLength() { this.specLengthMode = !this.specLengthMode; }
  setSpecTargetLen(n) {
    const { pref, actual } = this._normalizeTargetLenPref(Number.isFinite(n) ? n : this.specTargetLenPref);
    this.specTargetLenPref = pref;
    this.specTargetLen = actual;
  }
  toggleSpecFoul() { this.specFoulMode = !this.specFoulMode; }
  toggleSpecHyphenMode() { this.specHyphenMode = !this.specHyphenMode; }
  toggleSpecContainsMode() { this.specContainsMode = !this.specContainsMode; }
  setSpecContainsText(t) { this.specContainsText = (t ?? ""); }
  toggleSpecPokemonMode() { this.specPokemonMode = !this.specPokemonMode; }
  toggleSpecMineralsMode() { this.specMineralsMode = !this.specMineralsMode; }
  toggleSpecRareMode() { this.specRareMode = !this.specRareMode; }

  setPreMsgEnabled(b) { this.preMsgEnabled = !!b; }
  setPreMsgText(t) { this.preMsgText = (t || ""); }
  setPostfixEnabled(b) { this.postfixEnabled = !!b; }
  setPostfixText(t) { this.postfixText = (t || ""); }

  setMistakesProb(p) { // p is 0..0.30
    const n = Math.max(0, Math.min(0.30, Number(p)));
    this.mistakesProb = isFinite(n) ? n : 0.08;
  }

  priorityFeatures() { return ["contains", "foul", "coverage", "hyphen", "length"]; }

  _ensurePriorityOrder(order = this.priorityOrder) {
    const base = this.priorityFeatures();
    const seen = new Set();
    const final = [];
    if (Array.isArray(order)) {
      for (const key of order) {
        if (typeof key !== "string") continue;
        const lower = key.toLowerCase();
        if (!base.includes(lower)) continue;
        if (seen.has(lower)) continue;
        final.push(lower);
        seen.add(lower);
      }
    }
    for (const key of base) {
      if (!seen.has(key)) {
        final.push(key);
        seen.add(key);
      }
    }
    this.priorityOrder = final;
    return final;
  }

  setPriorityOrder(order) {
    this._ensurePriorityOrder(order);
  }

  setPriorityPosition(key, position) {
    const base = this.priorityFeatures();
    const normalized = (typeof key === "string" && base.includes(key.toLowerCase())) ? key.toLowerCase() : base[0];
    const order = this._ensurePriorityOrder().filter(item => item !== normalized);
    const idx = Math.max(0, Math.min(base.length - 1, Number.isFinite(position) ? Math.floor(position) : 0));
    order.splice(idx, 0, normalized);
    this.priorityOrder = order;
  }

  setExcludeEnabled(b) {
    this.excludeEnabled = !!b;
    if (!this._targetsManualOverride) this.recomputeTargets();
  }
  setExcludeSpec(spec) {
    this.excludeSpec = (spec || "");
    this._targetsManualOverride = false;
    this.recomputeTargets();
  }

  setTalliesChangedCallback(fn) {
    this._onTalliesChanged = typeof fn === 'function' ? fn : null;
  }

  _emitTalliesChanged() {
    if (typeof this._onTalliesChanged === 'function') {
      try { this._onTalliesChanged(); } catch (err) { console.warn('[BombPartyShark] tally listener failed', err); }
    }
  }
  resetCoverage() { this.coverageCounts.fill(0); this._roundFailed.clear(); this._emitTalliesChanged(); }

  setCoverageCount(idx, value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return;
    if (idx < 0 || idx >= 26) return;
    const target = Math.max(0, this.targetCounts[idx] || 0);
    const max = target;
    const clamped = Math.max(0, Math.min(max, n));
    this.coverageCounts[idx] = clamped;
    this._emitTalliesChanged();
  }

  adjustCoverageCount(idx, delta) {
    const current = this.coverageCounts[idx] || 0;
    this.setCoverageCount(idx, current + delta);
  }

  setTargetCount(idx, value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return;
    if (idx < 0 || idx >= 26) return;
    const clamped = Math.max(0, Math.min(99, n));
    this.targetCounts[idx] = clamped;
    if ((this.coverageCounts[idx] || 0) > clamped) {
      this.coverageCounts[idx] = clamped;
    }
    this._targetsManualOverride = true;
    this._emitTalliesChanged();
  }

  adjustTargetCount(idx, delta) {
    const current = this.targetCounts[idx] || 0;
    this.setTargetCount(idx, current + delta);
  }

  setAllTargetCounts(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(0, Math.min(99, n));
    for (let i = 0; i < 26; i++) {
      this.targetCounts[i] = clamped;
      if ((this.coverageCounts[i] || 0) > clamped) {
        this.coverageCounts[i] = clamped;
      }
    }
    this._targetsManualOverride = true;
    this._emitTalliesChanged();
  }

  recomputeTargets() {
    const tgt = new Array(26).fill(1);
    // Supported:
    //  - tokens "a3 f2 x0"
    //  - bare letters "xz" (means x0 z0)
    //  - "majorityN" sets all to N before overrides
    const s = (this.excludeSpec || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (s) {
      const maj = s.match(/majority(\d{1,2})/);
      if (maj) {
        const base = Math.max(0, Math.min(99, parseInt(maj[1], 10)));
        for (let i = 0; i < 26; i++) tgt[i] = base;
      }
      const pairRe = /([a-z])\s*(\d{1,2})/g;
      let m;
      while ((m = pairRe.exec(s))) {
        const idx = m[1].charCodeAt(0) - 97;
        const val = Math.max(0, Math.min(99, parseInt(m[2], 10)));
        if (idx >= 0 && idx < 26) tgt[idx] = val;
      }
      const bare = s.replace(/majority\d{1,2}/g, "")
                    .replace(/([a-z])\s*\d{1,2}/g, "")
                    .replace(/\s+/g, "");
      for (const ch of bare) {
        const idx = ch.charCodeAt(0) - 97;
        if (idx >= 0 && idx < 26) tgt[idx] = 0;
      }
    }
    this.targetCounts = tgt;
    this._targetsManualOverride = false;
  }


  static highlightSyllable(word, syl) {
    if (!syl) return word;
    const i = word.indexOf(syl);
    if (i < 0) return word;
    const pre = word.slice(0, i);
    const mid = word.slice(i, i + syl.length);
    const post = word.slice(i + syl.length);
    return `${pre}<b style="font-weight:900;text-transform:uppercase;font-size:1.15em">${mid}</b>${post}`;
  }

  _lettersOf(word) {
    const counts = new Map();
    for (let i = 0; i < word.length; i++) {
      const c = word[i];
      const code = c.charCodeAt(0);
      if (code < 97 || code > 122) continue;
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return counts;
  }

  _maybeResetCoverageOnComplete() {
    let hasPositiveTarget = false;
    for (let i = 0; i < 26; i++) {
      const target = this.targetCounts[i] || 0;
      if (target > 0) {
        hasPositiveTarget = true;
        if ((this.coverageCounts[i] || 0) < target) {
          return;
        }
      }
    }
    if (!hasPositiveTarget) return;
    this.resetCoverage();
  }

  // Coverage score:
  //  - 1 * weight for each still-needed letter
  //  - +1 * weight extra if that letter is one-away (have == target-1)
  //  - small noise for tie-breaks
  _coverageScore(word) {
    const letters = this._lettersOf(word);
    let score = 0;
    letters.forEach((count, c) => {
      const idx = c.charCodeAt(0) - 97;
      const have = this.coverageCounts[idx] || 0;
      const want = this.targetCounts[idx] || 0;
      if (want <= 0) return;            // excluded/ignored
      if (have >= want) return;
      const need = Math.max(0, want - have);
      const contribution = Math.min(count, need);
      if (contribution <= 0) return;
      const w = this.letterWeights[idx] || 1;
      score += contribution * w;
      if (have + contribution >= want) {
        score += 1 * w; // finishing this letter
      }
    });
    return score;
  }

  _pickCandidatesBase(syllable, pool) {
    const syl = (syllable || "").toLowerCase();
    if (!syl) return [];
    // exclusions do NOT filter here - only affect tally later
    return pool.filter(w => w.includes(syl));
  }

  _generateCandidates(context, syllable, limit) {
    const lim = Math.max(1, Math.min(20, limit | 0));
    const syl = (syllable || "").toLowerCase();
    if (!syl) {
      return { orderedWords: [], limitedWords: [], displayEntries: [], flags: {} };
    }

    const isSelf = context === 'self';
    const coverageMode = isSelf ? this.coverageMode : false;
    const lengthMode = isSelf ? this.lengthMode : this.specLengthMode;
    const targetLen = isSelf ? this.targetLen : this.specTargetLen;
    const foulMode = isSelf ? this.foulMode : this.specFoulMode;
    const pokemonMode = isSelf ? this.pokemonMode : this.specPokemonMode;
    const mineralsMode = isSelf ? this.mineralsMode : this.specMineralsMode;
    const rareMode = isSelf ? this.rareMode : this.specRareMode;
    const hyphenMode = isSelf ? this.hyphenMode : this.specHyphenMode;
    const containsMode = isSelf ? this.containsMode : this.specContainsMode;
    const containsNeedleRaw = (isSelf ? this.containsText : this.specContainsText) || '';
    const containsNeedle = containsNeedleRaw.trim().toLowerCase();
    const containsActive = containsMode && containsNeedle.length > 0;

    const foulPool = foulMode ? this._pickCandidatesBase(syllable, this.foulWords) : [];
    const pokemonPool = pokemonMode ? this._pickCandidatesBase(syllable, this.pokemonWords) : [];
    const mineralsPool = mineralsMode ? this._pickCandidatesBase(syllable, this.mineralWords) : [];
    const rarePool = rareMode ? this._pickCandidatesBase(syllable, this.rareWords) : [];
    const mainPool = this._pickCandidatesBase(syllable, this.words);

    const candidateMap = new Map();
    const addWords = (words, source) => {
      if (!Array.isArray(words)) return;
      for (const rawWord of words) {
        const word = (rawWord || '').toString().trim();
        if (!word) continue;
        const key = word.toLowerCase();
        if (!candidateMap.has(key)) {
          candidateMap.set(key, { word, sources: new Set([source]) });
        } else {
          candidateMap.get(key).sources.add(source);
        }
      }
    };

    addWords(mainPool, 'main');
    if (foulMode) addWords(foulPool, 'foul');
    if (pokemonMode) addWords(pokemonPool, 'pokemon');
    if (mineralsMode) addWords(mineralsPool, 'minerals');
    if (rareMode) addWords(rarePool, 'rare');

    const flags = {
      foulFallback: foulMode && foulPool.length === 0,
      pokemonFallback: pokemonMode && pokemonPool.length === 0,
      mineralsFallback: mineralsMode && mineralsPool.length === 0,
      rareFallback: rareMode && rarePool.length === 0,
      lenFallback: false,
      lenCapApplied: false,
      lenCapRelaxed: false,
      lenSuppressed: false,
      containsFallback: false,
      hyphenFallback: false
    };

    const priority = this._ensurePriorityOrder();

    if (!candidateMap.size) {
      return {
        orderedWords: [],
        limitedWords: [],
        displayEntries: [],
        flags,
        candidateDetails: [],
        selectionContext: {
          coverageMode,
          lengthMode,
          hyphenMode,
          containsActive,
          foulMode,
          pokemonMode,
          mineralsMode,
          rareMode,
          priority
        }
      };
    }

    const specialPriority = ['foul', 'pokemon', 'minerals', 'rare'];
    const specialRanks = { foul: 4, pokemon: 3, minerals: 2, rare: 1 };

    let containsMatches = 0;
    let hyphenMatches = 0;
    let exactCount = 0;
    let nearCount = 0;
    let withinCapCount = 0;

    const candidates = Array.from(candidateMap.values()).map(info => {
      const word = info.word;
      const lower = word.toLowerCase();
      let specialType = null;
      let specialRank = 0;
      for (const type of specialPriority) {
        const enabled = (type === 'foul' ? foulMode : type === 'pokemon' ? pokemonMode : type === 'minerals' ? mineralsMode : rareMode);
        if (!enabled) continue;
        if (info.sources.has(type)) {
          specialType = type;
          specialRank = specialRanks[type];
          break;
        }
      }

      const containsIdx = containsActive ? lower.indexOf(containsNeedle) : -1;
      const containsMatch = containsIdx >= 0 ? 1 : 0;
      if (containsMatch) containsMatches++;

      const hyphenMatch = hyphenMode && word.includes('-') ? 1 : 0;
      if (hyphenMatch) hyphenMatches++;

      let lengthCategory = 0;
      let lengthTone = null;
      let lengthDistance = Math.abs(word.length - targetLen);
      if (lengthMode) {
        if (coverageMode) {
          if (word.length <= targetLen) {
            lengthCategory = 2;
            withinCapCount++;
          }
        } else {
          if (word.length === targetLen) {
            lengthCategory = 2;
            lengthTone = 'lengthExact';
            exactCount++;
          } else if (Math.abs(word.length - targetLen) <= 6) {
            lengthCategory = 1;
            lengthTone = 'lengthFlex';
            nearCount++;
          }
        }
      }

      const coverageScore = coverageMode ? this._coverageScore(lower) : 0;

      return {
        word,
        lower,
        specialType,
        specialRank,
        containsMatch,
        containsIdx,
        hyphenMatch,
        lengthCategory,
        lengthTone,
        lengthDistance,
        coverageScore,
        tone: 'default'
      };
    });

    if (containsActive && containsMatches === 0) flags.containsFallback = true;
    if (hyphenMode && hyphenMatches === 0) flags.hyphenFallback = true;

    let workingCandidates = candidates;
    if (coverageMode && lengthMode) {
      const withinCap = candidates.filter(c => c.word.length <= targetLen);
      if (withinCap.length) {
        workingCandidates = withinCap;
        flags.lenCapApplied = true;
      } else {
        flags.lenCapRelaxed = true;
      }
    }

    const comparators = {
      contains: (a, b) => {
        if (!containsActive) return 0;
        const diff = b.containsMatch - a.containsMatch;
        if (diff !== 0) return diff;
        if (a.containsMatch && b.containsMatch) {
          return a.containsIdx - b.containsIdx;
        }
        return 0;
      },
      foul: (a, b) => {
        if (!foulMode && !pokemonMode && !mineralsMode && !rareMode) return 0;
        return (b.specialRank - a.specialRank);
      },
      coverage: (a, b) => {
        if (!coverageMode) return 0;
        const diff = b.coverageScore - a.coverageScore;
        if (diff !== 0) return diff;
        return a.word.length - b.word.length;
      },
      hyphen: (a, b) => {
        if (!hyphenMode) return 0;
        return (b.hyphenMatch - a.hyphenMatch);
      },
      length: (a, b) => {
        if (!lengthMode) return 0;
        const diff = b.lengthCategory - a.lengthCategory;
        if (diff !== 0) return diff;
        if (!coverageMode && a.lengthCategory > 0 && b.lengthCategory > 0) {
          const closeDiff = a.lengthDistance - b.lengthDistance;
          if (closeDiff !== 0) return closeDiff;
        }
        if (coverageMode && a.word.length !== b.word.length) {
          return a.word.length - b.word.length;
        }
        return 0;
      }
    };

    workingCandidates = workingCandidates.sort((a, b) => {
      for (const feature of priority) {
        const cmp = (comparators[feature] || (() => 0))(a, b);
        if (cmp !== 0) return cmp;
      }
      if (b.coverageScore !== a.coverageScore) return b.coverageScore - a.coverageScore;
      if (a.word.length !== b.word.length) return a.word.length - b.word.length;
      return a.word.localeCompare(b.word);
    });

    for (const candidate of workingCandidates) {
      let tone = null;
      for (const feature of priority) {
        if (feature === 'contains' && containsActive && candidate.containsMatch) { tone = 'contains'; break; }
        if (feature === 'foul' && candidate.specialRank > 0) { tone = candidate.specialType || 'default'; break; }
        if (feature === 'hyphen' && hyphenMode && candidate.hyphenMatch) { tone = 'hyphen'; break; }
        if (feature === 'length' && lengthMode && !coverageMode) {
          if (candidate.lengthCategory === 2) { tone = 'lengthExact'; break; }
          if (candidate.lengthCategory === 1) { tone = 'lengthFlex'; break; }
        }
      }
      if (!tone) {
        if (candidate.specialRank > 0) tone = candidate.specialType;
        else if (lengthMode && !coverageMode) {
          if (candidate.lengthCategory === 2) tone = 'lengthExact';
          else if (candidate.lengthCategory === 1) tone = 'lengthFlex';
        }
      }
      candidate.tone = tone || 'default';
    }

    if (lengthMode && !coverageMode) {
      const flexUsed = workingCandidates.some(c => c.lengthCategory === 1);
      if (exactCount === 0 || (exactCount < lim && flexUsed)) {
        flags.lenFallback = true;
      }
    }

    if (lengthMode && (foulMode || pokemonMode || mineralsMode || rareMode)) {
      const specialCount = workingCandidates.filter(c => c.specialRank > 0).length;
      if (specialCount >= lim && !coverageMode) {
        flags.lenSuppressed = true;
      }
    }

    workingCandidates.forEach((c, idx) => {
      c.rank = idx;
    });

    const orderedWords = workingCandidates.map(c => c.word);
    const displayEntries = workingCandidates.slice(0, lim).map(c => ({ word: c.word, tone: c.tone }));
    const candidateDetails = workingCandidates.map(c => ({
      word: c.word,
      lower: c.lower,
      rank: c.rank,
      specialType: c.specialType,
      specialRank: c.specialRank,
      containsMatch: c.containsMatch,
      containsIdx: c.containsIdx,
      hyphenMatch: c.hyphenMatch,
      lengthCategory: c.lengthCategory,
      lengthDistance: c.lengthDistance,
      coverageScore: c.coverageScore,
      tone: c.tone
    }));

    const selectionContext = {
      coverageMode,
      lengthMode,
      hyphenMode,
      containsActive,
      foulMode,
      pokemonMode,
      mineralsMode,
      rareMode,
      priority
    };

    return {
      orderedWords,
      limitedWords: orderedWords.slice(0, lim),
      displayEntries,
      flags,
      candidateDetails,
      selectionContext
    };
  }

  // -------- candidate selection (self) --------
  getTopCandidates(syllable, limit) {
    const result = this._generateCandidates('self', syllable, limit);
    this.flagsRoundSelf = this.selfRound;
    this.lastFoulFallbackSelf = !!result.flags.foulFallback;
    this.lastPokemonFallbackSelf = !!result.flags.pokemonFallback;
    this.lastMineralsFallbackSelf = !!result.flags.mineralsFallback;
    this.lastRareFallbackSelf = !!result.flags.rareFallback;
    this.lastLenFallbackSelf = !!result.flags.lenFallback;
    this.lastLenCapAppliedSelf = !!result.flags.lenCapApplied;
    this.lastLenCapRelaxedSelf = !!result.flags.lenCapRelaxed;
    this.lastLenSuppressedByFoulSelf = !!result.flags.lenSuppressed;
    this.lastContainsFallbackSelf = !!result.flags.containsFallback;
    this.lastHyphenFallbackSelf = !!result.flags.hyphenFallback;

    this._roundPool = result.orderedWords.slice();
    this._roundCandidatesDetailed = Array.isArray(result.candidateDetails) ? result.candidateDetails.slice() : [];
    this._roundSelectionContext = result.selectionContext || null;
    this.lastTopPicksSelf = result.limitedWords.slice();
    this.lastTopPicksSelfDisplay = result.displayEntries.slice();
    return this.lastTopPicksSelf;
  }

  // -------- spectator suggestions --------
  generateSpectatorSuggestions(syllable, limit) {
    const result = this._generateCandidates('spectator', syllable, limit);
    this.flagsRoundSpectator = this.spectatorRound;
    this.lastSpectatorSyllable = syllable;

    this.lastFoulFallbackSpectator = !!result.flags.foulFallback;
    this.lastPokemonFallbackSpectator = !!result.flags.pokemonFallback;
    this.lastMineralsFallbackSpectator = !!result.flags.mineralsFallback;
    this.lastRareFallbackSpectator = !!result.flags.rareFallback;
    this.lastLenFallbackSpectator = !!result.flags.lenFallback;
    this.lastLenCapAppliedSpectator = !!result.flags.lenCapApplied;
    this.lastLenCapRelaxedSpectator = !!result.flags.lenCapRelaxed;
    this.lastLenSuppressedByFoulSpectator = !!result.flags.lenSuppressed;
    this.lastContainsFallbackSpectator = !!result.flags.containsFallback;
    this.lastHyphenFallbackSpectator = !!result.flags.hyphenFallback;

    this.spectatorSuggestionsDisplay = result.displayEntries.slice();
    this.spectatorSuggestions = result.limitedWords.slice();
    return this.spectatorSuggestions;
  }

  // -------- typing / submitting --------
  _ensureInput() {
    if (this.input && document.body.contains(this.input)) return this.input;
    const selfTurns = document.getElementsByClassName("selfTurn");
    if (selfTurns.length) {
      this.input = selfTurns[0].getElementsByTagName("input")[0] || null;
    } else {
      this.input = document.querySelector("input") || null;
    }
    return this.input;
  }

  // Map speed(1..12) -> per-char delay ms (slowest much slower; fastest ~8ms)
  _charDelayMs() {
    const t = (this.speed - 1) / 11;               // 0..1
    const slow = 300;                               // ms at speed 1 (slower than before)
    const fast = 8;                                 // ms at speed 12 (fast as before)
    return Math.round(slow + (fast - slow) * t);    // linear
  }

  _sleep(ms) {
    if (!ms || ms <= 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _emitInputEvent(input) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  _inputMaxLength(input) {
    if (!input) return null;
    const attr = input.getAttribute?.("maxlength");
    if (!attr) return null;
    const max = Number(attr);
    return Number.isFinite(max) && max > 0 ? max : null;
  }

  _truncateToMax(input, text) {
    const raw = text ?? "";
    const max = this._inputMaxLength(input);
    if (max === null) return raw;
    if (raw.length <= max) return raw;
    return raw.slice(0, max);
  }

  _setInputValueRespectingMax(input, text) {
    if (!input) return "";
    const finalValue = this._truncateToMax(input, text);
    input.value = finalValue;
    this._emitInputEvent(input);
    return finalValue;
  }

  async _waitForInput(timeoutMs = 1500) {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    let input = this._ensureInput();
    while (!input && Date.now() < deadline) {
      await this._sleep(25);
      input = this._ensureInput();
    }
    return input;
  }

  _randomLetterExcept(correct) {
    const pool = 'abcdefghijklmnopqrstuvwxyz';
    const lowerCorrect = (correct || '').toLowerCase();
    let idx = Math.floor(Math.random() * pool.length);
    let ch = pool[idx];
    if (ch === lowerCorrect) {
      ch = pool[(idx + 7) % pool.length];
    }
    return ch;
  }

  async _backspaceChars(input, count, delayMs) {
    if (!input || !count || count <= 0) return;
    const delay = Math.max(30, Math.floor(delayMs || 0));
    for (let i = 0; i < count; i++) {
      input.value = input.value.slice(0, -1);
      this._emitInputEvent(input);
      await this._sleep(delay);
    }
  }

  async _typeTextSequence(input, text, perCharDelay, options = {}) {
    if (!input || text === undefined || text === null) return;
    const seq = typeof text === "string" ? text : String(text);
    if (!seq.length) return;
    const allowMistakes = options.allowMistakes !== false;
    const maxLen = this._inputMaxLength(input);
    const canTypeChar = () => maxLen === null || input.value.length < maxLen;
    for (let i = 0; i < seq.length; i++) {
      const ch = seq[i];
      if (!canTypeChar()) break;
      if (allowMistakes && this.mistakesEnabled && !this.autoSuicide && Math.random() < this.mistakesProb && canTypeChar()) {
        input.value += ch;
        this._emitInputEvent(input);
        await this._sleep(perCharDelay);
        input.value = input.value.slice(0, -1);
        this._emitInputEvent(input);
        await this._sleep(perCharDelay);
      }
      if (!canTypeChar()) break;
      input.value += ch;
      this._emitInputEvent(input);
      await this._sleep(perCharDelay);
    }
  }


  async _typeWordWithRealism(input, word, perCharDelay) {
    const raw = typeof word === 'string' ? word : String(word ?? '');
    if (!raw.length) return;
    const realismActive = this.superRealisticEnabled && !this.instantMode && !this.autoSuicide && !raw.startsWith('/');
    if (!realismActive) {
      await this._typeTextSequence(input, raw, perCharDelay);
      return;
    }

    const aggression = Math.max(0, Math.min(1, this.superRealisticAggression || 0));
    const pauseMsConfigured = Math.max(0, (this.superRealisticPauseSec || 0) * 1000);
    const scenarioPool = [];
    if (raw.length >= 4 && pauseMsConfigured > 10) scenarioPool.push('pause');
    if (raw.length >= 3) scenarioPool.push('overrun');
    if (raw.length >= 2) scenarioPool.push('stutter');

    const shouldAddFlair = Math.random() < aggression && scenarioPool.length > 0;
    const typingOpts = { allowMistakes: false };
    if (!shouldAddFlair) {
      await this._typeTextSequence(input, raw, perCharDelay, typingOpts);
      return;
    }

    const scenario = scenarioPool[Math.floor(Math.random() * scenarioPool.length)];
    const baseDelay = Math.max(35, perCharDelay | 0);
    try {
      if (scenario === 'pause') {
        const pivot = Math.max(1, Math.floor(raw.length / 2));
        await this._typeTextSequence(input, raw.slice(0, pivot), perCharDelay, typingOpts);
        const jitter = pauseMsConfigured * (0.35 + Math.random() * 0.4);
        if (pauseMsConfigured > 0) {
          await this._sleep(pauseMsConfigured + jitter);
        }
        await this._typeTextSequence(input, raw.slice(pivot), perCharDelay, typingOpts);
      } else if (scenario === 'overrun') {
        const maxIdx = raw.length - 2;
        const minIdx = 1;
        const idx = minIdx + Math.floor(Math.random() * Math.max(1, maxIdx - minIdx + 1));
        const before = raw.slice(0, idx);
        const correct = raw[idx];
        const after = raw.slice(idx + 1);
        const wrong = this._randomLetterExcept(correct);

        await this._typeTextSequence(input, before, perCharDelay, typingOpts);
        await this._typeTextSequence(input, wrong, perCharDelay, { allowMistakes: false });
        await this._sleep(Math.max(baseDelay * 0.6, 40));
        await this._backspaceChars(input, 1, Math.max(baseDelay * 0.8, 40));
        await this._sleep(Math.max(baseDelay * 0.75, 45));
        await this._typeTextSequence(input, correct, perCharDelay, typingOpts);
        if (after.length) {
          await this._typeTextSequence(input, after, perCharDelay, typingOpts);
        }
      } else if (scenario === 'stutter') {
        const idx = Math.floor(Math.random() * raw.length);
        const before = raw.slice(0, idx);
        const target = raw[idx];
        const after = raw.slice(idx + 1);
        await this._typeTextSequence(input, before, perCharDelay, typingOpts);
        const repeats = 2 + Math.floor(Math.random() * 2);
        for (let attempt = 0; attempt < repeats - 1; attempt++) {
          await this._typeTextSequence(input, target, perCharDelay, typingOpts);
          await this._sleep(Math.max(baseDelay * 0.6, 35));
          await this._backspaceChars(input, 1, Math.max(baseDelay * 0.75, 40));
        }
        await this._typeTextSequence(input, target, perCharDelay, typingOpts);
        if (after.length) {
          await this._typeTextSequence(input, after, perCharDelay, typingOpts);
        }
      }
    } catch (err) {
      console.debug('[BombPartyShark] super realistic typing fell back', err);
      await this._typeTextSequence(input, raw, perCharDelay, typingOpts);
      return;
    }

    const targetValue = this._truncateToMax(input, raw);
    if (input.value !== targetValue) {
      input.value = targetValue;
      this._emitInputEvent(input);
    }
    await this._sleep(Math.max(baseDelay * 0.6, 40));
  }


  async playTurn() {
    if (this.autoSuicide) {
      await this.typeAndSubmit("/suicide", /*ignorePostfix=*/true);
      return;
    }
    if (this.thinkingDelaySec > 0) {
      await new Promise(r => setTimeout(r, this.thinkingDelaySec * 1000));
    }
    this._roundFailed.clear();
    const picks = this.getTopCandidates(this.syllable, this.suggestionsLimit);
    this.lastTopPicksSelf = picks;
    const word = this._pickNextNotFailed();
    if (word) await this.typeAndSubmit(word);
  }

  _pickNextNotFailed() {
    const detailed = Array.isArray(this._roundCandidatesDetailed) ? this._roundCandidatesDetailed : [];
    const context = this._roundSelectionContext || {};
    if (detailed.length) {
      const available = detailed.filter(c => !this._roundFailed.has(c.lower));
      if (available.length) {
        const priority = Array.isArray(context.priority) ? context.priority : this._ensurePriorityOrder();
        let pool = available.slice();
        for (const feature of priority) {
          if (feature === 'contains' && context.containsActive) {
            const matches = pool.filter(c => c.containsMatch > 0);
            if (matches.length) { pool = matches; continue; }
          }
          if (feature === 'foul' && (context.foulMode || context.pokemonMode || context.mineralsMode || context.rareMode)) {
            const bestRank = Math.max(...pool.map(c => c.specialRank || 0));
            const matches = pool.filter(c => (c.specialRank || 0) === bestRank);
            if (matches.length) { pool = matches; continue; }
          }
          if (feature === 'coverage' && context.coverageMode) {
            const maxScore = Math.max(...pool.map(c => c.coverageScore || 0));
            const matches = pool.filter(c => (c.coverageScore || 0) === maxScore);
            if (matches.length) { pool = matches; continue; }
          }
          if (feature === 'hyphen' && context.hyphenMode) {
            const matches = pool.filter(c => c.hyphenMatch > 0);
            if (matches.length) { pool = matches; continue; }
          }
          if (feature === 'length' && context.lengthMode) {
            const bestCategory = Math.max(...pool.map(c => c.lengthCategory || 0));
            if (bestCategory > 0) {
              let matches = pool.filter(c => (c.lengthCategory || 0) === bestCategory);
              if (context.coverageMode) {
                const bestLen = Math.min(...matches.map(c => c.word.length));
                matches = matches.filter(c => c.word.length === bestLen);
              } else {
                const bestDistance = Math.min(...matches.map(c => c.lengthDistance ?? Number.POSITIVE_INFINITY));
                matches = matches.filter(c => (c.lengthDistance ?? Number.POSITIVE_INFINITY) === bestDistance);
              }
              if (matches.length) { pool = matches; continue; }
            }
          }
        }
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (pick) return pick.word;
      }
    }

    for (const w of this._roundPool) {
      if (!this._roundFailed.has(w)) return w;
    }
    return null;
  }

  async typeAndSubmit(word, ignorePostfix=false) {
    const input = await this._waitForInput(); if (!input) return;

    input.focus();
    await Promise.resolve();
    this._setInputValueRespectingMax(input, "");

    const perCharDelay = this._charDelayMs();
    const instant = !!this.instantMode;
    const plainTypingOpts = this.superRealisticEnabled ? { allowMistakes: false } : undefined;

    if (this.preMsgEnabled && this.preMsgText && !this.autoSuicide) {
      if (instant) {
        this._setInputValueRespectingMax(input, this.preMsgText);
        await this._sleep(Math.max(40, perCharDelay));
        this._setInputValueRespectingMax(input, "");
      } else {
        await this._typeTextSequence(input, this.preMsgText, perCharDelay, plainTypingOpts);
        await this._sleep(Math.max(80, perCharDelay * 4));
        this._setInputValueRespectingMax(input, "");
      }
    }

    if (instant) {
      this._setInputValueRespectingMax(input, word);
    } else {
      await this._typeWordWithRealism(input, word, perCharDelay);
    }

    if (this.postfixEnabled && this.postfixText && !this.autoSuicide && !ignorePostfix) {
      if (instant) {
        this._setInputValueRespectingMax(input, `${input.value}${this.postfixText}`);
      } else {
        await this._typeTextSequence(input, this.postfixText, perCharDelay, plainTypingOpts);
      }
    }

    const enterOpts = { key: "Enter", code: "Enter", which: 13, keyCode: 13, bubbles: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
    input.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
    input.dispatchEvent(new KeyboardEvent("keyup", enterOpts));
    await new Promise(r => setTimeout(r, 10));

    if (document.activeElement !== input) input.focus();
    const form = input.closest("form");
    if (form && typeof form.requestSubmit === "function") {
      form.requestSubmit();
    }
  }


  onCorrectWord(word) {
    if (!this.myTurn) return;
    // Only tally toward goals with target > 0
    const letters = this._lettersOf((word || "").toLowerCase());
    letters.forEach((count, c) => {
      const idx = c.charCodeAt(0) - 97;
      if (idx >= 0 && idx < 26 && this.targetCounts[idx] > 0) {
        this.coverageCounts[idx] += count;
      }
    });
    this._maybeResetCoverageOnComplete();
    this._emitTalliesChanged();
  }

  onFailedWord(myTurn, word, reason) {
    this._reportInvalid(word, reason, myTurn).catch(() => {});
    if (!myTurn) return;
    if (word) {
      const normalizedRaw = (word || "").toLowerCase();
      const normalized = normalizedRaw.trim();
      if (normalized) this._roundFailed.add(normalized);
      if (this.postfixEnabled && this.postfixText) {
        const postfixLower = this.postfixText.toLowerCase();
        if (postfixLower && normalizedRaw.endsWith(postfixLower)) {
          const trimmed = normalizedRaw.slice(0, -postfixLower.length).trim();
          if (trimmed) this._roundFailed.add(trimmed);
        }
      }
    }
    if (this.paused) return;
    const next = this._pickNextNotFailed();
    if (next) this.typeAndSubmit(next).catch(() => {});
  }

  async _reportInvalid(word, reason, myTurn) {
    const normalizedWord = (word || "").toLowerCase().trim();
    if (!normalizedWord) return;
    const payload = {
      lang: this.lang,
      syllable: this.syllable || "",
      word: normalizedWord,
      reason: reason || "",
      ts: Date.now(),
      self: !!myTurn
    };
    const url = `${this.apiBase()}/report_invalid.php`;
    await this.extPost(url, payload);
  }
}

window.Game = Game;

























