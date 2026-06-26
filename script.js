/**
 * Ge'ez ↔ Arabic Number Converter — script.js
 *
 * Implements the official Ethiopian Ge'ez numeral system:
 *   Units  : ፩(1) ፪(2) ፫(3) ፬(4) ፭(5) ፮(6) ፯(7) ፰(8) ፱(9)
 *   Tens   : ፲(10) ፳(20) ፴(30) ፵(40) ፶(50) ፷(60) ፸(70) ፹(80) ፺(90)
 *   Hundred: ፻(100)  — multiplied by a units/tens prefix when > 100
 *   Ten-K  : ፼(10000) — similarly prefixed for multiples
 *
 * Supported range: 1 – 99,999,999
 *
 * Algorithm note:
 *   The Ge'ez system groups digits in pairs working from the left:
 *     n = (myriads part) × 10000 + (hundreds part) × 100 + (remainder)
 *   Each "section" is written with its own units/tens glyphs, then the
 *   section marker (፻ or ፼) appended if the value is a pure marker or
 *   dropped when the section equals exactly the marker value.
 */

"use strict";

/* ══════════════════════════════════════════════════════════════
   1. GE'EZ NUMERAL TABLES
══════════════════════════════════════════════════════════════ */

/** Unicode code points for the Ge'ez numeral block (U+1369–U+137C) */
const GEEZ_UNITS = ['', '፩','፪','፫','፬','፭','፮','፯','፰','፱']; // index 0 = placeholder
const GEEZ_TENS  = ['', '፲','፳','፴','፵','፶','፷','፸','፹','፺']; // index 0 = placeholder
const GEEZ_HUNDRED    = '፻';  // U+137B
const GEEZ_TEN_THOUSAND = '፼'; // U+137C

/** Quick-reference table entries shown in the UI */
const QUICK_REF = [
  {geez:'፩', arabic:1},  {geez:'፪', arabic:2},  {geez:'፫', arabic:3},
  {geez:'፬', arabic:4},  {geez:'፭', arabic:5},  {geez:'፮', arabic:6},
  {geez:'፯', arabic:7},  {geez:'፰', arabic:8},  {geez:'፱', arabic:9},
  {geez:'፲', arabic:10}, {geez:'፳', arabic:20}, {geez:'፴', arabic:30},
  {geez:'፵', arabic:40}, {geez:'፶', arabic:50}, {geez:'፷', arabic:60},
  {geez:'፸', arabic:70}, {geez:'፹', arabic:80}, {geez:'፺', arabic:90},
  {geez:'፻', arabic:100},{geez:'፼', arabic:10000},
];

/* ══════════════════════════════════════════════════════════════
   2. CONVERSION — Arabic → Ge'ez
══════════════════════════════════════════════════════════════ */

/**
 * Converts an integer 1–99,999,999 into its Ge'ez numeral string.
 * @param {number} n
 * @returns {string} Ge'ez numeral string
 */
function arabicToGeez(n) {
  if (!Number.isInteger(n) || n < 1 || n > 99_999_999) {
    throw new RangeError('Number must be an integer between 1 and 99,999,999.');
  }

  let result = '';

  // ── Ten-thousands section (myriads): the portion ÷ 10,000 ──────
  const myriads = Math.floor(n / 10_000);
  if (myriads > 0) {
    // Write the multiplier (1–9999) only if it's not 1 when standing alone
    // Convention: plain ፼ = 10000, so ፩፼ would be redundant for exactly 10000
    // BUT for 1×10000 we still write ፼ without a prefix.
    // For 2×10000, 3×10000 … we prefix the multiplier.
    if (myriads === 1) {
      result += GEEZ_TEN_THOUSAND;
    } else {
      result += encodeLessThanHundred(myriads) + GEEZ_TEN_THOUSAND;
    }
  }

  // ── Hundreds section: remainder after myriads, the ×100 part ───
  const remainder = n % 10_000;
  const hundreds  = Math.floor(remainder / 100);
  if (hundreds > 0) {
    if (hundreds === 1) {
      // ፻ alone means 100 (no prefix needed for ×1)
      result += GEEZ_HUNDRED;
    } else {
      result += encodeLessThanHundred(hundreds) + GEEZ_HUNDRED;
    }
  }

  // ── Units/Tens: the sub-100 remainder ─────────────────────────
  const subHundred = remainder % 100;
  if (subHundred > 0) {
    result += encodeLessThanHundred(subHundred);
  }

  return result;
}

/**
 * Encodes an integer 1–99 into Ge'ez tens + units glyphs.
 * @param {number} n  must be 1–99
 * @returns {string}
 */
