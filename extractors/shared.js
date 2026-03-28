const DEFAULT_CLAIM_RULES = [
  ["fragrance free", /fragrance[-\s]?free|unscented/i],
  ["vegan", /\bvegan\b/i],
  ["cruelty free", /cruelty[-\s]?free|not tested on animals/i],
  ["paraben free", /paraben[-\s]?free/i],
  ["sulfate free", /sulfate[-\s]?free|sls[-\s]?free/i],
  ["sensitive skin", /sensitive skin|gentle/i],
  ["high protein", /(high protein|\b\d+\s*g protein\b)/i],
  ["low sugar", /low sugar|no added sugar|0g sugar/i],
  ["low sodium", /low sodium|reduced sodium/i],
  ["non comedogenic", /non[-\s]?comedogenic/i],
  ["hypoallergenic", /hypoallergenic/i],
  ["clean at sephora", /clean at sephora/i],
  ["safer choice", /epa safer choice|safer choice/i],
  ["plant based", /plant[-\s]?based/i]
];

const DEFAULT_SECTION_STOP_PATTERN = /customer reviews|legal disclaimer|important information|shipping|returns|directions|how to use|details|description/i;
const DEFAULT_BARCODE_PATTERN = /\b\d{8,14}\b/g;

export function normalizeText(value) {
  return String(value || "")
    .replace(/[\u2122\u00AE]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function unique(values) {
  return [...new Set((values || []).map((value) => normalizeText(value)).filter(Boolean))];
}

export function textOf(element) {
  return normalizeText(element?.textContent || "");
}

export function queryFirst(selectors, root = document) {
  for (const selector of selectors || []) {
    const node = root.querySelector(selector);
    if (node) {
      return node;
    }
  }
  return null;
}

export function queryAll(selectors, root = document) {
  const items = [];
  for (const selector of selectors || []) {
    root.querySelectorAll(selector).forEach((node) => items.push(node));
  }
  return items;
}

export function attrOf(selectors, attribute, root = document) {
  const element = queryFirst(selectors, root);
  return normalizeText(element?.getAttribute(attribute) || "");
}

export function normalizeUrl(url, fallbackBase = location.origin) {
  try {
    return new URL(url, fallbackBase).toString();
  } catch (error) {
    return String(url || "");
  }
}

export function toNumber(value) {
  if (value == null || value === "") {
    return null;
  }
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function parsePrice(priceText, fallbackCurrency = "USD") {
  const display = normalizeText(priceText);
  if (!display) {
    return { display: "", amount: null, currency: fallbackCurrency };
  }

  const amount = toNumber(display);
  let currency = fallbackCurrency;
  if (/\bUSD\b|\$/i.test(display)) {
    currency = "USD";
  }
  if (/\bEUR\b|€/i.test(display)) {
    currency = "EUR";
  }
  if (/\bGBP\b|£/i.test(display)) {
    currency = "GBP";
  }

  return { display, amount, currency };
}

export function findCanonicalUrl() {
  const element = queryFirst(['link[rel="canonical"]']);
  return element?.href ? normalizeUrl(element.href) : location.href;
}

export function parseJsonLd() {
  const blocks = [];
  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    const raw = script.textContent || "";
    if (!raw.trim()) {
      continue;
    }
    try {
      blocks.push(JSON.parse(raw));
    } catch (error) {
      // Ignore invalid JSON-LD blobs.
    }
  }
  return blocks;
}

function flattenJsonLdNodes(input) {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenJsonLdNodes(item));
  }
  if (Array.isArray(input["@graph"])) {
    return input["@graph"].flatMap((item) => flattenJsonLdNodes(item));
  }
  return [input];
}

export function findStructuredProduct(blocks = parseJsonLd()) {
  const nodes = flattenJsonLdNodes(blocks);
  return nodes.find((node) => String(node?.["@type"] || "").toLowerCase().includes("product")) || null;
}

export function findStructuredBreadcrumbs(blocks = parseJsonLd()) {
  const nodes = flattenJsonLdNodes(blocks);
  const breadcrumbNode = nodes.find((node) => String(node?.["@type"] || "").toLowerCase().includes("breadcrumblist"));
  return Array.isArray(breadcrumbNode?.itemListElement)
    ? breadcrumbNode.itemListElement.map((item) => normalizeText(item?.name || item?.item?.name || "")).filter(Boolean)
    : [];
}

