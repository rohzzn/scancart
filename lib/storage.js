export const PREFERENCE_DEFINITIONS = [
  { key: "fragranceFree", label: "Fragrance free", category: "skincare" },
  { key: "sensitiveSkin", label: "Sensitive skin safe", category: "skincare" },
  { key: "acneSafe", label: "Acne safe", category: "skincare" },
  { key: "vegan", label: "Vegan", category: "general" },
  { key: "crueltyFree", label: "Cruelty free", category: "general" },
  { key: "parabenFree", label: "Paraben free", category: "skincare" },
  { key: "lowSugar", label: "Low sugar", category: "food" },
  { key: "lowSodium", label: "Low sodium", category: "food" },
  { key: "highProtein", label: "Protein focused", category: "food" },
  { key: "dyeAvoidance", label: "Avoid dyes", category: "food" },
  { key: "sweetenerAvoidance", label: "Avoid sweeteners", category: "food" }
];

export const DEFAULT_SETTINGS = {
  geminiApiKey: "",
  geminiModel: "gemini-2.0-flash"
};

export const DEFAULT_PREFERENCES = PREFERENCE_DEFINITIONS.reduce((accumulator, item) => {
  accumulator[item.key] = false;
  return accumulator;
}, {});

const STORAGE_KEYS = {
  settings: "settings",
  preferences: "preferences",
  history: "history",
  savedProducts: "savedProducts",
  compareSnapshots: "compareSnapshots",
  lastActiveTabId: "lastActiveTabId",
  latestAnalyses: "latestAnalyses"
};

function readStorage(keys) {
  return chrome.storage.local.get(keys);
}

function writeStorage(values) {
  return chrome.storage.local.set(values);
}

export async function getSettings() {
  const result = await readStorage(STORAGE_KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
}

export async function saveSettings(nextSettings) {
  const settings = { ...DEFAULT_SETTINGS, ...nextSettings };
  await writeStorage({ [STORAGE_KEYS.settings]: settings });
  return settings;
}

export async function getPreferences() {
  const result = await readStorage(STORAGE_KEYS.preferences);
  return { ...DEFAULT_PREFERENCES, ...(result.preferences || {}) };
}

export async function savePreferences(nextPreferences) {
  const preferences = { ...DEFAULT_PREFERENCES, ...nextPreferences };
  await writeStorage({ [STORAGE_KEYS.preferences]: preferences });
  return preferences;
}

export async function getHistory() {
  const result = await readStorage(STORAGE_KEYS.history);
  return Array.isArray(result.history) ? result.history : [];
}

export async function saveHistory(history) {
  await writeStorage({ [STORAGE_KEYS.history]: history.slice(0, 50) });
}

export async function pushHistoryEntry(entry) {
  const history = await getHistory();
  const filtered = history.filter((item) => item.cacheKey !== entry.cacheKey);
  filtered.unshift(entry);
  await saveHistory(filtered);
  return filtered;
}

export async function getSavedProducts() {
  const result = await readStorage(STORAGE_KEYS.savedProducts);
  return Array.isArray(result.savedProducts) ? result.savedProducts : [];
}

export async function saveSavedProducts(savedProducts) {
  await writeStorage({ [STORAGE_KEYS.savedProducts]: savedProducts.slice(0, 100) });
}

export async function toggleSavedProduct(product) {
  const savedProducts = await getSavedProducts();
  const existingIndex = savedProducts.findIndex((item) => item.cacheKey === product.cacheKey);

  if (existingIndex >= 0) {
    savedProducts.splice(existingIndex, 1);
  } else {
    savedProducts.unshift({
      cacheKey: product.cacheKey,
      title: product.title,
      brand: product.brand,
      category: product.category,
      scoreLabel: product.scoreLabel,
      scoreValue: product.scoreValue,
      image: product.image,
      url: product.url,
      savedAt: new Date().toISOString()
    });
  }

  await saveSavedProducts(savedProducts);
  return savedProducts;
}

export async function clearHistoryAndSaved() {
  await writeStorage({
    [STORAGE_KEYS.history]: [],
    [STORAGE_KEYS.savedProducts]: [],
    [STORAGE_KEYS.compareSnapshots]: []
  });
}

export async function saveCompareSnapshot(snapshot) {
  const result = await readStorage(STORAGE_KEYS.compareSnapshots);
  const snapshots = Array.isArray(result.compareSnapshots) ? result.compareSnapshots : [];
  snapshots.unshift(snapshot);
  await writeStorage({ [STORAGE_KEYS.compareSnapshots]: snapshots.slice(0, 20) });
}

export async function setLastActiveTabId(tabId) {
  await writeStorage({ [STORAGE_KEYS.lastActiveTabId]: tabId });
}

export async function getLastActiveTabId() {
  const result = await readStorage(STORAGE_KEYS.lastActiveTabId);
  return typeof result.lastActiveTabId === "number" ? result.lastActiveTabId : null;
}

async function readSessionStorage(keys) {
  if (!chrome.storage.session) {
    return {};
  }
  return chrome.storage.session.get(keys);
}

async function writeSessionStorage(values) {
  if (!chrome.storage.session) {
    return;
  }
  await chrome.storage.session.set(values);
}

export async function getLatestAnalysis(tabId) {
  if (typeof tabId !== "number") {
    return null;
  }
  const result = await readSessionStorage(STORAGE_KEYS.latestAnalyses);
  const latestAnalyses = result.latestAnalyses || {};
  return latestAnalyses[String(tabId)] || null;
}

export async function saveLatestAnalysis(tabId, analysis) {
  if (typeof tabId !== "number") {
    return;
  }
  const result = await readSessionStorage(STORAGE_KEYS.latestAnalyses);
  const latestAnalyses = result.latestAnalyses || {};
  latestAnalyses[String(tabId)] = analysis;
  await writeSessionStorage({ [STORAGE_KEYS.latestAnalyses]: latestAnalyses });
}

export async function removeLatestAnalysis(tabId) {
  if (typeof tabId !== "number") {
    return;
  }
  const result = await readSessionStorage(STORAGE_KEYS.latestAnalyses);
  const latestAnalyses = result.latestAnalyses || {};
  delete latestAnalyses[String(tabId)];
  await writeSessionStorage({ [STORAGE_KEYS.latestAnalyses]: latestAnalyses });
}