function encodeLessThanHundred(n) {
  const tens  = Math.floor(n / 10);
  const units = n % 10;
  return (tens  > 0 ? GEEZ_TENS[tens]  : '')
       + (units > 0 ? GEEZ_UNITS[units] : '');
}

/* ══════════════════════════════════════════════════════════════
   3. CONVERSION — Ge'ez → Arabic
══════════════════════════════════════════════════════════════ */

/**
 * Reverse lookup maps: glyph → value
 * Built once at runtime.
 */
const GEEZ_TO_UNIT  = Object.fromEntries(GEEZ_UNITS.slice(1).map((g,i) => [g, i+1]));
const GEEZ_TO_TEN   = Object.fromEntries(GEEZ_TENS.slice(1).map((g,i)  => [g, (i+1)*10]));

/**
 * All valid Ge'ez numeral glyphs (used for input validation).
 * Includes ፻ and ፼.
 */
const VALID_GEEZ_CHARS = new Set([
  ...GEEZ_UNITS.slice(1),
  ...GEEZ_TENS.slice(1),
  GEEZ_HUNDRED,
  GEEZ_TEN_THOUSAND,
]);

/**
 * Converts a Ge'ez numeral string to an Arabic integer.
 * @param {string} str
 * @returns {number}
 */
function geezToArabic(str) {
  if (!str || str.trim() === '') {
    throw new TypeError('Input is empty.');
  }

  // Validate: every character must be a known Ge'ez numeral
  for (const ch of str) {
    if (!VALID_GEEZ_CHARS.has(ch)) {
      throw new TypeError(`Unknown character: "${ch}". Only Ge'ez numerals are accepted.`);
    }
  }

  /**
   * The string is structured as:
   *   [prefix]፼  [prefix]፻  [units/tens]
   * We scan left to right, accumulating a "current" value,
   * then when we hit ፻ or ፼ we multiply and add to the running total.
   */
  let total   = 0;
  let current = 0; // accumulates value of glyphs seen before a marker

  for (const ch of str) {
    if (ch === GEEZ_TEN_THOUSAND) {
      // Treat an implicit 1 when nothing preceded the marker
      total += (current === 0 ? 1 : current) * 10_000;
      current = 0;
    } else if (ch === GEEZ_HUNDRED) {
      total += (current === 0 ? 1 : current) * 100;
      current = 0;
    } else if (ch in GEEZ_TO_UNIT) {
      current += GEEZ_TO_UNIT[ch];
    } else if (ch in GEEZ_TO_TEN) {
      current += GEEZ_TO_TEN[ch];
    }
  }

  total += current; // add any trailing units/tens

  if (total < 1 || total > 99_999_999) {
    throw new RangeError('Result out of supported range (1–99,999,999).');
  }

  return total;
}

/* ══════════════════════════════════════════════════════════════
   4. INPUT DETECTION
══════════════════════════════════════════════════════════════ */

/**
 * Returns 'arabic', 'geez', or 'unknown' for the trimmed input string.
 * @param {string} str
 * @returns {'arabic'|'geez'|'unknown'}
 */
function detectInputType(str) {
  const trimmed = str.trim();
  if (!trimmed) return 'unknown';

  // Pure Arabic digits (with optional commas/underscores for readability)
  if (/^[\d,_\s]+$/.test(trimmed)) return 'arabic';

  // All characters are valid Ge'ez glyphs
  if ([...trimmed].every(ch => VALID_GEEZ_CHARS.has(ch))) return 'geez';

  return 'unknown';
}

/* ══════════════════════════════════════════════════════════════
   5. DOM REFERENCES
══════════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);

const inputField    = $('inputField');
const outputField   = $('outputField');
const errorMsg      = $('errorMsg');
const detectedMode  = $('detectedMode');
const convertBtn    = $('convertBtn');
const copyBtn       = $('copyBtn');
const clearBtn      = $('clearBtn');
const themeToggle   = $('themeToggle');
const historyList   = $('historyList');
const historyCount  = $('historyCount');
const clearHistBtn  = $('clearHistoryBtn');
const refGrid       = $('refGrid');
const arrowTrack    = document.querySelector('.arrow-track');

const modePills = document.querySelectorAll('.mode-pill');

/* ══════════════════════════════════════════════════════════════
   6. STATE
══════════════════════════════════════════════════════════════ */

let currentMode   = 'auto';   // 'auto' | 'a2g' | 'g2a'
let lastResult    = '';       // last successful conversion result (string)
let history       = [];       // [{from, to, direction, timestamp}]

