import {
  PREFERENCE_DEFINITIONS,
  clearHistoryAndSaved,
  getPreferences,
  getSettings,
  savePreferences,
  saveSettings
} from "./lib/storage.js";

const apiKeyInput = document.getElementById("gemini-api-key");
const modelInput = document.getElementById("gemini-model");
const preferencesGrid = document.getElementById("preferences-grid");
const saveButton = document.getElementById("save-settings-button");
const clearButton = document.getElementById("clear-history-button");
const saveStatus = document.getElementById("save-status");

function renderPreferences(preferences) {
  preferencesGrid.innerHTML = PREFERENCE_DEFINITIONS.map((item) => `
    <label class="pref-tile">
      <input type="checkbox" data-pref-key="${item.key}" ${preferences[item.key] ? "checked" : ""}>
      <span>${item.label}</span>
    </label>
  `).join("");
}

async function loadState() {
  const [settings, preferences] = await Promise.all([getSettings(), getPreferences()]);
  apiKeyInput.value = settings.geminiApiKey || "";
  modelInput.value = settings.geminiModel || "gemini-2.0-flash";
  renderPreferences(preferences);
}

saveButton.addEventListener("click", async () => {
  const nextPreferences = {};
  preferencesGrid.querySelectorAll("input[data-pref-key]").forEach((input) => {
    nextPreferences[input.dataset.prefKey] = input.checked;
  });

  await Promise.all([
    saveSettings({
      geminiApiKey: apiKeyInput.value.trim(),
      geminiModel: modelInput.value.trim() || "gemini-2.0-flash"
    }),
    savePreferences(nextPreferences)
  ]);

  saveStatus.textContent = "Settings saved locally.";
  setTimeout(() => {
    saveStatus.textContent = "";
  }, 2200);
});

clearButton.addEventListener("click", async () => {
  await clearHistoryAndSaved();
  saveStatus.textContent = "History and saved products cleared.";
  setTimeout(() => {
    saveStatus.textContent = "";
  }, 2200);
});

loadState();
