import { confidenceLabel, escapeHtml, formatPrice, prettyCategory, scoreToneClass } from "./lib/ui.js";

const panelContent = document.getElementById("panel-content");
const refreshButton = document.getElementById("refresh-analysis-button");
const settingsButton = document.getElementById("open-settings-button");

let currentTabId = null;
let currentAnalysis = null;
let currentCompare = null;
let currentAssistantQuestion = "";
let currentAssistantAnswer = "";

function getActiveTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => tab || null);
}

function renderLoadingState() {
  panelContent.innerHTML = `
    <section class="empty-state">
      <div class="orb"></div>
      <p class="eyebrow">Analyzing</p>
      <h2>Checking this product now</h2>
      <p>Pulling product details, validating what we can, and building an explainable score.</p>
    </section>
  `;
}

function renderEmptyState(title, message) {
  panelContent.innerHTML = `
    <section class="empty-state">
      <div class="orb"></div>
      <p class="eyebrow">Waiting</p>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function renderErrorState(message) {
  panelContent.innerHTML = `
    <section class="empty-state">
      <div class="orb"></div>
      <p class="eyebrow">Error</p>
      <h2>ScanCart hit a snag</h2>
      <p>${escapeHtml(message)}</p>
    </section>
  `;
}

function renderSignalCards(items, emptyMessage, kind) {
  if (!items.length) {
    return `<div class="signal-card"><div class="muted">${escapeHtml(emptyMessage)}</div></div>`;
  }

  return items.map((item) => {
    const severity = kind === "benefit" ? "low" : (item.severity || "medium");
    const effect = kind === "benefit" ? (item.effect || "+") : (item.effect || severity);
    return `
      <article class="signal-card">
        <div class="signal-top">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="severity-pill ${escapeHtml(severity)}">${escapeHtml(effect)}</span>
        </div>
        <div class="signal-detail">${escapeHtml(item.detail || item.reason || "")}</div>
      </article>
    `;
  }).join("");
}

function renderPreferenceHits(items) {
  if (!items.length) {
    return `<div class="signal-card"><div class="muted">No active preference adjustments were applied to this score.</div></div>`;
  }

  return items.map((item) => `
    <article class="signal-card">
      <div class="signal-detail">${escapeHtml(item)}</div>
    </article>
  `).join("");
}

function renderSources(sources, confidence) {
  const summaryCard = `
    <article class="source-card">
      <div class="source-top">
        <strong>${escapeHtml(confidenceLabel(confidence.overall))}</strong>
        <span class="confidence-chip">${Math.round(confidence.overall * 100)}%</span>
      </div>
      <div class="source-detail">
        Identity confidence ${Math.round(confidence.identity * 100)}% - ingredients ${Math.round(confidence.ingredients * 100)}% - nutrition ${Math.round(confidence.nutrition * 100)}%
      </div>
    </article>
  `;

  const sourceCards = sources.map((source) => `
    <article class="source-card">
      <div class="source-top">
        <strong>${escapeHtml(source.sourceType.replace(/_/g, " "))}</strong>
        <span class="mini-metric">${Math.round(source.authorityWeight * 100)}%</span>
      </div>
      <div class="source-detail">Fields: ${escapeHtml(source.fields.join(", ") || "none")}</div>
      <div class="source-detail">Selected for: ${escapeHtml(source.selectedFor.join(", ") || "support only")}</div>
    </article>
  `).join("");

  return summaryCard + sourceCards;
}

function renderAlternatives(alternatives) {
  if (!alternatives.length) {
    return `<article class="alt-card"><div class="muted">No strong alternatives were found yet. Analyze a few similar products and ScanCart will build a much better comparison pool.</div></article>`;
  }

  return alternatives.map((item, index) => `
    <article class="alt-card">
      <div class="alt-top">
        <img class="alt-image" src="${escapeHtml(item.image || "")}" alt="">
        <div>
          <div class="hero-pills">
            <span class="score-pill ${escapeHtml(scoreToneClass(item.scoreTone))}">${item.score} - ${escapeHtml(item.scoreLabel)}</span>
            <span class="pill">${escapeHtml(item.price || "Price unavailable")}</span>
          </div>
          <h4>${escapeHtml(item.title)}</h4>
          <div class="alt-detail">${escapeHtml(item.reasons[0] || "Potentially cleaner or better-fit option.")}</div>
        </div>
      </div>
      <div class="alt-actions">
        <button class="button ghost small" data-action="compare" data-alt-index="${index}">Compare</button>
        <button class="button primary small" data-action="open-alt" data-alt-index="${index}">Open product</button>
      </div>
    </article>
  `).join("");
}

function renderCompareCard() {
  if (!currentCompare) {
    return "";
  }

  const alternative = currentCompare.alternative;
  return `
    <section class="compare-card">
      <div class="compare-header">
        <div>
          <p class="section-kicker">Compare</p>
          <h3>Current product vs alternative</h3>
          <p class="section-subtitle">${escapeHtml(currentCompare.summary)}</p>
        </div>
        <button class="button ghost small" data-action="close-compare">Close</button>
      </div>
      <div class="compare-table">
        <div class="compare-row">
          <strong>Overall score</strong>
          <div>${currentAnalysis.score.value} - ${escapeHtml(currentAnalysis.score.label)} vs ${alternative.score} - ${escapeHtml(alternative.scoreLabel)}</div>
        </div>
        <div class="compare-row">
          <strong>Main concerns</strong>
          <div>${escapeHtml(currentAnalysis.flags.slice(0, 2).map((item) => item.title).join(", ") || "No major concerns surfaced")}</div>
        </div>
        <div class="compare-row">
          <strong>Why the alternative looks better</strong>
          <div>${escapeHtml((alternative.reasons || []).join(" ") || "It appears to offer a stronger fit based on the available evidence.")}</div>
        </div>
        <div class="compare-row">
          <strong>Price snapshot</strong>
          <div>${escapeHtml(formatPrice(currentAnalysis.product.price))} vs ${escapeHtml(alternative.price || "Price unavailable")}</div>
        </div>
      </div>
    </section>
  `;
}

function renderAssistantCard() {
  const suggestedQuestions = currentAnalysis.product.category === "food"
    ? ["Why was this rated caution?", "Is this okay for a high-protein diet?", "What ingredient caused the warning?"]
    : ["Why is this a concern for sensitive skin?", "What ingredient is doing the most good here?", "Why is the alternative better?"];

  return `
    <section class="assistant-card">
      <div class="assistant-header">
        <div>
          <p class="section-kicker">Assistant</p>
          <h3>Ask ScanCart</h3>
          <p class="section-subtitle">Grounded in the current score, evidence, and product data.</p>
        </div>
      </div>
      <div class="suggested-row">
        ${suggestedQuestions.map((question) => `<button class="button ghost small" data-suggested-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`).join("")}
      </div>
      <form id="assistant-form" class="assistant-form">
        <textarea id="assistant-input" name="assistantQuestion" placeholder="Ask why this scored the way it did, whether it fits your preferences, or why an alternative looks better.">${escapeHtml(currentAssistantQuestion)}</textarea>
        <div class="assistant-actions">
          <button class="button primary" type="submit">Ask</button>
        </div>
      </form>
      <div class="assistant-response">
        ${currentAssistantAnswer ? `
          <article class="assistant-answer">
            <strong>Answer</strong>
            <div class="signal-detail">${escapeHtml(currentAssistantAnswer)}</div>
          </article>
        ` : `
          <article class="assistant-answer">
            <div class="muted">Ask a question to get a plain-English explanation grounded in the current product analysis.</div>
          </article>
        `}
      </div>
    </section>
  `;
}

function renderAnalysis() {
  if (!currentAnalysis) {
    return;
  }

  const analysis = currentAnalysis;
  const scoreTone = scoreToneClass(analysis.score.tone);
  const warningsMarkup = analysis.warnings.length ? `
    <section class="notice-banner">
      <strong>Verification note</strong>
      <div class="signal-detail">${escapeHtml(analysis.warnings.join(" "))}</div>
    </section>
  ` : "";

  panelContent.innerHTML = `
    <div class="panel-shell">
      <section class="hero-card">
        <div class="hero-grid">
          <div class="hero-copy">
            <div class="hero-heading">
              <img class="product-thumb" src="${escapeHtml(analysis.product.image || "")}" alt="">
              <div>
                <div class="hero-pills">
                  <span class="pill">Amazon</span>
                  <span class="pill">${escapeHtml(prettyCategory(analysis.product.category))}</span>
                  <span class="confidence-chip">${escapeHtml(confidenceLabel(analysis.confidence.overall))}</span>
                </div>
                <h2 class="product-title">${escapeHtml(analysis.product.title)}</h2>
                <p class="brand-line muted">${escapeHtml(analysis.product.brand || "Brand unavailable")}</p>
              </div>
            </div>
            <p class="summary-copy">${escapeHtml(analysis.explanations.shortExplanation)}</p>
            <div class="tag-row">
              ${(analysis.tags.length ? analysis.tags : ["source-backed score"]).map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join("")}
            </div>
            <div class="metrics-strip">
              <div class="metric-card">
                <p class="metric-label">Price</p>
                <div class="metric-value">${escapeHtml(formatPrice(analysis.product.price))}</div>
              </div>
              <div class="metric-card">
                <p class="metric-label">Rating</p>
                <div class="metric-value">${escapeHtml(analysis.product.rating ? `${analysis.product.rating}${analysis.product.reviewCount ? ` - ${analysis.product.reviewCount}` : ""}` : "Rating unavailable")}</div>
              </div>
              <div class="metric-card">
                <p class="metric-label">Confidence</p>
                <div class="metric-value">${Math.round(analysis.confidence.overall * 100)}%</div>
              </div>
            </div>
            <div class="hero-actions">
              <button class="button primary" data-action="toggle-save">${analysis.saved ? "Saved" : "Save product"}</button>
              <button class="button ghost" data-action="open-product">Open product page</button>
            </div>
          </div>
          <div class="score-stack">
            <div class="score-orb ${escapeHtml(scoreTone)}">
              <div>
                <span class="score-number">${analysis.score.value}</span>
                <span class="score-text">${escapeHtml(analysis.score.label)}</span>
              </div>
            </div>
            <span class="mini-metric ${escapeHtml(scoreTone)}">${analysis.alternatives.length} alternatives ready</span>
          </div>
        </div>
      </section>

      ${warningsMarkup}

      <section class="state-card">
        <div class="section-header">
          <div>
            <p class="section-kicker">Summary</p>
            <h3>Why it scored this way</h3>
            <p class="section-subtitle">${escapeHtml(analysis.explanations.detailedExplanation || analysis.explanations.shortExplanation)}</p>
          </div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="section-kicker">Breakdown</p>
            <h3>Key positives and concerns</h3>
          </div>
        </div>
        <div class="two-column">
          <div class="stack-list">
            <p class="section-kicker">Top positives</p>
            ${renderSignalCards(analysis.benefits.slice(0, 4), "No standout positives were identified.", "benefit")}
          </div>
          <div class="stack-list">
            <p class="section-kicker">Key concerns</p>
            ${renderSignalCards(analysis.flags.slice(0, 4), "No major concerns were identified.", "flag")}
          </div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="section-kicker">Personalization</p>
            <h3>Preference fit</h3>
          </div>
        </div>
        <div class="stack-list">
          ${renderPreferenceHits(analysis.preferenceHits)}
        </div>
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="section-kicker">Trust</p>
            <h3>Source transparency</h3>
          </div>
        </div>
        <div class="stack-list">
          ${renderSources(analysis.sources, analysis.confidence)}
        </div>
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="section-kicker">Alternatives</p>
            <h3>Better-fit options</h3>
            <p class="section-subtitle">Cleaner, stronger, or more preference-aligned options available from the current candidate pool.</p>
          </div>
        </div>
        <div class="alternatives-grid">
          ${renderAlternatives(analysis.alternatives)}
        </div>
      </section>

      ${renderCompareCard()}
      ${renderAssistantCard()}
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
    question
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

    const isAmazonProduct = Boolean(tab?.url && /amazon\.com\/.*\/(dp|gp\/product)\//.test(tab.url));
    const response = await chrome.runtime.sendMessage({
      type: forceRefresh ? "SCANCART_REFRESH_ANALYSIS" : "SCANCART_GET_ANALYSIS",
      tabId: currentTabId
    });

    let analysis = response?.analysis || null;
    if (!analysis && isAmazonProduct) {
      const refreshResponse = await chrome.runtime.sendMessage({ type: "SCANCART_REFRESH_ANALYSIS", tabId: currentTabId });
      analysis = refreshResponse?.analysis || null;
    }

    if (!analysis) {
      renderEmptyState("Open an Amazon product page", "ScanCart currently analyzes Amazon skincare and food products. Once you land on one, the side panel will populate automatically.");
      return;
    }

    currentAnalysis = analysis;
    currentCompare = null;
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

  if (action === "toggle-save") {
    const response = await chrome.runtime.sendMessage({ type: "SCANCART_TOGGLE_SAVE", tabId: currentTabId });
    if (response?.ok) {
      currentAnalysis = { ...currentAnalysis, saved: response.saved };
      renderAnalysis();
    }
    return;
  }

  if (action === "open-product" && currentAnalysis.product.url) {
    await chrome.tabs.update(currentTabId, { url: currentAnalysis.product.url });
    return;
  }

  if (action === "open-alt") {
    const alternative = currentAnalysis.alternatives[Number(button.dataset.altIndex)];
    if (alternative?.url) {
      await chrome.tabs.update(currentTabId, { url: alternative.url });
    }
    return;
  }

  if (action === "compare") {
    const alternative = currentAnalysis.alternatives[Number(button.dataset.altIndex)];
    if (!alternative) {
      return;
    }
    const response = await chrome.runtime.sendMessage({
      type: "SCANCART_BUILD_COMPARE",
      tabId: currentTabId,
      alternative
    });
    if (response?.ok) {
      currentCompare = {
        alternative,
        summary: response.summary
      };
      renderAnalysis();
    }
    return;
  }

  if (action === "close-compare") {
    currentCompare = null;
    renderAnalysis();
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
  chrome.tabs.onActivated.addListener(() => {
    loadAnalysis();
  });
}

if (chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId === currentTabId && changeInfo.status === "complete") {
      loadAnalysis();
    }
  });
}

window.addEventListener("focus", () => {
  loadAnalysis();
});

loadAnalysis();
