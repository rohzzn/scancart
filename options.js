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
const usdaKeyInput = document.getElementById("usda-api-key");
const offBaseUrlInput = document.getElementById("open-food-facts-base-url");
const obfBaseUrlInput = document.getElementById("open-beauty-facts-base-url");
const usdaBaseUrlInput = document.getElementById("usda-api-base-url");
const dsldBaseUrlInput = document.getElementById("nih-dsld-api-base-url");
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
  usdaKeyInput.value = settings.usdaApiKey || "";
  offBaseUrlInput.value = settings.openFoodFactsBaseUrl || "";
  obfBaseUrlInput.value = settings.openBeautyFactsBaseUrl || "";
  usdaBaseUrlInput.value = settings.usdaApiBaseUrl || "";
  dsldBaseUrlInput.value = settings.nihDsldApiBaseUrl || "";
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
      geminiModel: modelInput.value.trim() || "gemini-2.0-flash",
      usdaApiKey: usdaKeyInput.value.trim(),
      openFoodFactsBaseUrl: offBaseUrlInput.value.trim(),
      openBeautyFactsBaseUrl: obfBaseUrlInput.value.trim(),
      usdaApiBaseUrl: usdaBaseUrlInput.value.trim(),
      nihDsldApiBaseUrl: dsldBaseUrlInput.value.trim()
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
