(function () {
  const QUICK_ACTION_ID = "scancart-quick-action";
  let lastSentSignature = "";
  let lastUrl = location.href;
  let analysisDebounce = null;

  function textOf(element) {
    return element ? element.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function queryFirst(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  function normalizeUrl(url) {
    try {
      return new URL(url, location.origin).toString();
    } catch (error) {
      return url;
    }
  }

  function isProductPage() {
    const urlMatch = /\/(dp|gp\/product)\//.test(location.pathname);
    const title = queryFirst(["#productTitle"]);
    return Boolean(urlMatch && title);
  }

  function parseStructuredProduct() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of scripts) {
      try {
        const parsed = JSON.parse(script.textContent);
        const nodes = Array.isArray(parsed) ? parsed : [parsed];
        for (const node of nodes) {
          const candidate = Array.isArray(node?.["@graph"]) ? node["@graph"].find((item) => String(item["@type"]).includes("Product")) : node;
          if (candidate && String(candidate["@type"]).includes("Product")) {
            return candidate;
          }
        }
      } catch (error) {
        // Skip invalid JSON-LD blocks.
      }
    }
    return null;
  }

  function extractDetailMap() {
    const detailMap = {};
    const rowSelectors = [
      "#productDetails_detailBullets_sections1 tr",
      "#productDetails_techSpec_section_1 tr",
      "#productDetails_db_sections tr",
      "#detailBullets_feature_div li"
    ];

    for (const selector of rowSelectors) {
      const rows = document.querySelectorAll(selector);
      rows.forEach((row) => {
        const header = textOf(row.querySelector("th")) || textOf(row.querySelector(".a-text-bold")) || textOf(row.querySelector("span.a-text-bold"));
        const value = textOf(row.querySelector("td")) || textOf(row.querySelector("span:nth-of-type(2)")) || textOf(row.querySelector("span:not(.a-text-bold)"));
        if (header && value) {
          detailMap[header.replace(/:$/, "")] = value;
        }
      });
    }

    return detailMap;
  }

  function collectBullets() {
    return Array.from(document.querySelectorAll("#feature-bullets li span"))
      .map(textOf)
      .filter((item) => item && item.length > 4 && !item.includes("Make sure"));
  }

  function findSectionTextByHeading(headingPattern) {
    const headingElements = Array.from(document.querySelectorAll("h1, h2, h3, h4, .a-text-bold"));
    for (const heading of headingElements) {
      const headingText = textOf(heading).toLowerCase();
      if (!headingPattern.test(headingText)) {
        continue;
      }

      let current = heading.parentElement;
      let attempts = 0;
      while (current && attempts < 4) {
        const text = textOf(current);
        if (text.length > headingText.length + 20) {
          return text;
        }
        current = current.parentElement;
        attempts += 1;
      }
    }
    return "";
  }

  function findIngredients(detailMap, bullets) {
    const detailKeys = Object.keys(detailMap);
    for (const key of detailKeys) {
      if (/ingredient/i.test(key)) {
        return detailMap[key];
      }
    }

    const bulletHit = bullets.find((bullet) => /^ingredients?\s*:/i.test(bullet));
    if (bulletHit) {
      return bulletHit.replace(/^ingredients?\s*:/i, "").trim();
    }

    const sectionText = findSectionTextByHeading(/ingredients|important information/);
    const inlineMatch = sectionText.match(/ingredients?\s*[:.-]\s*([\s\S]{20,500})/i);
    if (inlineMatch) {
      return inlineMatch[1]
        .split(/customer reviews|directions|legal disclaimer/i)[0]
        .trim();
    }

    return "";
  }

  function parseNutritionFromText(textBlob) {
    if (!textBlob) {
      return null;
    }

    const text = textBlob.replace(/\s+/g, " ");
    const map = {};
    const rules = [
      { key: "calories", pattern: /calories\s*(\d{1,4})/i },
      { key: "protein", pattern: /protein\s*(\d{1,3}(?:\.\d+)?)\s*g/i },
      { key: "fiber", pattern: /(dietary\s+fiber|fiber)\s*(\d{1,3}(?:\.\d+)?)\s*g/i, index: 2 },
      { key: "sugars", pattern: /(total\s+)?sugars?\s*(\d{1,3}(?:\.\d+)?)\s*g/i, index: 2 },
      { key: "addedSugars", pattern: /includes\s*(\d{1,3}(?:\.\d+)?)\s*g\s+added\s+sugars?/i },
      { key: "sodium", pattern: /sodium\s*(\d{1,4}(?:\.\d+)?)\s*(mg|g)/i }
    ];

    rules.forEach((rule) => {
      const match = text.match(rule.pattern);
      if (!match) {
        return;
      }
      const raw = Number(match[rule.index || 1]);
      if (Number.isNaN(raw)) {
        return;
      }
      map[rule.key] = rule.key === "sodium" && match[2] === "g" ? raw * 1000 : raw;
    });

    return Object.keys(map).length ? map : null;
  }

  function inferClaims(title, bullets, detailMap) {
    const sourceText = [title, ...bullets, ...Object.values(detailMap)].join(" ").toLowerCase();
    const claimRules = [
      ["fragrance free", /fragrance[-\s]?free|unscented/],
      ["vegan", /\bvegan\b/],
      ["cruelty free", /cruelty[-\s]?free|not tested on animals/],
      ["paraben free", /paraben[-\s]?free/],
      ["sensitive skin", /sensitive skin|gentle/],
      ["high protein", /high protein|\d+\s*g protein/],
      ["low sugar", /low sugar|no added sugar|0g sugar/]
    ];

    return claimRules
      .filter(([, pattern]) => pattern.test(sourceText))
      .map(([claim]) => claim);
  }

  function inferCategory({ title, breadcrumbs, bullets, ingredients, nutrition }) {
    const sourceText = [title, ...(breadcrumbs || []), ...(bullets || []), ingredients || ""].join(" ").toLowerCase();
    const skincareWords = ["serum", "moisturizer", "cleanser", "cream", "lotion", "skincare", "toner", "sunscreen", "face wash", "mask"];
    const foodWords = ["snack", "protein", "bar", "drink", "cereal", "chips", "food", "granola", "cookie", "beverage", "nutrition"];

    if (nutrition && Object.keys(nutrition).length) {
      return "food";
    }
    if (skincareWords.some((word) => sourceText.includes(word))) {
      return "skincare";
    }
    if (foodWords.some((word) => sourceText.includes(word))) {
      return "food";
    }
    return "unknown";
  }

  function extractRelatedProducts() {
    const items = [];
    const seen = new Set();
    const links = Array.from(document.querySelectorAll('a[href*="/dp/"]'));

    for (const link of links) {
      const url = normalizeUrl(link.href);
      if (url === location.href || seen.has(url)) {
        continue;
      }

      const title = textOf(link.querySelector("img")) || textOf(link.querySelector("span")) || link.getAttribute("aria-label") || "";
      const price = textOf(link.closest("[data-asin]")?.querySelector(".a-price .a-offscreen")) || textOf(link.parentElement?.querySelector(".a-price .a-offscreen"));
      const image = link.querySelector("img")?.src || "";

      if (title.length < 10) {
        continue;
      }

      seen.add(url);
      items.push({
        title,
        url,
        price,
        image
      });

      if (items.length >= 12) {
        break;
      }
    }

    return items;
  }

  function extractProductData() {
    if (!isProductPage()) {
      return null;
    }

    const title = textOf(queryFirst(["#productTitle"]));
    const brandRaw = textOf(queryFirst(["#bylineInfo", "#brand"]));
    const brand = brandRaw.replace(/^Visit the\s+/i, "").replace(/\s+Store$/i, "").trim();
    const price = textOf(queryFirst([
      "#corePrice_feature_div .a-offscreen",
      "#corePriceDisplay_desktop_feature_div .a-offscreen",
      ".a-price.a-text-price .a-offscreen",
      "#price_inside_buybox"
    ]));
    const ratingText = textOf(queryFirst(["#acrPopover", "[data-hook='rating-out-of-text']"]));
    const reviewText = textOf(queryFirst(["#acrCustomerReviewText"]));
    const image = queryFirst(["#landingImage", "#imgTagWrapperId img", "#main-image-container img"])?.src || "";
    const breadcrumbs = Array.from(document.querySelectorAll("#wayfinding-breadcrumbs_feature_div li a"))
      .map(textOf)
      .filter(Boolean);
    const detailMap = extractDetailMap();
    const bullets = collectBullets();
    const ingredients = findIngredients(detailMap, bullets);
    const nutrition = parseNutritionFromText([
      Object.entries(detailMap).map(([key, value]) => `${key}: ${value}`).join(" "),
      ...bullets,
      findSectionTextByHeading(/nutrition/)
    ].join(" "));
    const structuredProduct = parseStructuredProduct();
    const claims = inferClaims(title, bullets, detailMap);
    const category = inferCategory({ title, breadcrumbs, bullets, ingredients, nutrition });
    const barcodeMatch = JSON.stringify(detailMap).match(/\b\d{8,14}\b/);
    const asinMatch = location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    const variation = textOf(queryFirst(["#variation_size_name .selection", "#variation_style_name .selection", "#variation_color_name .selection"]));

    return {
      retailer: "amazon",
      url: location.href,
      asin: asinMatch ? asinMatch[1] : "",
      title,
      brand,
      price,
      rating: ratingText,
      reviewCount: reviewText,
      image,
      breadcrumbs,
      bullets,
      detailMap,
      ingredients,
      nutrition,
      claims,
      category,
      barcode: barcodeMatch ? barcodeMatch[0] : "",
      variation,
      structuredProduct,
      relatedProducts: extractRelatedProducts(),
      extractedAt: new Date().toISOString()
    };
  }

  function ensureQuickAction() {
    if (!isProductPage()) {
      const existing = document.getElementById(QUICK_ACTION_ID);
      if (existing) {
        existing.remove();
      }
      return;
    }

    if (document.getElementById(QUICK_ACTION_ID)) {
      return;
    }

    const button = document.createElement("button");
    button.id = QUICK_ACTION_ID;
    button.type = "button";
    button.textContent = "Scan";
    button.style.cssText = [
      "position: fixed",
      "right: 18px",
      "bottom: 20px",
      "z-index: 2147483647",
      "padding: 12px 16px",
      "border-radius: 999px",
      "border: none",
      "background: linear-gradient(135deg, #083d4a, #0e6c74)",
      "color: white",
      "font: 700 14px/1 Aptos, 'Segoe UI Variable Text', 'Segoe UI', sans-serif",
      "letter-spacing: 0.04em",
      "box-shadow: 0 18px 34px rgba(14, 108, 116, 0.28)",
      "cursor: pointer"
    ].join(";");
    button.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "SCANCART_OPEN_PANEL" });
    });
    document.documentElement.appendChild(button);
  }

  function sendAnalysis() {
    const payload = extractProductData();
    if (!payload) {
      return Promise.resolve(null);
    }

    const signature = JSON.stringify({
      title: payload.title,
      price: payload.price,
      variation: payload.variation,
      ingredients: payload.ingredients,
      category: payload.category
    });

    if (signature === lastSentSignature) {
      return Promise.resolve(payload);
    }

    lastSentSignature = signature;
    return chrome.runtime.sendMessage({
      type: "SCANCART_ANALYZE_PAGE",
      payload
    }).then(() => payload).catch(() => payload);
  }

  function scheduleAnalysis() {
    clearTimeout(analysisDebounce);
    analysisDebounce = setTimeout(() => {
      ensureQuickAction();
      sendAnalysis();
    }, 900);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SCANCART_FORCE_EXTRACT") {
      const payload = extractProductData();
      sendResponse(payload);
    }
  });

  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSentSignature = "";
    }
    scheduleAnalysis();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureQuickAction();
      sendAnalysis();
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }, { once: true });
  } else {
    ensureQuickAction();
    sendAnalysis();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
