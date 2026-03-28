import { escapeHtml, prettyCategory, prettySubcategory, scoreToneClass } from "./lib/ui.js";

const panelContent = document.getElementById("panel-content");
const refreshButton = document.getElementById("refresh-analysis-button");
const settingsButton = document.getElementById("open-settings-button");

let currentTabId = null;
let currentAnalysis = null;
let currentAssistantQuestion = "";
let currentAssistantAnswer = "";

const INGREDIENT_ICONS = {
  good: `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5,7 5.5,10.5 11.5,3.5"/></svg>`,
  caution: `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="7" y1="3.5" x2="7" y2="8"/><circle cx="7" cy="10.5" r="0.8" fill="currentColor" stroke="none"/></svg>`,
  avoid: `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3.5" y1="3.5" x2="10.5" y2="10.5"/><line x1="10.5" y1="3.5" x2="3.5" y2="10.5"/></svg>`,
  neutral: `<svg viewBox="0 0 14 14" fill="currentColor"><circle cx="7" cy="7" r="2.5"/></svg>`
};

const NUTRITION_THRESHOLDS = {
  sugars: { good: [0, 0], fair: [0.1, 5], caution: [5.1, 10], avoid: [10.1, Infinity], unit: "g", label: "Sugar" },
  addedSugars: { good: [0, 0], fair: [0.1, 3], caution: [3.1, 8], avoid: [8.1, Infinity], unit: "g", label: "Added sugar" },
  sodium: { good: [0, 140], fair: [141, 400], caution: [401, 800], avoid: [801, Infinity], unit: "mg", label: "Sodium" },
  protein: { avoid: [0, 0], caution: [0.1, 4], fair: [4.1, 9], good: [9.1, Infinity], unit: "g", label: "Protein", higherIsBetter: true },
  fiber: { caution: [0, 1], fair: [1.1, 2.9], good: [3, Infinity], unit: "g", label: "Fiber", higherIsBetter: true },
  calories: { unit: "kcal", label: "Calories", neutral: true }
};

const GROUP_PREFIX_PATTERNS = [
  /^ingredients?\s*:\s*/i,
  /^active ingredients?\s*:\s*/i,
  /^inactive ingredients?\s*:\s*/i,
  /^contains\s*:\s*/i,
  /^contains\s+less\s+than\s+\d+(?:\.\d+)?%\s+of\s*:?\s*/i,
  /^contains\s+\d+(?:\.\d+)?%\s+or\s+less\s+of\s*:?\s*/i,
  /^less\s+than\s+\d+(?:\.\d+)?%\s+of\s*:?\s*/i,
  /^\d+(?:\.\d+)?%\s+or\s+less\s+of\s*:?\s*/i
];

const QUANTITY_PATTERNS = [
  /^\s*(\d+(?:\.\d+)?)\s*(billion\s+cfu|million\s+cfu|cfu|mcg\s*dfe|mcg|mg|g|ml|iu|%)\s*(?:of\s+)?(.+)$/i,
  /^\s*(.+?)\s*\((\d+(?:\.\d+)?)\s*(billion\s+cfu|million\s+cfu|cfu|mcg\s*dfe|mcg|mg|g|ml|iu|%)\)\s*$/i,
  /^\s*(.+?)\s+(\d+(?:\.\d+)?)\s*(billion\s+cfu|million\s+cfu|cfu|mcg\s*dfe|mcg|mg|g|ml|iu|%)\s*$/i
];

function getActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab || null);
}

function getAlternativeList() {
  return currentAnalysis?.alternatives?.primary || [];
}

function renderLoadingState() {
  panelContent.innerHTML = `
    <section class="empty-state">
      <div class="orb"></div>
      <h2>Analyzing</h2>
      <p>Pulling product data and checking whether this is a scoreable item.</p>
    </section>
  `;
}

