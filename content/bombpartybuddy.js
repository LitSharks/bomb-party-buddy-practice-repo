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

function canUseAsyncClipboard() {
  if (!(navigator?.clipboard?.writeText)) return false;
  try {
    const policy = document?.permissionsPolicy || document?.featurePolicy;
    if (policy && typeof policy.allowsFeature === "function") {
      let allowed = true;
      try {
        allowed = policy.allowsFeature.length >= 2
          ? policy.allowsFeature("clipboard-write", window?.location?.origin || "")
          : policy.allowsFeature("clipboard-write");
      } catch (_) {
        allowed = false;
      }
      if (!allowed) return false;
    }
  } catch (_) {
    // Ignore feature policy errors and fall back to execCommand
    return false;
  }
  return true;
}

// Clipboard fallback (permissions policy may block navigator.clipboard)
async function copyPlain(text) {
  const payload = text ?? "";
  if (canUseAsyncClipboard()) {
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
  game.setPreventWordReuseEnabled(getBool(savedSettings?.preventWordReuseEnabled, game.preventWordReuseEnabled));

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
    preventWordReuseEnabled: !!game.preventWordReuseEnabled,
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

  const SUPPORTED_UI_LANGS = ["en", "de", "fr", "es", "pt-br"];
  const UI_TRANSLATIONS = {
    "header.title": {
      en: "Bomb Party Shark",
      de: "Bomb Party Shark",
      fr: "Bomb Party Shark",
      es: "Bomb Party Shark",
      "pt-br": "Bomb Party Shark"
    },
    "toggle.on": { en: "ON", de: "AN", fr: "ON", es: "ON", "pt-br": "ON" },
    "toggle.off": { en: "OFF", de: "AUS", fr: "OFF", es: "OFF", "pt-br": "OFF" },
    "header.language": {
      en: "Language: {language}",
      de: "Sprache: {language}",
      fr: "Langue : {language}",
      es: "Idioma: {language}",
      "pt-br": "Idioma: {language}"
    },
    "actions.forceSave": {
      en: "Force save settings",
      de: "Einstellungen sofort speichern",
      fr: "Forcer l'enregistrement",
      es: "Forzar guardado",
      "pt-br": "Forçar salvar"
    },
    "actions.saved": {
      en: "Saved!",
      de: "Gespeichert!",
      fr: "Enregistré !",
      es: "¡Guardado!",
      "pt-br": "Salvo!"
    }
  };

  Object.assign(UI_TRANSLATIONS, {
    "Main": { en: "Main", de: "Hauptbereich", fr: "Principal", es: "Principal", "pt-br": "Principal" },
    "Coverage": { en: "Coverage", de: "Abdeckung", fr: "Couverture", es: "Cobertura", "pt-br": "Cobertura" },
    "Words": { en: "Words", de: "Wörter", fr: "Mots", es: "Palabras", "pt-br": "Palavras" },
    "Automation": { en: "Automation", de: "Automatisierung", fr: "Automatisation", es: "Automatización", "pt-br": "Automação" },
    "AutoType": { en: "AutoType", de: "Auto-Tippen", fr: "Saisie auto", es: "Escritura automática", "pt-br": "Digitação automática" },
    "Instant mode": { en: "Instant mode", de: "Sofortmodus", fr: "Mode instantané", es: "Modo instantáneo", "pt-br": "Modo instantâneo" },
    "Butterfingers": { en: "Butterfingers", de: "Vertipper", fr: "Doigts glissants", es: "Dedos torpes", "pt-br": "Dedos escorregadios" },
    "Auto /suicide": { en: "Auto /suicide", de: "Auto /suicide", fr: "Auto /suicide", es: "Auto /suicide", "pt-br": "Auto /suicide" },
    "Always auto-join": { en: "Always auto-join", de: "Immer automatisch beitreten", fr: "Toujours auto-joindre", es: "Unirse siempre automáticamente", "pt-br": "Sempre entrar automaticamente" },
    "Super realistic": { en: "Super realistic", de: "Super realistisch", fr: "Super réaliste", es: "Súper realista", "pt-br": "Super realista" },
    "Aggressiveness (%)": { en: "Aggressiveness (%)", de: "Aggressivität (%)", fr: "Agressivité (%)", es: "Agresividad (%)", "pt-br": "Agressividade (%)" },
    "Mid-word pause (s)": { en: "Mid-word pause (s)", de: "Pause im Wort (s)", fr: "Pause en plein mot (s)", es: "Pausa en medio de palabra (s)", "pt-br": "Pausa no meio da palavra (s)" },
    "HUD & Rhythm": { en: "HUD & Rhythm", de: "HUD & Rhythmus", fr: "HUD & rythme", es: "HUD y ritmo", "pt-br": "HUD e ritmo" },
    "HUD size": { en: "HUD size", de: "HUD-Größe", fr: "Taille du HUD", es: "Tamaño del HUD", "pt-br": "Tamanho do HUD" },
    "Speed": { en: "Speed", de: "Geschwindigkeit", fr: "Vitesse", es: "Velocidad", "pt-br": "Velocidade" },
    "Thinking delay (s)": { en: "Thinking delay (s)", de: "Denkpause (s)", fr: "Délai de réflexion (s)", es: "Retraso de pensamiento (s)", "pt-br": "Atraso de raciocínio (s)" },
    "Butterfingers (%)": { en: "Butterfingers (%)", de: "Vertipper (%)", fr: "Doigts glissants (%)", es: "Dedos torpes (%)", "pt-br": "Dedos escorregadios (%)" },
    "Messages": { en: "Messages", de: "Nachrichten", fr: "Messages", es: "Mensajes", "pt-br": "Mensagens" },
    "Premessage": { en: "Premessage", de: "Vorab-Nachricht", fr: "Pré-message", es: "Pre-mensaje", "pt-br": "Pré-mensagem" },
    "Message to flash before your word": {
      en: "Message to flash before your word",
      de: "Nachricht vor dem Wort anzeigen",
      fr: "Message à afficher avant votre mot",
      es: "Mensaje antes de tu palabra",
      "pt-br": "Mensagem antes da palavra"
    },
    "Postfix": { en: "Postfix", de: "Nachsilbe", fr: "Suffixe", es: "Sufijo", "pt-br": "Sufixo" },
    "Characters to append (e.g., <3)": {
      en: "Characters to append (e.g., <3)",
      de: "Zeichen zum Anhängen (z. B. <3)",
      fr: "Caractères à ajouter (ex. : <3)",
      es: "Caracteres para añadir (p. ej. <3)",
      "pt-br": "Caracteres para anexar (ex.: <3)"
    },
    "Alphabet mastery": { en: "Alphabet mastery", de: "Alphabet-Meisterschaft", fr: "Maîtrise de l'alphabet", es: "Dominio del alfabeto", "pt-br": "Domínio do alfabeto" },
    "Alphabet coverage": { en: "Alphabet coverage", de: "Alphabet-Abdeckung", fr: "Couverture de l'alphabet", es: "Cobertura del alfabeto", "pt-br": "Cobertura do alfabeto" },
    "A-Z goals / exclusions": { en: "A-Z goals / exclusions", de: "A-Z-Ziele / Ausschlüsse", fr: "Objectifs A-Z / exclusions", es: "Objetivos A-Z / exclusiones", "pt-br": "Metas A-Z / exclusões" },
    "Editing mode": { en: "Editing mode", de: "Bearbeitungsmodus", fr: "Mode édition", es: "Modo edición", "pt-br": "Modo edição" },
    "Off": { en: "Off", de: "Aus", fr: "Off", es: "Apagado", "pt-br": "Desligado" },
    "Edit tallies": { en: "Edit tallies", de: "Zählungen bearbeiten", fr: "Modifier les compteurs", es: "Editar conteos", "pt-br": "Editar contagens" },
    "Edit goals": { en: "Edit goals", de: "Ziele bearbeiten", fr: "Modifier les objectifs", es: "Editar objetivos", "pt-br": "Editar metas" },
    "Set all goals to:": { en: "Set all goals to:", de: "Alle Ziele setzen auf:", fr: "Définir toutes les cibles à :", es: "Establecer todas las metas en:", "pt-br": "Definir todas as metas para:" },
    "Apply": { en: "Apply", de: "Anwenden", fr: "Appliquer", es: "Aplicar", "pt-br": "Aplicar" },
    "Reset A-Z progress": { en: "Reset A-Z progress", de: "A-Z-Fortschritt zurücksetzen", fr: "Réinitialiser la progression A-Z", es: "Reiniciar progreso A-Z", "pt-br": "Redefinir progresso A-Z" },
    "Word targeting": { en: "Word targeting", de: "Wortauswahl", fr: "Ciblage de mots", es: "Selección de palabras", "pt-br": "Seleção de palavras" },
    "Suggestions": { en: "Suggestions", de: "Vorschläge", fr: "Suggestions", es: "Sugerencias", "pt-br": "Sugestões" },
    "Word modes": { en: "Word modes", de: "Wortmodi", fr: "Modes de mots", es: "Modos de palabras", "pt-br": "Modos de palavras" },
    "foul": { en: "foul", de: "Schimpfwort", fr: "grossier", es: "grosero", "pt-br": "ofensivo" },
    "matches target length": { en: "matches target length", de: "entspricht der Ziellänge", fr: "correspond à la longueur cible", es: "coincide con la longitud objetivo", "pt-br": "combina com o tamanho alvo" },
    "nearby length": { en: "nearby length", de: "ähnliche Länge", fr: "longueur proche", es: "longitud cercana", "pt-br": "comprimento próximo" },
    "hyphen words": { en: "hyphen words", de: "Wörter mit Bindestrich", fr: "mots avec trait d'union", es: "palabras con guion", "pt-br": "palavras com hífen" },
    "contains filter": { en: "contains filter", de: "enthält Filter", fr: "filtre contient", es: "filtro contiene", "pt-br": "filtro contém" },
    "Pokémon": { en: "Pokémon", de: "Pokémon", fr: "Pokémon", es: "Pokémon", "pt-br": "Pokémon" },
    "minerals": { en: "minerals", de: "Mineralien", fr: "minéraux", es: "minerales", "pt-br": "minerais" },
    "rare": { en: "rare", de: "selten", fr: "rare", es: "raras", "pt-br": "raras" },
    "regular": { en: "regular", de: "normal", fr: "normal", es: "normal", "pt-br": "normal" },
    "click me to go away": { en: "click me to go away", de: "Klick, um mich auszublenden", fr: "Cliquez pour masquer", es: "Haz clic para ocultar", "pt-br": "Clique para esconder" },
    "Foul words": { en: "Foul words", de: "Schimpfwörter", fr: "Mots grossiers", es: "Palabras malsonantes", "pt-br": "Palavras ofensivas" },
    "Pokémon words": { en: "Pokémon words", de: "Pokémon-Wörter", fr: "Mots Pokémon", es: "Palabras Pokémon", "pt-br": "Palavras Pokémon" },
    "Minerals": { en: "Minerals", de: "Mineralien", fr: "Minéraux", es: "Minerales", "pt-br": "Minerais" },
    "Rare words": { en: "Rare words", de: "Seltene Wörter", fr: "Mots rares", es: "Palabras raras", "pt-br": "Palavras raras" },
    "Target length": { en: "Target length", de: "Ziellänge", fr: "Longueur cible", es: "Longitud objetivo", "pt-br": "Comprimento alvo" },
    "Me": { en: "Me", de: "Ich", fr: "Moi", es: "Yo", "pt-br": "Eu" },
    "Spectator": { en: "Spectator", de: "Zuschauer", fr: "Spectateur", es: "Espectador", "pt-br": "Espectador" },
    "Hyphen only": { en: "Hyphen only", de: "Nur mit Bindestrich", fr: "Tirets uniquement", es: "Solo con guion", "pt-br": "Somente hífen" },
    "Contains": { en: "Contains", de: "Enthält", fr: "Contient", es: "Contiene", "pt-br": "Contém" },
    "Letters or fragment (me)": { en: "Letters or fragment (me)", de: "Buchstaben oder Fragment (ich)", fr: "Lettres ou fragment (moi)", es: "Letras o fragmento (yo)", "pt-br": "Letras ou fragmento (eu)" },
    "Letters or fragment (spectator)": { en: "Letters or fragment (spectator)", de: "Buchstaben oder Fragment (Zuschauer)", fr: "Lettres ou fragment (spectateur)", es: "Letras o fragmento (espectador)", "pt-br": "Letras ou fragmento (espectador)" },
    "Word history": { en: "Word history", de: "Wortverlauf", fr: "Historique des mots", es: "Historial de palabras", "pt-br": "Histórico de palavras" },
    "Prevent word reuse": { en: "Prevent word reuse", de: "Wortwiederholung verhindern", fr: "Empêcher la réutilisation des mots", es: "Evitar reutilizar palabras", "pt-br": "Evitar reutilizar palavras" },
    "Reset word log": { en: "Reset word log", de: "Wortliste zurücksetzen", fr: "Réinitialiser le journal de mots", es: "Restablecer registro de palabras", "pt-br": "Redefinir registro de palavras" },
    "No words logged yet.": { en: "No words logged yet.", de: "Noch keine Wörter protokolliert.", fr: "Aucun mot enregistré pour l'instant.", es: "Todavía no hay palabras registradas.", "pt-br": "Nenhuma palavra registrada ainda." },
    "Max": { en: "Max", de: "Max", fr: "Max", es: "Máx.", "pt-br": "Máx." },
    "Live suggestions": { en: "Live suggestions", de: "Live-Vorschläge", fr: "Suggestions en direct", es: "Sugerencias en vivo", "pt-br": "Sugestões ao vivo" },
    "My top picks": { en: "My top picks", de: "Meine Top-Auswahl", fr: "Mes meilleurs choix", es: "Mis mejores opciones", "pt-br": "Minhas melhores escolhas" },
    "Spectator suggestions": { en: "Spectator suggestions", de: "Vorschläge für Zuschauer", fr: "Suggestions spectateurs", es: "Sugerencias de espectador", "pt-br": "Sugestões de espectador" },
    "(none)": { en: "(none)", de: "(keine)", fr: "(aucune)", es: "(ninguna)", "pt-br": "(nenhuma)" },
    "Click to copy": { en: "Click to copy", de: "Klicken zum Kopieren", fr: "Cliquer pour copier", es: "Haz clic para copiar", "pt-br": "Clique para copiar" },
    "Copied": { en: "Copied", de: "Kopiert", fr: "Copié", es: "Copiado", "pt-br": "Copiado" },
    "Copy failed": { en: "Copy failed", de: "Kopieren fehlgeschlagen", fr: "Échec de la copie", es: "Copia fallida", "pt-br": "Falha ao copiar" },
    "excluded": { en: "excluded", de: "ausgeschlossen", fr: "exclu", es: "excluido", "pt-br": "excluído" },
    "Left click to add progress, right click to remove.": {
      en: "Left click to add progress, right click to remove.",
      de: "Linksklick zum Hinzufügen, Rechtsklick zum Entfernen.",
      fr: "Clic gauche pour ajouter, clic droit pour retirer.",
      es: "Clic izquierdo para sumar, clic derecho para restar.",
      "pt-br": "Clique esquerdo para adicionar, direito para remover."
    },
    "Left click to raise the goal, right click to lower.": {
      en: "Left click to raise the goal, right click to lower.",
      de: "Linksklick erhöht das Ziel, Rechtsklick senkt es.",
      fr: "Clic gauche pour augmenter l'objectif, clic droit pour le diminuer.",
      es: "Clic izquierdo para subir la meta, clic derecho para bajarla.",
      "pt-br": "Clique esquerdo eleva a meta, clique direito reduz."
    },
    "Editing tallies: left-click to add progress, right-click to remove. Values stay within each letter's goal.": {
      en: "Editing tallies: left-click to add progress, right-click to remove. Values stay within each letter's goal.",
      de: "Zählungen bearbeiten: Linksklick fügt Fortschritt hinzu, Rechtsklick entfernt. Werte bleiben innerhalb des Zielbereichs.",
      fr: "Modification des compteurs : clic gauche pour ajouter du progrès, clic droit pour retirer. Les valeurs restent dans l'objectif.",
      es: "Edición de conteos: clic izquierdo para añadir progreso, clic derecho para quitar. Los valores se mantienen dentro de cada objetivo.",
      "pt-br": "Editando contagens: clique esquerdo adiciona progresso, clique direito remove. Os valores permanecem dentro da meta de cada letra."
    },
    "Editing goals: left-click to raise, right-click to lower, or type a number inside any letter box.": {
      en: "Editing goals: left-click to raise, right-click to lower, or type a number inside any letter box.",
      de: "Ziele bearbeiten: Linksklick erhöht, Rechtsklick verringert oder tippe eine Zahl im Feld.",
      fr: "Modification des objectifs : clic gauche pour augmenter, clic droit pour diminuer, ou tapez un nombre dans la case.",
      es: "Edición de metas: clic izquierdo para subir, clic derecho para bajar, o escribe un número en la casilla.",
      "pt-br": "Editar metas: clique esquerdo aumenta, clique direito diminui ou digite um número na caixa."
    },
    "No foul words matched this prompt; using the normal word list.": {
      en: "No foul words matched this prompt; using the normal word list.",
      de: "Keine Schimpfwörter passten auf diese Vorgabe; es wird die normale Liste verwendet.",
      fr: "Aucun mot grossier ne correspond à cette invite ; utilisation de la liste normale.",
      es: "Ninguna palabra malsonante coincidió con esta pista; usando la lista normal.",
      "pt-br": "Nenhuma palavra ofensiva correspondeu à dica; usando a lista normal."
    },
    "No Pokémon words matched this prompt; falling back to regular suggestions.": {
      en: "No Pokémon words matched this prompt; falling back to regular suggestions.",
      de: "Keine Pokémon-Wörter passten auf diese Vorgabe; normale Vorschläge werden genutzt.",
      fr: "Aucun mot Pokémon ne correspond à cette invite ; retour aux suggestions normales.",
      es: "Ninguna palabra Pokémon coincidió con esta pista; volviendo a las sugerencias normales.",
      "pt-br": "Nenhuma palavra Pokémon correspondeu à dica; voltando às sugestões normais."
    },
    "No mineral words matched this prompt; showing main list instead.": {
      en: "No mineral words matched this prompt; showing main list instead.",
      de: "Keine Mineral-Wörter passten auf diese Vorgabe; es wird die Hauptliste angezeigt.",
      fr: "Aucun mot minéral ne correspond à cette invite ; affichage de la liste principale.",
      es: "Ninguna palabra de minerales coincidió con esta pista; mostrando la lista principal.",
      "pt-br": "Nenhuma palavra de minerais correspondeu à dica; mostrando a lista principal."
    },
    "No rare words matched this prompt; showing normal suggestions.": {
      en: "No rare words matched this prompt; showing normal suggestions.",
      de: "Keine seltenen Wörter passten auf diese Vorgabe; normale Vorschläge werden angezeigt.",
      fr: "Aucun mot rare ne correspond à cette invite ; affichage des suggestions normales.",
      es: "Ninguna palabra rara coincidió con esta pista; mostrando sugerencias normales.",
      "pt-br": "Nenhuma palavra rara correspondeu à dica; mostrando sugestões normais."
    },
    "Limiting to words of <= {limit} letters while maximizing alphabet coverage.": {
      en: "Limiting to words of <= {limit} letters while maximizing alphabet coverage.",
      de: "Begrenzung auf Wörter mit <= {limit} Buchstaben bei maximaler Alphabet-Abdeckung.",
      fr: "Limitation aux mots de <= {limit} lettres tout en maximisant la couverture de l'alphabet.",
      es: "Limitando a palabras de <= {limit} letras mientras se maximiza la cobertura del alfabeto.",
      "pt-br": "Limitando a palavras com <= {limit} letras enquanto maximiza a cobertura do alfabeto."
    },
    "No words of <= {limit} letters found; using best coverage regardless of length.": {
      en: "No words of <= {limit} letters found; using best coverage regardless of length.",
      de: "Keine Wörter mit <= {limit} Buchstaben gefunden; beste Abdeckung unabhängig von der Länge.",
      fr: "Aucun mot de <= {limit} lettres trouvé ; meilleure couverture utilisée quel que soit la longueur.",
      es: "No se encontraron palabras de <= {limit} letras; usando la mejor cobertura sin importar la longitud.",
      "pt-br": "Nenhuma palavra com <= {limit} letras encontrada; usando a melhor cobertura independentemente do tamanho."
    },
    "No words at the maximum length; trying nearby lengths.": {
      en: "No words at the maximum length; trying nearby lengths.",
      de: "Keine Wörter mit maximaler Länge; es werden ähnliche Längen probiert.",
      fr: "Aucun mot à la longueur maximale ; essai de longueurs proches.",
      es: "No hay palabras en la longitud máxima; probando longitudes cercanas.",
      "pt-br": "Nenhuma palavra no comprimento máximo; tentando comprimentos próximos."
    },
    "No words with exactly {target} letters; trying nearby lengths.": {
      en: "No words with exactly {target} letters; trying nearby lengths.",
      de: "Keine Wörter mit genau {target} Buchstaben; ähnliche Längen werden versucht.",
      fr: "Aucun mot avec exactement {target} lettres ; essai de longueurs proches.",
      es: "No hay palabras con exactamente {target} letras; probando longitudes cercanas.",
      "pt-br": "Nenhuma palavra com exatamente {target} letras; tentando comprimentos próximos."
    },
    "Target length ignored because higher-priority lists supplied enough options.": {
      en: "Target length ignored because higher-priority lists supplied enough options.",
      de: "Ziellänge ignoriert, da höher priorisierte Listen genug Optionen boten.",
      fr: "Longueur cible ignorée car des listes prioritaires offrent suffisamment d'options.",
      es: "Se ignora la longitud objetivo porque listas de mayor prioridad ya dieron suficientes opciones.",
      "pt-br": "Comprimento alvo ignorado porque listas de maior prioridade já forneceram opções suficientes."
    },
    "Contains filter: no matches found; showing broader results.": {
      en: "Contains filter: no matches found; showing broader results.",
      de: "Enthält-Filter: keine Treffer; es werden breitere Ergebnisse gezeigt.",
      fr: "Filtre contient : aucun résultat ; affichage plus large.",
      es: "Filtro contiene: no se encontraron coincidencias; mostrando resultados más amplios.",
      "pt-br": "Filtro contém: nenhuma correspondência; mostrando resultados mais amplos."
    },
    "Hyphen mode: no hyphenated words matched this prompt.": {
      en: "Hyphen mode: no hyphenated words matched this prompt.",
      de: "Bindestrich-Modus: Keine passenden Wörter.",
      fr: "Mode tiret : aucun mot avec trait d'union trouvé.",
      es: "Modo guion: ninguna palabra con guion coincidió.",
      "pt-br": "Modo hífen: nenhuma palavra com hífen correspondeu."
    },
    "Target length (me): with coverage on it acts as a max (<= {limit}); foul words still take priority.": {
      en: "Target length (me): with coverage on it acts as a max (<= {limit}); foul words still take priority.",
      de: "Ziellänge (ich): Mit Abdeckung wirkt sie als Maximum (<= {limit}); Schimpfwörter haben weiterhin Vorrang.",
      fr: "Longueur cible (moi) : avec la couverture activée elle agit comme un maximum (<= {limit}) ; les mots grossiers restent prioritaires.",
      es: "Longitud objetivo (yo): con cobertura activada actúa como un máximo (<= {limit}); las palabras malsonantes siguen teniendo prioridad.",
      "pt-br": "Comprimento alvo (eu): com cobertura ativa funciona como máximo (<= {limit}); palavras ofensivas ainda têm prioridade."
    },
    "Target length (me): acts as a max (<= {limit}) while optimizing alphabet coverage.": {
      en: "Target length (me): acts as a max (<= {limit}) while optimizing alphabet coverage.",
      de: "Ziellänge (ich): wirkt als Maximum (<= {limit}) bei gleichzeitiger Optimierung der Alphabet-Abdeckung.",
      fr: "Longueur cible (moi) : agit comme un maximum (<= {limit}) tout en optimisant la couverture de l'alphabet.",
      es: "Longitud objetivo (yo): actúa como máximo (<= {limit}) mientras optimiza la cobertura del alfabeto.",
      "pt-br": "Comprimento alvo (eu): atua como máximo (<= {limit}) enquanto otimiza a cobertura do alfabeto."
    },
    "Target length (me): ignored when foul words are available; used only if none match.": {
      en: "Target length (me): ignored when foul words are available; used only if none match.",
      de: "Ziellänge (ich): wird ignoriert, wenn Schimpfwörter verfügbar sind; nur verwendet, wenn keine passen.",
      fr: "Longueur cible (moi) : ignorée lorsqu'il y a des mots grossiers ; utilisée seulement s'il n'y en a aucun.",
      es: "Longitud objetivo (yo): se ignora cuando hay palabras malsonantes disponibles; solo se usa si ninguna coincide.",
      "pt-br": "Comprimento alvo (eu): ignorado quando há palavras ofensivas disponíveis; usado apenas se nenhuma corresponder."
    },
    "Target length (me): exact matches show green, nearby lengths appear in yellow when needed.": {
      en: "Target length (me): exact matches show green, nearby lengths appear in yellow when needed.",
      de: "Ziellänge (ich): exakte Treffer erscheinen grün, nahe Längen bei Bedarf gelb.",
      fr: "Longueur cible (moi) : les correspondances exactes sont en vert, les longueurs proches en jaune si nécessaire.",
      es: "Longitud objetivo (yo): coincidencias exactas en verde, longitudes cercanas en amarillo cuando sea necesario.",
      "pt-br": "Comprimento alvo (eu): correspondências exatas em verde, comprimentos próximos em amarelo quando necessário."
    },
    "Target length (spectator): ignored whenever foul words are available for the prompt.": {
      en: "Target length (spectator): ignored whenever foul words are available for the prompt.",
      de: "Ziellänge (Zuschauer): wird ignoriert, wenn Schimpfwörter verfügbar sind.",
      fr: "Longueur cible (spectateur) : ignorée lorsqu'il existe des mots grossiers.",
      es: "Longitud objetivo (espectador): se ignora cuando hay palabras malsonantes disponibles.",
      "pt-br": "Comprimento alvo (espectador): ignorado quando há palavras ofensivas disponíveis."
    },
    "Target length (spectator): exact matches show green; nearby lengths are marked in yellow.": {
      en: "Target length (spectator): exact matches show green; nearby lengths are marked in yellow.",
      de: "Ziellänge (Zuschauer): exakte Treffer sind grün, nahe Längen gelb markiert.",
      fr: "Longueur cible (spectateur) : correspondances exactes en vert ; longueurs proches en jaune.",
      es: "Longitud objetivo (espectador): coincidencias exactas en verde; longitudes cercanas en amarillo.",
      "pt-br": "Comprimento alvo (espectador): correspondências exatas em verde; comprimentos próximos em amarelo."
    },
    "notice.settingsSaved": {
      en: "Settings saved", de: "Einstellungen gespeichert", fr: "Paramètres enregistrés", es: "Configuración guardada", "pt-br": "Configurações salvas"
    },
    "notice.newGameReset": {
      en: "New game detected! Coverage and reuse logs reset.",
      de: "Neue Runde erkannt! Abdeckung und Wortliste zurückgesetzt.",
      fr: "Nouvelle partie détectée ! Couverture et historique des mots réinitialisés.",
      es: "¡Nueva partida detectada! Cobertura y registro de palabras reiniciados.",
      "pt-br": "Novo jogo detectado! Cobertura e histórico de palavras redefinidos."
    }
  });

  const LANGUAGE_DISPLAY_NAMES = {
    en: {
      en: "English",
      de: "German",
      fr: "French",
      es: "Spanish",
      "pt-br": "Portuguese (BR)",
      nah: "Nahuatl",
      "pok-en": "Pokémon (EN)",
      "pok-fr": "Pokémon (FR)",
      "pok-de": "Pokémon (DE)"
    },
    de: {
      en: "Englisch",
      de: "Deutsch",
      fr: "Französisch",
      es: "Spanisch",
      "pt-br": "Portugiesisch (BR)",
      nah: "Nahuatl",
      "pok-en": "Pokémon (EN)",
      "pok-fr": "Pokémon (FR)",
      "pok-de": "Pokémon (DE)"
    },
    fr: {
      en: "Anglais",
      de: "Allemand",
      fr: "Français",
      es: "Espagnol",
      "pt-br": "Portugais (BR)",
      nah: "Nahuatl",
      "pok-en": "Pokémon (EN)",
      "pok-fr": "Pokémon (FR)",
      "pok-de": "Pokémon (DE)"
    },
    es: {
      en: "Inglés",
      de: "Alemán",
      fr: "Francés",
      es: "Español",
      "pt-br": "Portugués (BR)",
      nah: "Náhuatl",
      "pok-en": "Pokémon (EN)",
      "pok-fr": "Pokémon (FR)",
      "pok-de": "Pokémon (DE)"
    },
    "pt-br": {
      en: "Inglês",
      de: "Alemão",
      fr: "Francês",
      es: "Espanhol",
      "pt-br": "Português (BR)",
      nah: "Náuatle",
      "pok-en": "Pokémon (EN)",
      "pok-fr": "Pokémon (FR)",
      "pok-de": "Pokémon (DE)"
    }
  };

  const translationBindings = [];
  let lastAppliedLang = null;
  let toggleOnLabel = UI_TRANSLATIONS["toggle.on"].en;
  let toggleOffLabel = UI_TRANSLATIONS["toggle.off"].en;

  const formatString = (template, vars = {}) => template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

  const translate = (key, vars = {}, langOverride = null) => {
    const lang = (langOverride || game.lang || 'en').toLowerCase();
    const base = UI_TRANSLATIONS[key];
    if (!base) {
      const english = key.includes('.') ? key.split('.').pop() : key;
      return formatString(english, vars);
    }
    const resolved = base[lang] || base[(lang.split('-')[0])] || base.en || key;
    return formatString(resolved, vars);
  };

  const bindText = (el, key, options = {}) => {
    if (!el) return;
    const entry = { el, key, options };
    translationBindings.push(entry);
  };

  const setTextKey = (el, key, options = {}) => {
    if (!el) return;
    bindText(el, key, options);
    applyBoundText(translationBindings[translationBindings.length - 1], (game.lang || 'en').toLowerCase());
  };

  const resolveLanguageDisplayName = () => {
    const langRaw = (game.lang || 'en').toLowerCase();
    const base = langRaw.split('-')[0];
    const uiLang = (game.lang || 'en').toLowerCase();
    const uiBase = uiLang.split('-')[0];
    const table = LANGUAGE_DISPLAY_NAMES[uiLang] || LANGUAGE_DISPLAY_NAMES[uiBase] || LANGUAGE_DISPLAY_NAMES.en;
    return table[langRaw] || table[base] || langRaw;
  };

  const applyBoundText = (entry, lang) => {
    const { el, key, options } = entry;
    if (!el) return;
    const vars = typeof options.vars === 'function' ? options.vars() : (options.vars || {});
    const text = translate(key, vars, lang);
    if (options.attr === 'placeholder') {
      el.placeholder = text;
    } else if (options.attr === 'title') {
      el.title = text;
    } else if (options.type === 'html') {
      el.innerHTML = text;
    } else {
      el.textContent = text;
    }
  };

  const refreshTranslations = () => {
    const lang = (game.lang || 'en').toLowerCase();
    if (lang === lastAppliedLang) return;
    lastAppliedLang = lang;
    toggleOnLabel = translate('toggle.on', {}, lang);
    toggleOffLabel = translate('toggle.off', {}, lang);
    translationBindings.forEach(entry => applyBoundText(entry, lang));
  };

  if (typeof game.setLanguageChangedCallback === 'function') {
    game.setLanguageChangedCallback(() => {
      lastAppliedLang = null;
      refreshTranslations();
    });
  }
  refreshTranslations();

  const notificationContainer = document.createElement('div');
  Object.assign(notificationContainer.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: '2147483647',
    pointerEvents: 'none'
  });

  const showNotification = (messageKey, vars = {}) => {
    const key = typeof messageKey === 'string' ? messageKey : '';
    const text = translate(key, (vars && typeof vars === 'object') ? vars : {});
    if (!text) return;
    const toast = document.createElement('div');
    toast.textContent = text;
    Object.assign(toast.style, {
      padding: '8px 14px',
      borderRadius: '999px',
      background: 'rgba(37,99,235,0.9)',
      color: '#e0f2fe',
      fontWeight: '700',
      fontSize: '13px',
      boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
      opacity: '1',
      transition: 'opacity 0.4s ease'
    });
    notificationContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 2400);
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
  Object.assign(header.style, {
    fontWeight: 800,
    marginBottom: "10px",
    letterSpacing: "0.2px",
    cursor: "grab",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    paddingBottom: "8px",
    fontSize: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap"
  });

  const titleWrap = document.createElement("div");
  Object.assign(titleWrap.style, { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "8px" });
  const titleSpan = document.createElement("span");
  Object.assign(titleSpan.style, { fontWeight: 800, fontSize: "16px" });
  setTextKey(titleSpan, "header.title");
  const languageSpan = document.createElement("span");
  Object.assign(languageSpan.style, { fontWeight: 600, fontSize: "12px", color: "#cbd5f5" });
  setTextKey(languageSpan, "header.language", { vars: () => ({ language: resolveLanguageDisplayName() }) });
  titleWrap.appendChild(titleSpan);
  titleWrap.appendChild(languageSpan);

  const headerActions = document.createElement("div");
  Object.assign(headerActions.style, { display: "flex", alignItems: "center", gap: "8px" });

  const forceSaveBtn = document.createElement("button");
  forceSaveBtn.type = "button";
  Object.assign(forceSaveBtn.style, {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(148,163,184,0.4)",
    background: "rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "12px",
    letterSpacing: "0.3px"
  });
  setTextKey(forceSaveBtn, "actions.forceSave");

  const savedBadge = document.createElement("span");
  Object.assign(savedBadge.style, {
    fontWeight: "700",
    fontSize: "12px",
    color: "#86efac",
    opacity: "0",
    transition: "opacity 0.25s ease"
  });
  setTextKey(savedBadge, "actions.saved");

  let saveFlashTimer = null;
  const showSaved = () => {
    if (saveFlashTimer) clearTimeout(saveFlashTimer);
    savedBadge.style.opacity = "1";
    saveFlashTimer = setTimeout(() => {
      savedBadge.style.opacity = "0";
    }, 1800);
  };

  const performForcedSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (talliesTimer) {
      clearTimeout(talliesTimer);
      talliesTimer = null;
    }
    const settingsPayload = collectSettings();
    saveSettingsNow(settingsPayload);
    const counts = Array.isArray(game.coverageCounts) ? game.coverageCounts.slice(0, 26) : [];
    saveTalliesNow({ coverageCounts: counts });
    showSaved();
    showNotification('notice.settingsSaved');
  };

  forceSaveBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    performForcedSave();
  });
  forceSaveBtn.addEventListener("mousedown", (ev) => ev.stopPropagation());
  savedBadge.addEventListener("mousedown", (ev) => ev.stopPropagation());

  headerActions.appendChild(forceSaveBtn);
  headerActions.appendChild(savedBadge);

  header.appendChild(titleWrap);
  header.appendChild(headerActions);
  box.appendChild(header);

  // Tabs
  const tabs = document.createElement("div");
  Object.assign(tabs.style, { display:"flex", gap:"8px", marginBottom:"10px" });
  const mkTab = (name, labelKey) => {
    const b = document.createElement("button");
    setTextKey(b, labelKey);
    Object.assign(b.style, { padding:"6px 10px", borderRadius:"8px", cursor:"pointer",
      border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.06)", fontWeight:700 });
    b._setActive = (on)=> {
      b.style.background = on ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)";
      b.style.border = on ? "1px solid rgba(59,130,246,0.55)" : "1px solid rgba(255,255,255,0.2)";
    };
    b.dataset.tabName = name;
    return b;
  };
  const mainTabBtn = mkTab("Main", "Main");
  const covTabBtn  = mkTab("Coverage", "Coverage");
  const wordsTabBtn= mkTab("Words", "Words");
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
      btn.textContent = on ? toggleOnLabel : toggleOffLabel;
      btn.style.letterSpacing = "0.3px";
      btn.style.fontSize = "13px";
    } else {
      btn.textContent = translate(label || btn.dataset.i18nKey || "", {});
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

  const mkRow = (labelKey, onClick, getOn, scheme = "default", mode = "status", options = {}) => {
    const r = document.createElement("div");
    Object.assign(r.style, { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", margin:"8px 0" });
    const span = document.createElement("span"); span.style.fontWeight = "600"; setTextKey(span, labelKey); r.appendChild(span);
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

  const mkDualRow = (labelKey, configs) => {
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
    span.style.fontWeight = "600";
    setTextKey(span, labelKey);
    row.appendChild(span);
    row._labelSpan = span;
    const btnWrap = document.createElement("div");
    Object.assign(btnWrap.style, { display:"flex", gap:"8px", flexWrap:"wrap" });
    row.appendChild(btnWrap);
    row._buttons = [];
    configs.forEach(cfg => {
      const btn = document.createElement("button");
      if (cfg.labelKey) btn.dataset.i18nKey = cfg.labelKey;
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

  function sliderRow(labelKey, min, max, val, step, oninput, options = {}){
    const row = document.createElement("div");
    Object.assign(row.style, {
      display:"grid",
      gridTemplateColumns:"auto 1fr auto",
      alignItems:"center",
      gap:"14px",
      margin:"10px 0"
    });
    const span = document.createElement("span"); span.style.fontWeight = "600"; setTextKey(span, labelKey);
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
  function textInput(placeholderKey, value, oninput, options = {}){
    const wrap = document.createElement("div");
    const inp = document.createElement("input");
    inp.type = "text"; inp.value = value || "";
    if (placeholderKey) setTextKey(inp, placeholderKey, { attr: 'placeholder' });
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
  function createCard(titleKey){
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
    if (titleKey) {
      const heading = document.createElement("div");
      setTextKey(heading, titleKey);
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
  setTextKey(editLabel, "Editing mode");
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
  setTextKey(setAllLabel, "Set all goals to:");
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
  setTextKey(setAllBtn, "Apply");
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
  setTextKey(resetBtn, "Reset A-Z progress");
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
  const colorDot = (hex) => {
    const dot = document.createElement("span");
    Object.assign(dot.style, {
      display: "inline-block",
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      background: hex
    });
    return dot;
  };
  const legendEntries = [
    { color: '#f87171', label: 'foul' },
    { color: '#22c55e', label: 'matches target length' },
    { color: '#facc15', label: 'nearby length' },
    { color: '#ec4899', label: 'hyphen words' },
    { color: '#3b82f6', label: 'contains filter' },
    { color: '#fde047', label: 'Pokémon' },
    { color: '#92400e', label: 'minerals' },
    { color: '#22d3ee', label: 'rare' },
    { color: '#e2e8f0', label: 'regular' }
  ];
  legendEntries.forEach((entry, idx) => {
    const item = document.createElement('span');
    Object.assign(item.style, { display: 'inline-flex', alignItems: 'center', gap: '6px' });
    const dot = colorDot(entry.color);
    const label = document.createElement('span');
    setTextKey(label, entry.label);
    item.appendChild(dot);
    item.appendChild(label);
    colorGuide.appendChild(item);
    if (idx !== legendEntries.length - 1) {
      const sep = document.createElement('span');
      sep.textContent = '•';
      Object.assign(sep.style, { opacity: '0.6', padding: '0 6px' });
      colorGuide.appendChild(sep);
    }
  });
  const dismiss = document.createElement('span');
  Object.assign(dismiss.style, { fontSize: '10px', opacity: '0.65', marginLeft: '6px' });
  setTextKey(dismiss, 'click me to go away');
  colorGuide.appendChild(dismiss);
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
  setTextKey(modesLabel, "Word modes");
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
    { labelKey: "Me", onClick: () => game.toggleFoulMode(), getOn: () => game.foulMode, scheme: "red", recompute: true },
    { labelKey: "Spectator", onClick: () => game.toggleSpecFoul(), getOn: () => game.specFoulMode, scheme: "red", recompute: true }
  ]);
  dualToggleRows.push(foulDualRow);
  wordModesBody.appendChild(foulDualRow);
  attachPriorityControl(foulDualRow, "foul");

  const pokemonRow = mkDualRow("Pokémon words", [
    { labelKey: "Me", onClick: () => game.togglePokemonMode(), getOn: () => game.pokemonMode, scheme: "gold", recompute: true },
    { labelKey: "Spectator", onClick: () => game.toggleSpecPokemonMode(), getOn: () => game.specPokemonMode, scheme: "gold", recompute: true }
  ]);
  dualToggleRows.push(pokemonRow);
  wordModesBody.appendChild(pokemonRow);

  const mineralsRow = mkDualRow("Minerals", [
    { labelKey: "Me", onClick: () => game.toggleMineralsMode(), getOn: () => game.mineralsMode, scheme: "brown", recompute: true },
    { labelKey: "Spectator", onClick: () => game.toggleSpecMineralsMode(), getOn: () => game.specMineralsMode, scheme: "brown", recompute: true }
  ]);
  dualToggleRows.push(mineralsRow);
  wordModesBody.appendChild(mineralsRow);

  const rareRow = mkDualRow("Rare words", [
    { labelKey: "Me", onClick: () => game.toggleRareMode(), getOn: () => game.rareMode, scheme: "cyan", recompute: true },
    { labelKey: "Spectator", onClick: () => game.toggleSpecRareMode(), getOn: () => game.specRareMode, scheme: "cyan", recompute: true }
  ]);
  dualToggleRows.push(rareRow);
  wordModesBody.appendChild(rareRow);

  const lenDualRow = mkDualRow("Target length", [
    { labelKey: "Me", onClick: () => game.toggleLengthMode(), getOn: () => game.lengthMode, scheme: "green", recompute: true },
    { labelKey: "Spectator", onClick: () => game.toggleSpecLength(), getOn: () => game.specLengthMode, scheme: "green", recompute: true }
  ]);
  dualToggleRows.push(lenDualRow);
  wordModesBody.appendChild(lenDualRow);
  attachPriorityControl(lenDualRow, "length");
  const lenSliderWrap = document.createElement("div");
  Object.assign(lenSliderWrap.style, { display:"grid", gap:"12px", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))" });
  const lenValueDisplay = (v) => (v >= 21 ? translate("Max") : `${Math.round(v)}`);
  const lenSliderMain = sliderRow("Me", 3, 21, Number.isFinite(game.targetLenPref) ? game.targetLenPref : game.targetLen, 1, (v)=>game.setTargetLen(v), { accent: "#22c55e", valueColor: "#86efac", onChange: () => requestSave({ recompute: true }), formatValue: lenValueDisplay });
  const specLenSlider = sliderRow("Spectator", 3, 21, Number.isFinite(game.specTargetLenPref) ? game.specTargetLenPref : game.specTargetLen, 1, (v)=>game.setSpecTargetLen(v), { accent: "#22c55e", valueColor: "#86efac", onChange: () => requestSave({ recompute: true }), formatValue: lenValueDisplay });
  lenSliderWrap.appendChild(lenSliderMain);
  lenSliderWrap.appendChild(specLenSlider);
  wordModesBody.appendChild(lenSliderWrap);

  const hyphenRow = mkDualRow("Hyphen only", [
    { labelKey: "Me", onClick: () => game.toggleHyphenMode(), getOn: () => game.hyphenMode, scheme: "pink", recompute: true },
    { labelKey: "Spectator", onClick: () => game.toggleSpecHyphenMode(), getOn: () => game.specHyphenMode, scheme: "pink", recompute: true }
  ]);
  dualToggleRows.push(hyphenRow);
  wordModesBody.appendChild(hyphenRow);
  attachPriorityControl(hyphenRow, "hyphen");

  const containsRow = mkDualRow("Contains", [
    { labelKey: "Me", onClick: () => game.toggleContainsMode(), getOn: () => game.containsMode, scheme: "default", recompute: true },
    { labelKey: "Spectator", onClick: () => game.toggleSpecContainsMode(), getOn: () => game.specContainsMode, scheme: "default", recompute: true }
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

  const reuseCard = createCard("Word history");
  const preventReuseRow = mkRow("Prevent word reuse", () => {
    game.setPreventWordReuseEnabled(!game.preventWordReuseEnabled);
  }, () => game.preventWordReuseEnabled, "purple", "status", { recompute: true });
  toggleRefs.push(preventReuseRow);
  reuseCard.appendChild(preventReuseRow);

  const reuseControls = document.createElement("div");
  Object.assign(reuseControls.style, { display: "flex", alignItems: "center", justifyContent: "space-between" });
  const reuseStatus = document.createElement("span");
  Object.assign(reuseStatus.style, { fontSize: "12px", color: "#cbd5f5", fontWeight: "600" });
  setTextKey(reuseStatus, "No words logged yet.");
  reuseControls.appendChild(reuseStatus);

  const reuseResetBtn = document.createElement("button");
  Object.assign(reuseResetBtn.style, {
    padding: "5px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(59,130,246,0.45)",
    background: "rgba(37,99,235,0.22)",
    color: "#bfdbfe",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "12px"
  });
  setTextKey(reuseResetBtn, "Reset word log");
  reuseResetBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    game.resetWordReuseLog();
    requestSave({ recompute: true });
    render();
  });
  reuseControls.appendChild(reuseResetBtn);
  reuseCard.appendChild(reuseControls);

  const reuseList = document.createElement("div");
  Object.assign(reuseList.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    maxHeight: "140px",
    overflowY: "auto",
    paddingTop: "4px"
  });
  reuseCard.appendChild(reuseList);
  wordsGrid.appendChild(reuseCard);

  const renderReuseLog = (log) => {
    reuseList.innerHTML = "";
    const words = Array.isArray(log) ? log.slice(0, 80) : [];
    if (!words.length) {
      reuseStatus.style.display = "block";
      reuseList.style.display = "none";
      return;
    }
    reuseStatus.style.display = "none";
    reuseList.style.display = "flex";
    words.forEach((word) => {
      const chip = document.createElement("span");
      chip.textContent = word;
      Object.assign(chip.style, {
        padding: "4px 8px",
        borderRadius: "999px",
        background: "rgba(59,130,246,0.25)",
        border: "1px solid rgba(37,99,235,0.45)",
        color: "#e0f2fe",
        fontWeight: "700",
        fontSize: "12px",
        textTransform: "lowercase"
      });
      reuseList.appendChild(chip);
    });
  };

  renderReuseLog(game.wordReuseLog);
  game.setWordReuseLogChangedCallback((log) => {
    renderReuseLog(log);
  });

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
    if (!entries || !entries.length) { container.textContent = translate("(none)"); return; }
    const syl = (syllable || "").toLowerCase();
    entries.forEach((entry) => {
      const word = typeof entry === "string" ? entry : entry.word;
      const tone = typeof entry === "string" ? "default" : entry.tone || "default";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = Game.highlightSyllable(word, syl);
      btn.title = translate("Click to copy");
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
        pop.textContent = ok ? translate("Copied") : translate("Copy failed");
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
        progressSpan.textContent = translate("excluded");
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
        box.title = translate("Left click to add progress, right click to remove.");
      } else if (coverageEditMode === "goal") {
        box.title = translate("Left click to raise the goal, right click to lower.");
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
      if (foulFallback) parts.push(translate("No foul words matched this prompt; using the normal word list."));
    }
    if ((context==="self" && game.pokemonMode) || (context==="spectator" && game.specPokemonMode)) {
      if (pokemonFallback) parts.push(translate("No Pokémon words matched this prompt; falling back to regular suggestions."));
    }
    if ((context==="self" && game.mineralsMode) || (context==="spectator" && game.specMineralsMode)) {
      if (mineralsFallback) parts.push(translate("No mineral words matched this prompt; showing main list instead."));
    }
    if ((context==="self" && game.rareMode) || (context==="spectator" && game.specRareMode)) {
      if (rareFallback) parts.push(translate("No rare words matched this prompt; showing normal suggestions."));
    }
    if (context==="self" && game.lengthMode && game.coverageMode && capApplied)
      parts.push(translate("Limiting to words of <= {limit} letters while maximizing alphabet coverage.", { limit: formatTargetLenLabel(targetPref, targetActual) }));
    if (context==="self" && game.lengthMode && game.coverageMode && capRelaxed)
      parts.push(translate("No words of <= {limit} letters found; using best coverage regardless of length.", { limit: formatTargetLenLabel(targetPref, targetActual) }));
    if ((context==="self" && game.lengthMode && !game.coverageMode) ||
        (context==="spectator" && game.specLengthMode)) {
      if (lenFallback) {
        if (targetPref >= 21) {
          parts.push(translate("No words at the maximum length; trying nearby lengths."));
        } else {
          parts.push(translate("No words with exactly {target} letters; trying nearby lengths.", { target: formatTargetLenLabel(targetPref, targetActual) }));
        }
      }
      if (lenSuppressed) parts.push(translate("Target length ignored because higher-priority lists supplied enough options."));
    }
    if ((context==="self" && game.containsMode) || (context==="spectator" && game.specContainsMode)) {
      if (containsFallback) parts.push(translate("Contains filter: no matches found; showing broader results."));
    }
    if ((context==="self" && game.hyphenMode) || (context==="spectator" && game.specHyphenMode)) {
      if (hyphenFallback) parts.push(translate("Hyphen mode: no hyphenated words matched this prompt."));
    }
    return parts.join(" ");
  }

  function render() {
    refreshTranslations();
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
      editNotice.textContent = translate("Editing tallies: left-click to add progress, right-click to remove. Values stay within each letter's goal.");
    } else if (coverageEditMode === "goal") {
      editNotice.style.display = "block";
      editNotice.textContent = translate("Editing goals: left-click to raise, right-click to lower, or type a number inside any letter box.");
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
        noticeParts.push(translate("Target length (me): with coverage on it acts as a max (<= {limit}); foul words still take priority.", { limit: formatTargetLenLabel(targetPrefSelf, game.targetLen) }));
      } else if (game.coverageMode) {
        noticeParts.push(translate("Target length (me): acts as a max (<= {limit}) while optimizing alphabet coverage.", { limit: formatTargetLenLabel(targetPrefSelf, game.targetLen) }));
      } else if (game.foulMode) {
        noticeParts.push(translate("Target length (me): ignored when foul words are available; used only if none match."));
      } else {
        noticeParts.push(translate("Target length (me): exact matches show green, nearby lengths appear in yellow when needed."));
      }
    }
    if (game.specLengthMode) {
      if (game.specFoulMode) {
        noticeParts.push(translate("Target length (spectator): ignored whenever foul words are available for the prompt."));
      } else {
        noticeParts.push(translate("Target length (spectator): exact matches show green; nearby lengths are marked in yellow."));
      }
    }
    lenNoticeMain._show(noticeParts.join(" "));

    const isMyTurn = !!game.myTurn;
    dynamicTitle.textContent = isMyTurn ? translate("My top picks") : translate("Spectator suggestions");
    const entries = isMyTurn
      ? ((game.lastTopPicksSelfDisplay && game.lastTopPicksSelfDisplay.length) ? game.lastTopPicksSelfDisplay : game.lastTopPicksSelf)
      : ((game.spectatorSuggestionsDisplay && game.spectatorSuggestionsDisplay.length) ? game.spectatorSuggestionsDisplay : game.spectatorSuggestions);
    const syllable = isMyTurn ? (game.syllable || "") : (game.lastSpectatorSyllable || "");
    clickableWords(wordList, entries, syllable);

    const noticeContext = isMyTurn ? "self" : "spectator";
    turnNotice._show(buildNotice(noticeContext));
  }

  const startNewGameWatcher = () => {
    const JOIN_SELECTOR = '.join .styled.joinRound';
    let joinVisible = false;
    let firstDetection = true;

    const isButtonVisible = (btn) => {
      if (!btn) return false;
      if (btn.closest('[hidden]')) return false;
      const style = window.getComputedStyle(btn);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return btn.offsetParent !== null;
    };

    const handleNewGame = (silent) => {
      game.resetCoverage();
      game.resetWordReuseLog();
      requestSave({ recompute: true });
      if (!silent) showNotification('notice.newGameReset');
      render();
    };

    const evaluate = () => {
      const btn = document.querySelector(JOIN_SELECTOR);
      const visible = isButtonVisible(btn);
      if (visible && !joinVisible) {
        handleNewGame(firstDetection);
        joinVisible = true;
        firstDetection = false;
      } else if (!visible) {
        joinVisible = false;
      }
    };

    const observer = new MutationObserver(() => evaluate());
    try {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden', 'style']
      });
    } catch (err) {
      console.warn('[BombPartyShark] Failed to watch for new games', err);
    }
    const interval = setInterval(evaluate, 1500);
    evaluate();
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  };

  const stopNewGameWatcher = startNewGameWatcher();

  const iv = setInterval(render, 160);
  window.addEventListener("beforeunload", () => {
    clearInterval(iv);
    autoJoinManager.disconnect();
    if (typeof stopNewGameWatcher === 'function') stopNewGameWatcher();
  });

  document.body.appendChild(wrap);
  document.body.appendChild(notificationContainer);
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

    if ("myTurn" in data) game.setMyTurn(data.myTurn);

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


