const MAX_HISTORY = 10;
const LS_HISTORY  = 'geez_history';
const LS_THEME    = 'geez_theme';

/* ══════════════════════════════════════════════════════════════
   7. THEME
══════════════════════════════════════════════════════════════ */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  localStorage.setItem(LS_THEME, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

themeToggle.addEventListener('click', toggleTheme);

// Load saved theme preference
(function initTheme() {
  const saved = localStorage.getItem(LS_THEME);
  // Also respect OS preference if no saved setting
  if (saved) {
    applyTheme(saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  }
})();

/* ══════════════════════════════════════════════════════════════
   8. MODE PILLS
══════════════════════════════════════════════════════════════ */

modePills.forEach(pill => {
  pill.addEventListener('click', () => {
    modePills.forEach(p => { p.classList.remove('active'); p.setAttribute('aria-pressed','false'); });
    pill.classList.add('active');
    pill.setAttribute('aria-pressed', 'true');
    currentMode = pill.dataset.mode;
    // Update input hint based on mode
    updateInputHint();
    clearError();
  });
});

function updateInputHint() {
  const hint = $('inputHint');
  if (currentMode === 'a2g') {
    hint.textContent = 'Enter an Arabic number (1–99,999,999)';
  } else if (currentMode === 'g2a') {
    hint.textContent = 'Enter Ge\'ez numerals (e.g. ፻፳፫)';
  } else {
    hint.textContent = 'Arabic (1–99,999,999) or Ge\'ez numerals';
  }
}

/* ══════════════════════════════════════════════════════════════
   9. CONVERSION
══════════════════════════════════════════════════════════════ */

function doConvert() {
  const raw = inputField.value.trim().replace(/[,_\s]/g, '');
  clearError();
  clearOutput();

  if (!raw) {
    showError('Please enter a number to convert.');
    return;
  }

  // Pulse arrow
  pulseArrow();

  try {
    let result = '';
    let direction = '';

    if (currentMode === 'a2g' || (currentMode === 'auto' && detectInputType(raw) === 'arabic')) {
      // ── Arabic → Ge'ez ──────────────────────────────────────
      const num = parseInt(raw, 10);
      if (isNaN(num)) throw new TypeError('Please enter a valid Arabic number.');
      result = arabicToGeez(num);
      direction = 'Arabic → Ge\'ez';
      detectedMode.textContent = currentMode === 'auto' ? '✓ Detected: Arabic number' : '';

    } else if (currentMode === 'g2a' || (currentMode === 'auto' && detectInputType(raw) === 'geez')) {
      // ── Ge'ez → Arabic ──────────────────────────────────────
      const num = geezToArabic(raw);
      result = num.toLocaleString('en');
      direction = 'Ge\'ez → Arabic';
      detectedMode.textContent = currentMode === 'auto' ? '✓ Detected: Ge\'ez numerals' : '';

    } else {
      // Could not detect
      throw new TypeError('Could not detect input type. Please select a conversion mode above, or check your input.');
    }

    // Display result
    outputField.innerHTML = '';
    outputField.textContent = result;
    outputField.classList.add('has-result');
    lastResult = result;
    copyBtn.disabled = false;

    // Save to history
    addToHistory({ from: raw, to: result, direction });

  } catch (err) {
    showError(err.message);
  }
}

function clearOutput() {
  outputField.innerHTML = '<span class="output-placeholder">—</span>';
  outputField.classList.remove('has-result');
  lastResult = '';
  copyBtn.disabled = true;
  detectedMode.textContent = '';
}

function clearAll() {
  inputField.value = '';
  clearOutput();
  clearError();
  inputField.focus();
}

function pulseArrow() {
  arrowTrack.classList.remove('pulse');
  // Force reflow to restart animation
  void arrowTrack.offsetWidth;
  arrowTrack.classList.add('pulse');
  setTimeout(() => arrowTrack.classList.remove('pulse'), 500);
}

/* ══════════════════════════════════════════════════════════════
   10. ERROR HANDLING
══════════════════════════════════════════════════════════════ */

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
}

function clearError() {
  errorMsg.textContent = '';
  errorMsg.classList.remove('visible');
}

/* ══════════════════════════════════════════════════════════════
   11. COPY TO CLIPBOARD
══════════════════════════════════════════════════════════════ */

function copyResult() {
  if (!lastResult) return;

  navigator.clipboard.writeText(lastResult).then(() => {
    copyBtn.classList.add('copy-success');
    const original = copyBtn.innerHTML;
    copyBtn.innerHTML = '<span class="btn-icon" aria-hidden="true">✓</span> Copied!';
    setTimeout(() => {
      copyBtn.innerHTML = original;
      copyBtn.classList.remove('copy-success');
    }, 1800);
  }).catch(() => {
    // Fallback for environments without clipboard API
    const ta = document.createElement('textarea');
    ta.value = lastResult;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

/* ══════════════════════════════════════════════════════════════
   12. HISTORY
══════════════════════════════════════════════════════════════ */

function loadHistory() {
  try {
    const saved = localStorage.getItem(LS_HISTORY);
    history = saved ? JSON.parse(saved) : [];
  } catch {
    history = [];
  }
  renderHistory();
}

function saveHistory() {
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
  } catch {
    // localStorage might be unavailable in some contexts; silently ignore
  }
}

/**
 * Adds a new entry to the top of the history list.
 * @param {{from:string, to:string, direction:string}} entry
 */
function addToHistory(entry) {
  // Avoid duplicate consecutive entries
  if (history.length > 0 && history[0].from === entry.from && history[0].to === entry.to) {
    return;
  }
  history.unshift({ ...entry, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.pop();
  saveHistory();
  renderHistory();
}

function clearHistory() {
  history = [];
  saveHistory();
  renderHistory();
}

function renderHistory() {
  historyCount.textContent = history.length;

  if (history.length === 0) {
    historyList.innerHTML = '<li class="history-empty">No conversions yet.</li>';
    return;
  }

  historyList.innerHTML = '';
  history.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.setAttribute('role', 'listitem');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', `${item.from} converted to ${item.to} (${item.direction})`);
    li.title = 'Click to load this conversion';

    li.innerHTML = `
      <span class="history-from">${escapeHTML(item.from)}</span>
      <span class="history-arrow">→</span>
      <span class="history-to">${escapeHTML(item.to)}</span>
      <span class="history-direction">${escapeHTML(item.direction.replace('\'','ʼ'))}</span>
    `;

    // Click to reload into input
    li.addEventListener('click', () => {
      inputField.value = item.from;
      clearError();
      clearOutput();
      inputField.focus();
    });

    // Keyboard accessible
    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        li.click();
      }
    });

    historyList.appendChild(li);
  });
}

