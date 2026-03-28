import { buildAnalysisResult } from "./lib/analysis.js";
import { askGeminiQuestion, generateAnalysisExplanation, generateComparisonExplanation } from "./lib/gemini.js";
import {
  getLatestAnalysis,
  getHistory,
  getLastActiveTabId,
  getPreferences,
  getSavedProducts,
  getSettings,
  pushHistoryEntry,
  removeLatestAnalysis,
  saveCompareSnapshot,
  saveLatestAnalysis,
  setLastActiveTabId,
  toggleSavedProduct
} from "./lib/storage.js";

const analysisByTab = new Map();
const inflightAnalyses = new Map();

async function configureSidePanelBehavior() {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return;
  }

  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    // Ignore unsupported behavior configuration and fall back to explicit open calls.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  configureSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  configureSidePanelBehavior();
});

if (chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    if (!tab?.id) {
      return;
    }

    await setLastActiveTabId(tab.id);
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      // If Chrome already handled the click via setPanelBehavior, there is nothing else to do.
    }
  });
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await setLastActiveTabId(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  analysisByTab.delete(tabId);
  removeLatestAnalysis(tabId);
  for (const key of inflightAnalyses.keys()) {
    if (key.startsWith(`${tabId}:`)) {
      inflightAnalyses.delete(key);
    }
  }
});

function buildHistoryEntry(analysis) {
  return {
    cacheKey: analysis.cacheKey,
    title: analysis.product.title,
    brand: analysis.product.brand,
    category: analysis.product.category,
    subcategory: analysis.product.subcategory,
    scoreValue: analysis.score.value,
    scoreLabel: analysis.score.label,
    scoreTone: analysis.score.tone,
    image: analysis.product.image,
    url: analysis.product.url,
    summary: analysis.explanations.shortExplanation,
    confidenceOverall: analysis.confidence.overall,
    price: analysis.product.price,
    retailer: analysis.product.retailerLabel,
    viewedAt: new Date().toISOString()
  };
}

async function decorateSavedStatus(analysis) {
  const savedProducts = await getSavedProducts();
  return {
    ...analysis,
    saved: savedProducts.some((item) => item.cacheKey === analysis.cacheKey)
  };
}

async function analyzeExtraction(tabId, extraction) {
  const inflightKey = `${tabId}:${extraction.canonicalUrl || extraction.url}`;
  if (inflightAnalyses.has(inflightKey)) {
    return inflightAnalyses.get(inflightKey);
  }

  const promise = (async () => {
    const [preferences, history, settings] = await Promise.all([
      getPreferences(),
      getHistory(),
      getSettings()
    ]);

    const analysis = await buildAnalysisResult(extraction, preferences, history, settings);
    const explanations = await generateAnalysisExplanation(analysis, settings);
    const completed = await decorateSavedStatus({ ...analysis, explanations });

    analysisByTab.set(tabId, completed);
    await saveLatestAnalysis(tabId, completed);
    await pushHistoryEntry(buildHistoryEntry(completed));
    return completed;
  })().finally(() => inflightAnalyses.delete(inflightKey));

  inflightAnalyses.set(inflightKey, promise);
  return promise;
}

async function getAnalysisForTab(tabId) {
  if (typeof tabId === "number" && analysisByTab.has(tabId)) {
    return decorateSavedStatus(analysisByTab.get(tabId));
  }
  if (typeof tabId === "number") {
    const persisted = await getLatestAnalysis(tabId);
    if (persisted) {
      analysisByTab.set(tabId, persisted);
      return decorateSavedStatus(persisted);
    }
  }
  return null;
}

async function withActiveTab(callback) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) {
    return null;
  }
  await setLastActiveTabId(tab.id);
  return callback(tab);
}

