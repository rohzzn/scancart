(async function () {
  const QUICK_ACTION_ID = "scancart-quick-action";
  const routerPromise = import(chrome.runtime.getURL("extractors/router.js"));
  let lastSentSignature = "";
  let lastUrl = location.href;
  let analysisDebounce = null;

  function makeSignature(payload) {
    return JSON.stringify({
      retailer: payload.retailer,
      title: payload.title,
      brand: payload.brand,
      price: payload.price,
      ingredientsText: payload.ingredientsText,
      nutritionText: payload.nutritionText,
      barcode: payload.barcode,
      canonicalUrl: payload.canonicalUrl
    });
  }

  async function getExtraction() {
    const router = await routerPromise;
    return router.extractCurrentPage();
  }

  async function ensureQuickAction() {
    const payload = await getExtraction();
    const existing = document.getElementById(QUICK_ACTION_ID);

    if (!payload) {
      if (existing) {
        existing.remove();
      }
      return;
    }

    if (existing) {
      return;
    }

    const button = document.createElement("button");
    button.id = QUICK_ACTION_ID;
    button.type = "button";
    button.textContent = "ScanCart";
    button.style.cssText = [
      "position: fixed",
      "right: 18px",
      "bottom: 20px",
      "z-index: 2147483647",
      "padding: 12px 18px",
      "border-radius: 999px",
      "border: 0",
      "background: linear-gradient(135deg, #0a4857, #0f747d)",
      "color: white",
      "font: 700 14px/1 Aptos, 'Segoe UI Variable Text', 'Segoe UI', sans-serif",
      "letter-spacing: 0.02em",
      "box-shadow: 0 18px 34px rgba(15, 116, 125, 0.26)",
      "cursor: pointer"
    ].join(";");
    button.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "SCANCART_OPEN_PANEL" });
    });
    document.documentElement.appendChild(button);
  }

  async function sendAnalysis() {
    const payload = await getExtraction();
    if (!payload) {
      return null;
    }

    const signature = makeSignature(payload);
    if (signature === lastSentSignature) {
      return payload;
    }

    lastSentSignature = signature;
    try {
      await chrome.runtime.sendMessage({
        type: "SCANCART_ANALYZE_PAGE",
        payload
      });
    } catch (error) {
      // Ignore background handoff failures so the page script keeps running.
    }
    return payload;
  }

  function scheduleAnalysis() {
    clearTimeout(analysisDebounce);
    analysisDebounce = setTimeout(async () => {
      await ensureQuickAction();
      await sendAnalysis();
    }, 850);
  }

  function handleUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSentSignature = "";
      scheduleAnalysis();
    }
  }

  const observer = new MutationObserver(() => {
    handleUrlChange();
    scheduleAnalysis();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SCANCART_FORCE_EXTRACT") {
      getExtraction().then((payload) => sendResponse(payload));
      return true;
    }
    return false;
  });

  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    handleUrlChange();
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    handleUrlChange();
  };

  window.addEventListener("popstate", handleUrlChange);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      scheduleAnalysis();
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }, { once: true });
  } else {
    scheduleAnalysis();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