function collectRowText(row, selectors) {
  for (const selector of selectors || []) {
    const value = textOf(row.querySelector(selector));
    if (value) {
      return value;
    }
  }
  return "";
}

export function extractDetailEntries(options = {}) {
  const detailEntries = [];
  const rows = queryAll(options.rowSelectors || []);
  const keySelectors = options.keySelectors || ["th", ".label", ".product-data-label", ".a-text-bold", "strong", "dt"];
  const valueSelectors = options.valueSelectors || ["td", ".value", ".product-data-value", "dd", "span:not(.a-text-bold)"];

  rows.forEach((row) => {
    const key = collectRowText(row, keySelectors).replace(/:$/, "");
    const value = collectRowText(row, valueSelectors);
    if (key && value) {
      detailEntries.push({ key, value });
    }
  });

  return detailEntries;
}

export function extractBreadcrumbs(selectors) {
  return unique(queryAll(selectors).map((node) => textOf(node)).filter(Boolean));
}

export function findSectionTextByHeading(patterns, maxDepth = 5) {
  const headingNodes = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, strong, summary, legend"));
  for (const heading of headingNodes) {
    const headingText = textOf(heading).toLowerCase();
    if (!(patterns || []).some((pattern) => pattern.test(headingText))) {
      continue;
    }

    let current = heading.parentElement;
    let depth = 0;
    while (current && depth < maxDepth) {
      const blob = normalizeText(current.textContent || "");
      if (blob.length > headingText.length + 24) {
        return blob.split(DEFAULT_SECTION_STOP_PATTERN)[0].trim();
      }
      current = current.parentElement;
      depth += 1;
    }
  }
  return "";
}