async function requestFreshExtraction(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "SCANCART_FORCE_EXTRACT" });
  } catch (error) {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "SCANCART_ANALYZE_PAGE": {
        const tabId = sender.tab?.id;
        if (typeof tabId !== "number") {
          sendResponse({ ok: false, error: "Missing tab context." });
          return;
        }

        await setLastActiveTabId(tabId);
        const analysis = await analyzeExtraction(tabId, message.payload);
        sendResponse({ ok: true, analysis });
        return;
      }

      case "SCANCART_GET_ANALYSIS": {
        if (typeof message.tabId === "number") {
          sendResponse({ ok: true, analysis: await getAnalysisForTab(message.tabId) });
          return;
        }
        const fallbackTabId = await getLastActiveTabId();
        sendResponse({ ok: true, analysis: await getAnalysisForTab(fallbackTabId) });
        return;
      }

      case "SCANCART_OPEN_PANEL": {
        const tabId = message.tabId ?? sender.tab?.id;
        if (typeof tabId !== "number") {
          sendResponse({ ok: false });
          return;
        }
        await setLastActiveTabId(tabId);
        await chrome.sidePanel.open({ tabId });
        sendResponse({ ok: true });
        return;
      }

      case "SCANCART_REFRESH_ANALYSIS": {
        const tabId = message.tabId ?? (await getLastActiveTabId());
        if (typeof tabId !== "number") {
          sendResponse({ ok: false, error: "No active tab found." });
          return;
        }
        const extraction = await requestFreshExtraction(tabId);
        if (!extraction) {
          sendResponse({ ok: false, error: "Could not refresh extraction from the page." });
          return;
        }
        const analysis = await analyzeExtraction(tabId, extraction);
        sendResponse({ ok: true, analysis });
        return;
      }

      case "SCANCART_TOGGLE_SAVE": {
        const resolvedTabId = message.tabId ?? (await getLastActiveTabId());
        const analysis = typeof resolvedTabId === "number" ? analysisByTab.get(resolvedTabId) : null;
        if (!analysis) {
          sendResponse({ ok: false, error: "No analyzed product available to save." });
          return;
        }

        const savedProducts = await toggleSavedProduct(analysis);
        const saved = savedProducts.some((item) => item.cacheKey === analysis.cacheKey);
        const updated = { ...analysis, saved };
        analysisByTab.set(resolvedTabId, updated);
        await saveLatestAnalysis(resolvedTabId, updated);
        sendResponse({ ok: true, saved });
        return;
      }

      case "SCANCART_GET_POPUP_DATA": {
        const result = await withActiveTab(async (tab) => {
          const [analysis, history, preferences] = await Promise.all([
            getAnalysisForTab(tab.id),
            getHistory(),
            getPreferences()
          ]);
          return {
            ok: true,
            analysis,
            history: history.slice(0, 5),
            preferences
          };
        });
        sendResponse(result || { ok: true, analysis: null, history: [], preferences: {} });
        return;
      }

      case "SCANCART_GET_SETTINGS_STATE": {
        const [settings, preferences] = await Promise.all([getSettings(), getPreferences()]);
        sendResponse({ ok: true, settings, preferences });
        return;
      }

      case "SCANCART_ASK_ASSISTANT": {
        const tabId = message.tabId ?? (await getLastActiveTabId());
        const analysis = analysisByTab.get(tabId);
        if (!analysis) {
          sendResponse({ ok: false, error: "Analyze a product first." });
          return;
        }

        const answer = await askGeminiQuestion(message.question, analysis, await getSettings(), message.compareTarget || null);
        sendResponse({ ok: true, ...answer });
        return;
      }

      case "SCANCART_BUILD_COMPARE": {
        const tabId = message.tabId ?? (await getLastActiveTabId());
        const analysis = analysisByTab.get(tabId);
        if (!analysis || !message.alternative) {
          sendResponse({ ok: false, error: "Comparison data is unavailable." });
          return;
        }

        const comparison = await generateComparisonExplanation(analysis, message.alternative, await getSettings());
        await saveCompareSnapshot({
          createdAt: new Date().toISOString(),
          current: {
            title: analysis.product.title,
            scoreValue: analysis.score.value,
            scoreLabel: analysis.score.label,
            url: analysis.product.url
          },
          alternative: message.alternative,
          summary: comparison.summary
        });

        sendResponse({ ok: true, summary: comparison.summary });
        return;
      }

      default:
        sendResponse({ ok: false, error: "Unknown message type." });
    }
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message || "Unexpected error." });
  });

  return true;
});
