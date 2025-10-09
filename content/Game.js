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
  "de": "words1/foul-words-en.txt",
  "fr": "words1/foul-words-en.txt",
  "es": "words1/foul-words-en.txt",
  "pt-br": "words1/foul-words-en.txt",
  "nah": "words1/foul-words-en.txt",
  "pok-en": "words1/foul-words-en.txt",
  "pok-fr": "words1/foul-words-en.txt",
  "pok-de": "words1/foul-words-en.txt",
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

    // Per-letter rarity weights for coverage scoring
    this.letterWeights = new Array(26).fill(1);

    // Modes
    this.paused = false;
    this.foulMode = false;
    this.coverageMode = false;
    this.mistakesEnabled = false;
    this.autoSuicide = false;

    // Length (self)
    this.lengthMode = false;
    this.targetLen = 8;

    // Spectator modes
    this.specLengthMode = false;
    this.specTargetLen = 8;
    this.specFoulMode = false;

    // Suggestions
    this.suggestionsLimit = 5;

    // Timing
    this.speed = 5;               // 1..12 (fastest unchanged; slowest slower)
    this.thinkingDelaySec = 0.0;  // 0..5

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

    // Notice flags (for HUD messages)
    this.flagsRoundSelf = 0;
    this.flagsRoundSpectator = 0;
    this.lastFoulFallbackSelf = false;
    this.lastLenFallbackSelf = false;
    this.lastLenCapAppliedSelf = false;
    this.lastLenCapRelaxedSelf = false;
    this.lastLenSuppressedByFoulSelf = false;
    this.lastFoulFallbackSpectator = false;
    this.lastLenFallbackSpectator = false;
    this.lastLenCapAppliedSpectator = false;
    this.lastLenCapRelaxedSpectator = false;
    this.lastLenSuppressedByFoulSpectator = false;

    // Coverage / goals
    this.coverageCounts = new Array(26).fill(0);
    this.excludeEnabled = false;
    this.excludeSpec = "x0 z0";       // default goals: treat x,z as 0
    this.targetCounts = new Array(26).fill(1);

    // HUD lists
    this.lastTopPicksSelf = [];
    this.lastTopPicksSelfDisplay = [];
    this.spectatorSuggestions = [];
    this.spectatorSuggestionsDisplay = [];
    this.lastSpectatorSyllable = "";

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

    let mainTxt = '';
    let foulTxt = '';

    try {
      mainTxt = await this.extFetch(mainUrl);
    } catch (err) {
      console.warn('[BombPartyShark] Failed to load main word list from API for', lang, err);
    }

    let foulErr = null;
    try {
      foulTxt = await this.extFetch(foulUrl);
    } catch (err) {
      foulErr = err;
      const msg = err && err.message ? err.message : String(err);
      const is404 = msg.includes('HTTP 404');
      const level = is404 ? 'info' : 'warn';
      console[level]('[BombPartyShark] Foul API responded for', lang, msg);
    }

    let words = toWordArrayFromText(mainTxt);
    let foulWords = toWordArrayFromText(foulTxt);

    if (!foulWords.length && lang !== "en") {
      try {
        const fallbackTxt = await this.extFetch(`${base}/words.php?lang=en&list=foul`);
        const fallbackArr = toWordArrayFromText(fallbackTxt);
        if (fallbackArr.length) {
          foulWords = fallbackArr;
          console.info('[BombPartyShark] Using English foul word list as fallback for', lang);
        }
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        const level = msg.includes('HTTP 404') ? 'info' : 'warn';
        console[level]('[BombPartyShark] English foul fallback API failed', msg);
      }
    }

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
      const tried = new Set();
      const fallbackOrder = [lang, 'en', 'default'];
      for (const key of fallbackOrder) {
        const foulPath = LOCAL_FOUL_LISTS[key];
        if (!foulPath || tried.has(foulPath)) continue;
        tried.add(foulPath);
        const foulLocalTxt = await fetchLocalText(foulPath);
        const arr = toWordArrayFromText(foulLocalTxt);
        if (arr.length) {
          foulWords = arr;
          console.info('[BombPartyShark] Loaded foul word list from bundled asset', foulPath, 'for', lang);
          break;
        }
      }
    }

    if (!foulWords.length && foulErr) {
      console.warn('[BombPartyShark] No foul word list available for', lang, '; falling back to normal words only.');
    }

    const letterWeights = Game.computeLetterWeights(words);
    return {
      lang,
      words,
      foulWords,
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
    this.foulSet = new Set(this.foulWords);
    this.letterWeights = (data.letterWeights || new Array(26).fill(1)).slice(0, 26);
    if (this.letterWeights.length < 26) {
      while (this.letterWeights.length < 26) this.letterWeights.push(1);
    }
    this._lastLoadedLang = data.lang;
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
  setSuggestionsLimit(v) { this.suggestionsLimit = Math.max(1, Math.min(10, Math.floor(v))); }

  togglePause() { this.paused = !this.paused; }
  toggleFoulMode() { this.foulMode = !this.foulMode; }
  toggleCoverageMode() { this.coverageMode = !this.coverageMode; }
  toggleMistakes() { this.mistakesEnabled = !this.mistakesEnabled; }
  toggleAutoSuicide() { this.autoSuicide = !this.autoSuicide; }

  toggleLengthMode() { this.lengthMode = !this.lengthMode; }
  setTargetLen(n) { this.targetLen = Math.max(3, Math.min(20, Math.floor(n))); }

  toggleSpecLength() { this.specLengthMode = !this.specLengthMode; }
  setSpecTargetLen(n) { this.specTargetLen = Math.max(3, Math.min(20, Math.floor(n))); }
  toggleSpecFoul() { this.specFoulMode = !this.specFoulMode; }

  setPreMsgEnabled(b) { this.preMsgEnabled = !!b; }
  setPreMsgText(t) { this.preMsgText = (t || ""); }
  setPostfixEnabled(b) { this.postfixEnabled = !!b; }
  setPostfixText(t) { this.postfixText = (t || ""); }

  setMistakesProb(p) { // p is 0..0.30
    const n = Math.max(0, Math.min(0.30, Number(p)));
    this.mistakesProb = isFinite(n) ? n : 0.08;
  }

  setExcludeEnabled(b) { this.excludeEnabled = !!b; this.recomputeTargets(); }
  setExcludeSpec(spec) { this.excludeSpec = (spec || ""); this.recomputeTargets(); }
  resetCoverage() { this.coverageCounts.fill(0); this._roundFailed.clear(); }

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
    const set = new Set();
    for (let i = 0; i < word.length; i++) {
      const c = word[i], code = c.charCodeAt(0);
      if (code >= 97 && code <= 122) set.add(c);
    }
    return set;
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
    letters.forEach(c => {
      const idx = c.charCodeAt(0) - 97;
      const have = this.coverageCounts[idx] || 0;
      const want = this.targetCounts[idx] || 0;
      if (want <= 0) return;            // excluded/ignored
      if (have < want) {
        const w = this.letterWeights[idx] || 1;
        score += 1 * w;
        if (have === want - 1) score += 1 * w; // finishing this letter
      }
    });
    // prefer words that cover more *distinct* needed letters; length is neutral
    return score + Math.random() * 0.01;
  }

  _applyLenExact(words, len, outFallbackFlagRef) {
    const exact = words.filter(w => w.length === len);
    if (exact.length) return exact;
    let d = 1;
    while (d <= 6) {
      const alt = words.filter(w => w.length === len - d || w.length === len + d);
      if (alt.length) {
        if (outFallbackFlagRef) outFallbackFlagRef.value = true;
        return alt;
      }
      d++;
    }
    if (outFallbackFlagRef) outFallbackFlagRef.value = true;
    return words;
  }

  _applyLenCap(words, maxLen, outCapAppliedRef, outCapRelaxedRef) {
    let filtered = words.filter(w => w.length <= maxLen);
    if (filtered.length) {
      if (outCapAppliedRef) outCapAppliedRef.value = true;
      return filtered;
    }
    if (outCapRelaxedRef) outCapRelaxedRef.value = true;
    return words;
  }

  _pickCandidatesBase(syllable, pool) {
    const syl = (syllable || "").toLowerCase();
    if (!syl) return [];
    // exclusions do NOT filter here - only affect tally later
    return pool.filter(w => w.includes(syl));
  }

  // -------- candidate selection (self) --------
  getTopCandidates(syllable, limit) {
    const lim = Math.max(1, Math.min(10, limit|0));
    this.flagsRoundSelf = this.selfRound;
    this.lastFoulFallbackSelf = false;
    this.lastLenFallbackSelf = false;
    this.lastLenCapAppliedSelf = false;
    this.lastLenCapRelaxedSelf = false;
    this.lastLenSuppressedByFoulSelf = false;

    const foulPoolRaw = this._pickCandidatesBase(syllable, this.foulWords);
    const mainPoolRaw = this._pickCandidatesBase(syllable, this.words);

    const foulEntries = [];
    const foulUsed = new Set();
    const mainEntries = [];

    const shuffled = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    if (this.foulMode) {
      if (!foulPoolRaw.length) {
        this.lastFoulFallbackSelf = true;
      } else {
        const foulPool = this.coverageMode
          ? foulPoolRaw.slice().sort((a, b) => this._coverageScore(b) - this._coverageScore(a))
          : shuffled(foulPoolRaw.slice());
        foulPool.forEach(word => { foulEntries.push({ word, tone: 'foul' }); foulUsed.add(word); });
      }
    }

    const remainingPool = mainPoolRaw.filter(word => !foulUsed.has(word));

    if (this.coverageMode) {
      let ranked = remainingPool.slice();
      if (this.lengthMode) {
        const fa = { value: false }, fr = { value: false };
        ranked = this._applyLenCap(ranked, this.targetLen, fa, fr);
        this.lastLenCapAppliedSelf = fa.value;
        this.lastLenCapRelaxedSelf = fr.value;
      }
      ranked = ranked.sort((a, b) => this._coverageScore(b) - this._coverageScore(a));

      ranked.forEach(word => {
        let tone = 'default';
        if (this.lengthMode) {
          tone = (word.length === this.targetLen) ? 'lengthExact' : 'lengthFlex';
        }
        mainEntries.push({ word, tone });
      });
    } else if (this.lengthMode) {
      const exact = remainingPool.filter(w => w.length === this.targetLen);
      const flex = [];
      if (exact.length) {
        shuffled(exact);
      }
      for (let d = 1; d <= 6; d++) {
        if (exact.length + flex.length >= lim) break;
        const group = remainingPool.filter(w => w.length === this.targetLen - d || w.length === this.targetLen + d);
        if (!group.length) continue;
        shuffled(group);
        group.forEach(word => flex.push(word));
      }
      exact.forEach(word => mainEntries.push({ word, tone: 'lengthExact' }));
      flex.forEach(word => mainEntries.push({ word, tone: 'lengthFlex' }));

      const usedWords = new Set([...exact, ...flex]);
      const leftovers = remainingPool.filter(w => !usedWords.has(w));
      shuffled(leftovers).forEach(word => mainEntries.push({ word, tone: 'default' }));
    } else {
      shuffled(remainingPool).forEach(word => mainEntries.push({ word, tone: 'default' }));
    }

    const combinedEntries = foulEntries.concat(mainEntries);
    const candidatePool = combinedEntries.map(entry => entry.word);

    if (this.lengthMode && this.foulMode && foulEntries.length >= lim) {
      this.lastLenSuppressedByFoulSelf = true;
    }

    const displayed = combinedEntries.slice(0, lim);

    if (this.lengthMode) {
      const hasExact = displayed.some(entry => entry.tone === 'lengthExact');
      const hasFlex = displayed.some(entry => entry.tone === 'lengthFlex');
      this.lastLenFallbackSelf = displayed.length > 0 && (!hasExact || hasFlex);
    }

    this._roundPool = candidatePool.slice();
    this.lastTopPicksSelfDisplay = displayed;
    return candidatePool.slice(0, lim);
  }

  // -------- spectator suggestions --------
  generateSpectatorSuggestions(syllable, limit) {
    const lim = Math.max(1, Math.min(10, limit|0));
    this.flagsRoundSpectator = this.spectatorRound;
    this.lastSpectatorSyllable = syllable;

    this.lastFoulFallbackSpectator = false;
    this.lastLenFallbackSpectator = false;
    this.lastLenCapAppliedSpectator = false;
    this.lastLenCapRelaxedSpectator = false;
    this.lastLenSuppressedByFoulSpectator = false;

    const foulPoolRaw = this._pickCandidatesBase(syllable, this.foulWords);
    const mainPoolRaw = this._pickCandidatesBase(syllable, this.words);

    const shuffled = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    const foulEntries = [];
    const foulUsed = new Set();
    if (this.specFoulMode) {
      if (!foulPoolRaw.length) {
        this.lastFoulFallbackSpectator = true;
      } else {
        shuffled(foulPoolRaw.slice()).forEach(word => { foulEntries.push({ word, tone: 'foul' }); foulUsed.add(word); });
      }
    }

    const mainEntries = [];
    const nonFoulPool = mainPoolRaw.filter(word => !foulUsed.has(word));
    if (this.specLengthMode) {
      const exact = nonFoulPool.filter(w => w.length === this.specTargetLen);
      shuffled(exact);
      const flex = [];
      for (let d = 1; d <= 6; d++) {
        if (exact.length + flex.length >= lim) break;
        const group = nonFoulPool.filter(w => w.length === this.specTargetLen - d || w.length === this.specTargetLen + d);
        if (!group.length) continue;
        shuffled(group);
        group.forEach(word => flex.push(word));
      }
      exact.forEach(word => mainEntries.push({ word, tone: 'lengthExact' }));
      flex.forEach(word => mainEntries.push({ word, tone: 'lengthFlex' }));

      const usedWords = new Set([...exact, ...flex]);
      const leftovers = nonFoulPool.filter(w => !usedWords.has(w));
      shuffled(leftovers).forEach(word => mainEntries.push({ word, tone: 'default' }));
    } else {
      shuffled(nonFoulPool.slice()).forEach(word => mainEntries.push({ word, tone: 'default' }));
    }

    const combined = foulEntries.concat(mainEntries);
    if (this.specFoulMode && foulEntries.length >= lim && this.specLengthMode) {
      this.lastLenSuppressedByFoulSpectator = true;
    }

    const specDisplayed = combined.slice(0, lim);
    if (this.specLengthMode) {
      const hasExact = specDisplayed.some(entry => entry.tone === 'lengthExact');
      const hasFlex = specDisplayed.some(entry => entry.tone === 'lengthFlex');
      this.lastLenFallbackSpectator = specDisplayed.length > 0 && (!hasExact || hasFlex);
    }

    this.spectatorSuggestionsDisplay = specDisplayed;
    this.spectatorSuggestions = specDisplayed.map(entry => entry.word);
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

  async _typeTextSequence(input, text, perCharDelay, options = {}) {
    if (!input || text === undefined || text === null) return;
    const seq = typeof text === "string" ? text : String(text);
    if (!seq.length) return;
    const allowMistakes = options.allowMistakes !== false;
    for (let i = 0; i < seq.length; i++) {
      const ch = seq[i];
      if (allowMistakes && this.mistakesEnabled && !this.autoSuicide && Math.random() < this.mistakesProb) {
        input.value += ch;
        this._emitInputEvent(input);
        await this._sleep(perCharDelay);
        input.value = input.value.slice(0, -1);
        this._emitInputEvent(input);
        await this._sleep(perCharDelay);
      }
      input.value += ch;
      this._emitInputEvent(input);
      await this._sleep(perCharDelay);
    }
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
    for (const w of this._roundPool) {
      if (!this._roundFailed.has(w)) return w;
    }
    return null;
  }

  async typeAndSubmit(word, ignorePostfix=false) {
    const input = this._ensureInput(); if (!input) return;

    input.focus();
    await Promise.resolve();
    input.value = "";
    this._emitInputEvent(input);

    const perCharDelay = this._charDelayMs();

    if (this.preMsgEnabled && this.preMsgText && !this.autoSuicide) {
      await this._typeTextSequence(input, this.preMsgText, perCharDelay);
      await this._sleep(Math.max(80, perCharDelay * 4));
      input.value = "";
      this._emitInputEvent(input);
    }

    await this._typeTextSequence(input, word, perCharDelay);

    if (this.postfixEnabled && this.postfixText && !this.autoSuicide && !ignorePostfix) {
      await this._typeTextSequence(input, this.postfixText, perCharDelay);
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
    letters.forEach(c => {
      const idx = c.charCodeAt(0) - 97;
      if (idx >= 0 && idx < 26 && this.targetCounts[idx] > 0) {
        this.coverageCounts[idx] += 1;
      }
    });
    this._maybeResetCoverageOnComplete();
  }

  onFailedWord(myTurn, word, reason) {
    this._reportInvalid(word, reason, myTurn).catch(() => {});
    if (!myTurn) return;
    if (word) this._roundFailed.add((word || "").toLowerCase());
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


