export function findStructuredValue(structuredProduct, paths) {
  if (!structuredProduct) {
    return "";
  }

  for (const path of paths || []) {
    const parts = path.split(".");
    let current = structuredProduct;
    for (const part of parts) {
      current = Array.isArray(current) ? current[0] : current?.[part];
      if (current == null) {
        break;
      }
    }
    const normalized = Array.isArray(current) ? normalizeText(current[0]) : normalizeText(current);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function findEntryValue(detailEntries, patterns) {
  for (const entry of detailEntries || []) {
    if ((patterns || []).some((pattern) => pattern.test(entry.key.toLowerCase()))) {
      return entry.value;
    }
  }
  return "";
}

export function extractIngredientsText(options = {}) {
  const direct = normalizeText(textOf(queryFirst(options.selectors || [])) || attrOf(options.attributeSelectors || [], options.attributeName || "content"));
  if (direct) {
    return direct;
  }

  const fromDetails = normalizeText(findEntryValue(options.detailEntries || [], [/ingredient/i, /composition/i, /material/i]));
  if (fromDetails) {
    return fromDetails;
  }

  const section = findSectionTextByHeading(options.headingPatterns || [/ingredient/i, /composition/i, /material/i]);
  if (!section) {
    return "";
  }

  const match = section.match(/ingredients?\s*[:.-]\s*([\s\S]{12,900})/i);
  return normalizeText(match ? match[1] : section);
}

export function extractNutritionText(options = {}) {
  const direct = normalizeText(textOf(queryFirst(options.selectors || [])) || attrOf(options.attributeSelectors || [], options.attributeName || "content"));
  if (direct) {
    return direct;
  }

  const fromDetails = normalizeText(findEntryValue(options.detailEntries || [], [/nutrition/i, /supplement facts/i, /serving size/i, /protein/i, /calories/i]));
  if (fromDetails) {
    return fromDetails;
  }

  return normalizeText(findSectionTextByHeading(options.headingPatterns || [/nutrition/i, /supplement facts/i, /nutrition facts/i]));
}

export function extractClaims(options = {}) {
  const joinedText = [
    ...(options.explicitClaims || []),
    ...(options.extraText || []),
    ...(options.detailEntries || []).map((entry) => `${entry.key} ${entry.value}`)
  ].join(" ");

  const claims = [];
  for (const [label, pattern] of DEFAULT_CLAIM_RULES) {
    if (pattern.test(joinedText)) {
      claims.push(label);
    }
  }

  return unique([...(options.explicitClaims || []), ...claims]);
}

export function findBarcodeFromText(textBlob) {
  const matches = String(textBlob || "").match(DEFAULT_BARCODE_PATTERN);
  return matches ? matches[0] : "";
}

export function extractBarcode(options = {}) {
  const selectorText = normalizeText(textOf(queryFirst(options.selectors || [])) || attrOf(options.attributeSelectors || [], options.attributeName || "content"));
  if (selectorText) {
    const direct = findBarcodeFromText(selectorText);
    if (direct) {
      return direct;
    }
  }

  const fromDetails = findEntryValue(options.detailEntries || [], [/upc/i, /gtin/i, /ean/i, /barcode/i]);
  const detailMatch = findBarcodeFromText(fromDetails);
  if (detailMatch) {
    return detailMatch;
  }

  const structuredValues = [
    options.structuredProduct?.gtin13,
    options.structuredProduct?.gtin14,
    options.structuredProduct?.gtin12,
    options.structuredProduct?.gtin8,
    options.structuredProduct?.mpn,
    options.structuredProduct?.sku
  ].map((value) => normalizeText(value));

  for (const value of structuredValues) {
    const match = findBarcodeFromText(value);
    if (match) {
      return match;
    }
  }

  return findBarcodeFromText((options.rawTexts || []).join(" "));
}

export function extractRelatedProducts(options = {}) {
  const cards = options.cardSelectors?.length
    ? queryAll(options.cardSelectors)
    : Array.from(document.querySelectorAll('a[href]')).map((anchor) => anchor.closest("article, li, div") || anchor);
  const seen = new Set();
  const items = [];

  for (const card of cards) {
    const link = queryFirst(options.linkSelectors || ['a[href]'], card) || card.closest("a[href]");
    const url = normalizeUrl(link?.href || "");
    if (!url || url === location.href || seen.has(url)) {
      continue;
    }

    const title = normalizeText(
      textOf(queryFirst(options.titleSelectors || ["[title]", "h2", "h3", "h4", "span", "img"], card)) ||
      attrOf(["img"], "alt", card) ||
      link?.getAttribute("aria-label") ||
      link?.title ||
      ""
    );
    if (title.length < 5) {
      continue;
    }

    const price = normalizeText(textOf(queryFirst(options.priceSelectors || ["[data-testid*='price']", ".price", "[class*='price']"], card)));
    const image = normalizeUrl(attrOf(options.imageSelectors || ["img"], "src", card) || attrOf(options.imageSelectors || ["img"], "data-src", card));
    const rating = toNumber(textOf(queryFirst(options.ratingSelectors || ["[aria-label*='out of 5']", "[class*='rating']"], card)));

    seen.add(url);
    items.push({ title, price, image, url, rating });

    if (items.length >= (options.limit || 12)) {
      break;
    }
  }

  return items;
}

function defaultIsProductPage(config, structuredProduct) {
  const pathname = location.pathname.toLowerCase();
  const blocked = ["/search", "/cart", "/checkout", "/account"];
  if (blocked.some((token) => pathname === token || pathname.startsWith(`${token}/`))) {
    return false;
  }

  if ((config.pathPatterns || []).some((pattern) => pattern.test(pathname))) {
    return true;
  }

  const titleExists = Boolean(queryFirst(config.selectors?.title || []));
  const priceExists = Boolean(queryFirst(config.selectors?.price || []));
  if (titleExists && priceExists) {
    return true;
  }

  return Boolean(structuredProduct && String(structuredProduct["@type"] || "").toLowerCase().includes("product"));
}

function buildRelatedConfig(selectors = {}) {
  return {
    cardSelectors: selectors.relatedCards || selectors.relatedProducts || [],
    titleSelectors: selectors.relatedTitle || ["h2", "h3", "h4", "span"],
    priceSelectors: selectors.relatedPrice || ["[data-testid*='price']", ".price", "[class*='price']"],
    imageSelectors: selectors.relatedImage || ["img"],
    linkSelectors: selectors.relatedLink || ['a[href]'],
    ratingSelectors: selectors.relatedRating || ["[aria-label*='out of 5']", "[class*='rating']"]
  };
}

export function createRetailerExtractor(config) {
  return {
    retailer: config.retailer,
    retailerLabel: config.retailerLabel || normalizeText(config.retailer),
    matches(hostname = location.hostname) {
      return (config.hostnames || []).some((host) => hostname === host || hostname.endsWith(`.${host}`));
    },
    isProductPage() {
      const structuredProduct = findStructuredProduct(parseJsonLd());
      return typeof config.isProductPage === "function"
        ? config.isProductPage({ structuredProduct })
        : defaultIsProductPage(config, structuredProduct);
    },
    extract() {
      const jsonLdBlocks = parseJsonLd();
      const structuredProduct = findStructuredProduct(jsonLdBlocks);
      const structuredBreadcrumbs = findStructuredBreadcrumbs(jsonLdBlocks);
      const isProductPage = typeof config.isProductPage === "function"
        ? config.isProductPage({ structuredProduct })
        : defaultIsProductPage(config, structuredProduct);
      if (!isProductPage) {
        return null;
      }

      const detailEntries = extractDetailEntries(config.detail || {});
      const title = normalizeText(
        textOf(queryFirst(config.selectors?.title || [])) ||
        findStructuredValue(structuredProduct, ["name"]) ||
        document.title
      );
      if (!title) {
        return null;
      }

      const brand = normalizeText(
        textOf(queryFirst(config.selectors?.brand || [])) ||
        findStructuredValue(structuredProduct, ["brand.name", "brand", "manufacturer.name", "manufacturer"]) ||
        ""
      );
      const priceInfo = parsePrice(
        textOf(queryFirst(config.selectors?.price || [])) ||
        findStructuredValue(structuredProduct, ["offers.price", "offers.lowPrice", "offers.priceSpecification.price"]) ||
        attrOf(['meta[itemprop="price"]'], "content") ||
        "",
        findStructuredValue(structuredProduct, ["offers.priceCurrency", "offers.priceSpecification.priceCurrency"]) || attrOf(['meta[itemprop="priceCurrency"]'], "content") || config.currency || "USD"
      );
      const image = normalizeUrl(
        attrOf(config.selectors?.image || [], "src") ||
        attrOf(config.selectors?.image || [], "data-src") ||
        (() => {
          const structured = structuredProduct?.image;
          if (Array.isArray(structured)) {
            return structured[0] || "";
          }
          return structured || "";
        })() ||
        attrOf(['meta[property="og:image"]'], "content")
      );
      const rating = toNumber(
        textOf(queryFirst(config.selectors?.rating || [])) ||
        findStructuredValue(structuredProduct, ["aggregateRating.ratingValue", "reviewRating.ratingValue"])
      );
      const reviewCount = toNumber(
        textOf(queryFirst(config.selectors?.reviewCount || [])) ||
        findStructuredValue(structuredProduct, ["aggregateRating.reviewCount", "aggregateRating.ratingCount"])
      );
      const breadcrumbs = unique([...extractBreadcrumbs(config.selectors?.breadcrumbs || []), ...structuredBreadcrumbs]);
      const categoryHints = unique([...breadcrumbs, ...queryAll(config.selectors?.categoryHints || []).map((node) => textOf(node))]);
      const explicitClaims = unique(queryAll(config.selectors?.claims || []).map((node) => textOf(node)));
      const ingredientsText = extractIngredientsText({ selectors: config.selectors?.ingredients || [], detailEntries, headingPatterns: config.headingPatterns?.ingredients });
      const nutritionText = extractNutritionText({ selectors: config.selectors?.nutrition || [], detailEntries, headingPatterns: config.headingPatterns?.nutrition });
      const barcode = extractBarcode({ selectors: config.selectors?.barcode || [], detailEntries, structuredProduct, rawTexts: [title, brand, ingredientsText, nutritionText, ...breadcrumbs] });
      const sku = normalizeText(textOf(queryFirst(config.selectors?.sku || [])) || findStructuredValue(structuredProduct, ["sku", "mpn"]));
      const claims = extractClaims({ explicitClaims, detailEntries, extraText: [title, brand, ...breadcrumbs, ingredientsText, nutritionText] });
      const relatedProducts = extractRelatedProducts(buildRelatedConfig(config.selectors));

      let raw = {
        retailer: config.retailer,
        retailerLabel: config.retailerLabel || normalizeText(config.retailer),
        url: location.href,
        canonicalUrl: findCanonicalUrl(),
        title,
        brand,
        categoryHints,
        price: priceInfo.display,
        currency: priceInfo.currency,
        image,
        rating,
        reviewCount,
        breadcrumbs,
        barcode,
        sku,
        asinOrSku: sku,
        ingredientsText,
        nutritionText,
        claims,
        relatedProducts,
        rawEvidence: {
          detailEntries,
          structuredProduct,
          structuredBreadcrumbs,
          pageTitle: document.title
        }
      };

      if (typeof config.customize === "function") {
        raw = config.customize(raw, { structuredProduct, detailEntries, priceInfo }) || raw;
      }

      return raw;
    }
  };
}