/** Simple HTML escaper to Prevent XSS in history rendering */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* ══════════════════════════════════════════════════════════════
   13. QUICK REFERENCE
══════════════════════════════════════════════════════════════ */

function buildQuickRef() {
  refGrid.innerHTML = '';
  QUICK_REF.forEach(({ geez, arabic }) => {
    const cell = document.createElement('div');
    cell.className = 'ref-cell';
    cell.setAttribute('role', 'button');
    cell.setAttribute('tabindex', '0');
    cell.setAttribute('aria-label', `${geez} equals ${arabic}`);
    cell.title = `Click to convert ${arabic}`;

    cell.innerHTML = `
      <span class="ref-geez">${geez}</span>
      <span class="ref-arabic">${arabic.toLocaleString('en')}</span>
    `;

    // Click to populate and convert
    cell.addEventListener('click', () => {
      inputField.value = arabic;
      // Set mode to arabic→geez
      modePills.forEach(p => { p.classList.remove('active'); p.setAttribute('aria-pressed','false'); });
      const a2gPill = document.querySelector('[data-mode="a2g"]');
      a2gPill.classList.add('active');
      a2gPill.setAttribute('aria-pressed','true');
      currentMode = 'a2g';
      doConvert();
      inputField.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cell.click();
      }
    });

    refGrid.appendChild(cell);
  });
}

/* ══════════════════════════════════════════════════════════════
   14. EVENT LISTENERS
══════════════════════════════════════════════════════════════ */

convertBtn.addEventListener('click', doConvert);
clearBtn.addEventListener('click', clearAll);
copyBtn.addEventListener('click', copyResult);
clearHistBtn.addEventListener('click', clearHistory);

// Allow Enter key to trigger conversion (Shift+Enter = newline)
inputField.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    doConvert();
  }
});

// Live detect on input (update hint, no conversion)
inputField.addEventListener('input', () => {
  clearError();
  if (lastResult) clearOutput();

  if (currentMode === 'auto') {
    const type = detectInputType(inputField.value.trim().replace(/[,_\s]/g,''));
    if (type === 'arabic')      detectedMode.textContent = 'Detected: Arabic number';
    else if (type === 'geez')   detectedMode.textContent = 'Detected: Ge\'ez numerals';
    else                        detectedMode.textContent = '';
  }
});

/* ══════════════════════════════════════════════════════════════
   15. INITIALISE
══════════════════════════════════════════════════════════════ */

loadHistory();
buildQuickRef();
updateInputHint();
inputField.focus();