function renderEmptyState(title, message) {
  panelContent.innerHTML = `
    <section class="empty-state">
      <div class="orb"></div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function renderErrorState(message) {
  panelContent.innerHTML = `
    <section class="empty-state">
      <div class="orb"></div>
      <h2>Something went wrong</h2>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function renderIngredientChips(items = []) {
  if (!items.length) {
    return "";
  }

  return `
    <div class="ingredient-chip-row">
      ${items.slice(0, 6).map((item) => `<span class="ingredient-chip">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function renderSignalList(items, emptyMessage, variant) {
  if (!items.length) {
    return `<article class="signal-item"><p class="muted">${escapeHtml(emptyMessage)}</p></article>`;
  }

  return items.map((item) => `
    <article class="signal-item ${escapeHtml(variant)}">
      <div class="signal-heading">
        <div>
          <h4>${escapeHtml(item.title)}</h4>
          ${renderIngredientChips(item.matchedIngredients || [])}
        </div>
        <span class="effect-pill ${escapeHtml(variant)}">${escapeHtml(item.effect || (variant === "positive" ? "+" : "-"))}</span>
      </div>
      <p class="signal-copy">${escapeHtml(item.detail || item.reason || "")}</p>
    </article>
  `).join("");
}

function formatQuantity(value, unit) {
  const normalizedUnit = String(unit || "").trim().toLowerCase();
  if (!normalizedUnit) {
    return null;
  }
  if (normalizedUnit === "%") {
    return `${value}%`;
  }
  if (normalizedUnit === "iu") {
    return `${value} IU`;
  }
  if (normalizedUnit === "cfu") {
    return `${value} CFU`;
  }
  if (normalizedUnit === "million cfu") {
    return `${value} million CFU`;
  }
  if (normalizedUnit === "billion cfu") {
    return `${value} billion CFU`;
  }
  if (normalizedUnit === "mcg dfe") {
    return `${value} mcg DFE`;
  }
  return `${value} ${normalizedUnit}`;
}

function stripIngredientPrefix(text) {
  let cleaned = String(text || "").trim();
  for (const pattern of GROUP_PREFIX_PATTERNS) {
    cleaned = cleaned.replace(pattern, "").trim();
  }
  return cleaned;
}

function cleanIngredientName(text) {
  return String(text || "")
    .replace(/^[-:;,.\s]+/, "")
    .replace(/[-:;,.\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeIngredientName(text) {
  return cleanIngredientName(text)
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9+\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIngredientEntry(rawIngredient) {
  const sourceText = String(rawIngredient?.displayName || rawIngredient?.canonicalName || rawIngredient || "").trim();
  if (!sourceText) {
    return null;
  }

  let text = stripIngredientPrefix(sourceText);
  let quantity = rawIngredient?.quantityText || rawIngredient?.quantity || rawIngredient?.amount || null;
  let name = text;

  for (const pattern of QUANTITY_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    if (pattern === QUANTITY_PATTERNS[0]) {
      quantity = formatQuantity(match[1], match[2]);
      name = match[3];
    } else {
      name = match[1];
      quantity = formatQuantity(match[2], match[3]);
    }
    break;
  }

  name = cleanIngredientName(name);
  const canonicalName = canonicalizeIngredientName(name || sourceText);
  if (!canonicalName) {
    return null;
  }

  return {
    displayName: name || cleanIngredientName(sourceText),
    canonicalName,
    quantityText: quantity ? String(quantity) : "Not disclosed"
  };
}

function parseIngredientTextList(ingredientsText) {
  const text = String(ingredientsText || "").trim();
  if (!text) {
    return [];
  }

  return text
    .split(/,(?![^()]*\))/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => parseIngredientEntry(item))
    .filter(Boolean);
}

function toIngredientList(product) {
  const baseItems = Array.isArray(product?.ingredientsList) && product.ingredientsList.length
    ? product.ingredientsList
    : Array.isArray(product?.ingredients) && product.ingredients.length
      ? product.ingredients
      : parseIngredientTextList(product?.ingredients || "");

  const deduped = new Map();
  for (const item of baseItems) {
    const parsed = parseIngredientEntry(item);
    if (!parsed) {
      continue;
    }

    const existing = deduped.get(parsed.canonicalName);
    if (!existing) {
      deduped.set(parsed.canonicalName, parsed);
      continue;
    }

    const existingHasQuantity = existing.quantityText && existing.quantityText !== "Not disclosed";
    const parsedHasQuantity = parsed.quantityText && parsed.quantityText !== "Not disclosed";
    if (!existingHasQuantity && parsedHasQuantity) {
      deduped.set(parsed.canonicalName, parsed);
    }
  }

  return [...deduped.values()];
}

function ingredientStatusIcon(ingredient, flags, benefits) {
  const name = ingredient.canonicalName;

  for (const flag of flags) {
    const matched = (flag.matchedIngredients || []).map((item) => canonicalizeIngredientName(item));
    if (matched.some((value) => value && (name.includes(value) || value.includes(name)))) {
      const severity = flag.severity || "medium";
      const tone = severity === "critical" || severity === "high" ? "avoid" : "caution";
      const label = escapeHtml(flag.title || (tone === "avoid" ? "Avoid" : "Caution"));
      return `<span class="ing-icon ${tone}" title="${label}">${INGREDIENT_ICONS[tone]}</span>`;
    }
  }

  for (const benefit of benefits) {
    const matched = (benefit.matchedIngredients || []).map((item) => canonicalizeIngredientName(item));
    if (matched.some((value) => value && (name.includes(value) || value.includes(name)))) {
      return `<span class="ing-icon good" title="${escapeHtml(benefit.title || "Beneficial")}">${INGREDIENT_ICONS.good}</span>`;
    }
  }

  return `<span class="ing-icon neutral" title="Neutral">${INGREDIENT_ICONS.neutral}</span>`;
}

function renderIngredients(ingredients = [], flags = [], benefits = []) {
  if (!ingredients.length) {
    return `<article class="signal-item"><p class="muted">No ingredient data available for this product.</p></article>`;
  }

  return `
    <div class="ingredient-list">
      ${ingredients.map((ingredient) => `
        <article class="ingredient-row">
          <div class="ingredient-main">
            ${ingredientStatusIcon(ingredient, flags, benefits)}
            <div class="ingredient-text">
              <span class="ingredient-name">${escapeHtml(ingredient.displayName)}</span>
            </div>
          </div>
          <span class="ingredient-qty ${ingredient.quantityText === "Not disclosed" ? "missing" : ""}">${escapeHtml(ingredient.quantityText)}</span>
        </article>
      `).join("")}
    </div>
  `;
}

function nutritionTone(key, value) {
  const rule = NUTRITION_THRESHOLDS[key];
  if (!rule || rule.neutral) {
    return "neutral";
  }

  for (const tone of ["good", "fair", "caution", "avoid"]) {
    const range = rule[tone];
    if (range && value >= range[0] && value <= range[1]) {
      return tone;
    }
  }

  return "neutral";
}

function renderNutritionProsCons(nutrition) {
  if (!nutrition || typeof nutrition !== "object" || !Object.keys(nutrition).length) {
    return "";
  }

  const orderedKeys = ["calories", "protein", "fiber", "sugars", "addedSugars", "sodium"];
  const chips = [];

  for (const key of orderedKeys) {
    const value = nutrition[key];
    if (value == null) {
      continue;
    }

    const config = NUTRITION_THRESHOLDS[key];
    if (!config) {
      continue;
    }

    if (key === "addedSugars" && value === nutrition.sugars) {
      continue;
    }

    const tone = nutritionTone(key, value);
    const icon = tone === "good"
      ? INGREDIENT_ICONS.good
      : tone === "avoid"
        ? INGREDIENT_ICONS.avoid
        : tone === "fair" || tone === "caution"
          ? INGREDIENT_ICONS.caution
          : "";
    const displayValue = Number.isInteger(value) ? String(value) : Number(value).toFixed(1);

    chips.push(`
      <div class="nutri-chip ${tone}">
        ${icon ? `<span class="nutri-icon">${icon}</span>` : ""}
        <span>${escapeHtml(`${displayValue}${config.unit === "%" ? "%" : ` ${config.unit}`} ${config.label.toLowerCase()}`)}</span>
      </div>
    `);
  }

  if (!chips.length) {
    return "";
  }

  return `<div class="nutri-row">${chips.join("")}</div>`;
}

function shouldShowScore(analysis, ingredients) {
  const category = analysis.classification?.category || analysis.product?.category || "unknown";
  const confidence = typeof analysis.confidence?.overall === "number" ? analysis.confidence.overall : 0;
  const hasNutrition = Boolean(analysis.product?.nutrition && Object.keys(analysis.product.nutrition).length);
  const hasIngredients = ingredients.length >= 2;

  if (!analysis?.product?.title || category === "unknown") {
    return false;
  }
  if (analysis.states?.unsupportedCategory || analysis.states?.lowConfidence || confidence < 0.62) {
    return false;
  }
  if (category === "food") {
    return hasNutrition || hasIngredients;
  }
  return hasIngredients;
}

function renderScoreCard(analysis, ingredients) {
  if (!shouldShowScore(analysis, ingredients)) {
    return `
      <div class="score-card unscored">
        <span class="score-unavailable-title">Not scored</span>
        <span class="score-note">Needs a verified item match</span>
      </div>
    `;
  }

  const scoreTone = scoreToneClass(analysis.score.tone);
  return `
    <div class="score-card ${escapeHtml(scoreTone)}">
      <span class="score-number">${analysis.score.value}</span>
      <span class="score-denominator">/ 100</span>
      <span class="score-label">${escapeHtml(analysis.score.label)}</span>
    </div>
  `;
}

function renderAlternatives(alternatives, analysis) {
  const categoryLabel = prettySubcategory(analysis.classification?.subcategory) === "General"
    ? prettyCategory(analysis.classification?.category)
    : `${prettySubcategory(analysis.classification?.subcategory)} ${prettyCategory(analysis.classification?.category).toLowerCase()}`;

  if (!alternatives.length) {
    return `
      <article class="signal-item">
        <p class="muted">No stronger same-category alternatives have been confirmed yet. ScanCart will surface them as soon as it finds better-scoring matches.</p>
      </article>
    `;
  }

  return `
    <div class="alternatives-list">
      ${alternatives.map((item, index) => `
        <article class="alternative-card">
          <div class="alternative-main">
            ${item.image ? `<img class="alternative-image" src="${escapeHtml(item.image)}" alt="">` : `<div class="alternative-image placeholder"></div>`}
            <div class="alternative-copy">
              <div class="alternative-topline">
                <h4>${escapeHtml(item.title)}</h4>
                <span class="score-mini ${escapeHtml(scoreToneClass(item.scoreTone))}">${escapeHtml(String(item.score))}/100</span>
              </div>
              <p class="muted">${escapeHtml(categoryLabel)}</p>
              <p class="alternative-reason">${escapeHtml((item.reasons || []).slice(0, 2).join(" ") || "Higher score and cleaner fit within the same category.")}</p>
            </div>
          </div>
          <div class="alternative-actions">
            <button class="button primary small" data-action="open-alt" data-alt-index="${index}">Open product</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderAssistantCard(analysis) {
  const category = analysis.classification?.category || analysis.product?.category || "unknown";
  const suggestedQuestions = category === "food"
    ? ["Why is this score low?", "Which ingredients are the main negatives?", "Why is the alternative better?"]
    : category === "skincare"
      ? ["Which ingredients are helping here?", "Which ingredients are the biggest concern?", "Why is the alternative better?"]
      : ["Why did this score this way?", "What ingredients caused the warning?", "Why is the alternative better?"];

  return `
    <section class="section-card assistant-card">
      <div class="section-head"><h3>Ask ScanCart</h3></div>
      <div class="suggested-row">
        ${suggestedQuestions.map((question) => `<button class="button ghost small" data-suggested-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`).join("")}
      </div>
      <form id="assistant-form" class="assistant-form">
        <textarea id="assistant-input" name="assistantQuestion" placeholder="Ask about the score, ingredients, or an alternative.">${escapeHtml(currentAssistantQuestion)}</textarea>
        <div class="assistant-actions">
          <button class="button primary" type="submit">Ask</button>
        </div>
      </form>
      <article class="assistant-answer">
        ${currentAssistantAnswer
          ? `<p>${escapeHtml(currentAssistantAnswer)}</p>`
          : `<p class="muted">Type a question above to get a plain-English answer.</p>`}
      </article>
    </section>
  `;
}

function renderAnalysis() {
  if (!currentAnalysis) {
    return;
  }

  const analysis = currentAnalysis;
  const product = analysis.product;
  const ingredients = toIngredientList(product);

  panelContent.innerHTML = `
    <div class="panel-stack">
      <section class="hero-card">
        <div class="hero-layout">
          <div class="hero-product">
            ${product.image ? `<img class="product-image" src="${escapeHtml(product.image)}" alt="">` : `<div class="product-image placeholder"></div>`}
            <div class="hero-copy">
              <h2 class="product-title">${escapeHtml(product.title || "Product unavailable")}</h2>
              ${product.brand ? `<p class="muted" style="font-size:12px;margin-top:2px;">${escapeHtml(product.brand)}</p>` : ""}
            </div>
          </div>
          ${renderScoreCard(analysis, ingredients)}
        </div>
      </section>

      <section class="section-card">
        <div class="section-head"><h3>Concerns</h3></div>
        <div class="signal-list">
          ${renderSignalList(analysis.flags, "No major concerns identified.", "negative")}
        </div>
      </section>

      <section class="section-card">
        <div class="section-head"><h3>Benefits</h3></div>
        <div class="signal-list">
          ${renderSignalList(analysis.benefits, "No standout benefits identified.", "positive")}
        </div>
      </section>

      <section class="section-card">
        <div class="section-head"><h3>Ingredients</h3></div>
        ${renderNutritionProsCons(product.nutrition)}
        ${renderIngredients(ingredients, analysis.flags || [], analysis.benefits || [])}
      </section>

      ${renderAssistantCard(analysis)}

      <section class="section-card">
        <div class="section-head"><h3>Better alternatives</h3></div>
        ${renderAlternatives(getAlternativeList(), analysis)}
      </section>
    </div>
  `;
}

async function askAssistant(question) {
  currentAssistantQuestion = question;
  currentAssistantAnswer = "Thinking through the current evidence...";
  renderAnalysis();

  const response = await chrome.runtime.sendMessage({
    type: "SCANCART_ASK_ASSISTANT",
    tabId: currentTabId,
    question,
    compareTarget: null
  });

  currentAssistantAnswer = response?.answer || response?.error || "No answer available.";
  renderAnalysis();
}

async function loadAnalysis(forceRefresh = false) {
  try {
    renderLoadingState();
    const tab = await getActiveTab();
    currentTabId = tab?.id || null;

    if (!currentTabId) {
      renderEmptyState("Open a browser tab first", "ScanCart needs an active tab to analyze a product.");
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: forceRefresh ? "SCANCART_REFRESH_ANALYSIS" : "SCANCART_GET_ANALYSIS",
      tabId: currentTabId
    });

    let analysis = response?.analysis || null;
    if (!analysis) {
      const refreshResponse = await chrome.runtime.sendMessage({ type: "SCANCART_REFRESH_ANALYSIS", tabId: currentTabId });
      analysis = refreshResponse?.analysis || null;
    }

    if (!analysis) {
      renderEmptyState("Open a supported product page", "ScanCart will populate once you land on a supported retailer product page.");
      return;
    }

    currentAnalysis = analysis;
    currentAssistantQuestion = "";
    currentAssistantAnswer = "";
    renderAnalysis();
  } catch (error) {
    renderErrorState(error.message || "The side panel could not load the current product.");
  }
}

panelContent.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button || !currentAnalysis) {
    return;
  }

  const suggestedQuestion = button.dataset.suggestedQuestion;
  if (suggestedQuestion) {
    await askAssistant(suggestedQuestion);
    return;
  }

  const action = button.dataset.action;
  if (!action) {
    return;
  }

  if (action === "open-alt") {
    const alternative = getAlternativeList()[Number(button.dataset.altIndex)];
    if (alternative?.url) {
      await chrome.tabs.update(currentTabId, { url: alternative.url });
    }
  }
});

panelContent.addEventListener("submit", async (event) => {
  if (event.target.id !== "assistant-form") {
    return;
  }

  event.preventDefault();
  const formData = new FormData(event.target);
  const question = String(formData.get("assistantQuestion") || "").trim();
  if (!question) {
    return;
  }
  await askAssistant(question);
});

refreshButton.addEventListener("click", () => {
  loadAnalysis(true);
});

settingsButton.addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
});

if (chrome.tabs?.onActivated) {
  chrome.tabs.onActivated.addListener(() => loadAnalysis());
}

if (chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId === currentTabId && changeInfo.status === "complete") {
      loadAnalysis();
    }
  });
}

window.addEventListener("focus", () => loadAnalysis());

loadAnalysis();
