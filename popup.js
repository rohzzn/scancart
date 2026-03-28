import { PREFERENCE_DEFINITIONS } from "./lib/storage.js";
import { confidenceLabel, escapeHtml } from "./lib/ui.js";

const openPanelButton = document.getElementById("open-panel-button");
const settingsButton = document.getElementById("settings-button");
const refreshButton = document.getElementById("refresh-button");
const currentSummary = document.getElementById("current-summary");
const recentList = document.getElementById("recent-list");
const quickPreferences = document.getElementById("quick-preferences");

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

function renderPreferences(preferences) {
  const activePreferences = PREFERENCE_DEFINITIONS
    .filter((item) => preferences[item.key])
    .slice(0, 6);

  quickPreferences.innerHTML = activePreferences.length
    ? activePreferences.map((item) => `<span class="chip">${escapeHtml(item.label)}</span>`).join("")
    : '<span class="state-line">No quick preferences enabled yet.</span>';
}

function renderCurrentSummary(analysis) {
  if (!analysis) {
    currentSummary.innerHTML = '<div class="state-line">Open a supported product page to start.</div>';
    return;
  }

  currentSummary.innerHTML = `
    <div class="recent-item">
      <strong>${escapeHtml(analysis.product.title)}</strong>
      <div class="muted">${escapeHtml(analysis.product.brand || "Brand unavailable")}</div>
      <div class="muted">${analysis.score.value} - ${escapeHtml(analysis.score.label)} - ${escapeHtml(confidenceLabel(analysis.confidence.overall))}</div>
      <div class="muted">${escapeHtml(analysis.explanations.shortExplanation)}</div>
    </div>
  `;
}

function renderRecent(history) {
  if (!history.length) {
    recentList.innerHTML = '<div class="state-line">No products analyzed yet.</div>';
    return;
  }

  recentList.innerHTML = history.map((item) => `
    <div class="recent-item">
      <strong>${escapeHtml(item.title)}</strong>
      <div class="muted">${escapeHtml(item.brand || "Brand unavailable")}</div>
      <div class="muted">${item.scoreValue} - ${escapeHtml(item.scoreLabel)}</div>
    </div>
  `).join("");
}

async function refreshPopup() {
  const response = await chrome.runtime.sendMessage({ type: "SCANCART_GET_POPUP_DATA" });
  if (!response?.ok) {
    currentSummary.textContent = "ScanCart could not load the current page state.";
    return;
  }

  renderCurrentSummary(response.analysis);
  renderRecent(response.history || []);
  renderPreferences(response.preferences || {});
}

openPanelButton.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id) {
    await chrome.runtime.sendMessage({ type: "SCANCART_OPEN_PANEL", tabId: tab.id });
    window.close();
  }
});

settingsButton.addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
});

refreshButton.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (tab?.id) {
    await chrome.runtime.sendMessage({ type: "SCANCART_REFRESH_ANALYSIS", tabId: tab.id });
    await refreshPopup();
  }
});

refreshPopup();
