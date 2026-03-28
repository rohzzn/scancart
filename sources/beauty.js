function buildBeautyBaseUrl(settings) {
  return String(settings.openBeautyFactsBaseUrl || "https://world.openbeautyfacts.org").replace(/\/$/, "");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function mapBeautyProduct(product, matchType) {
  if (!product) {
    return null;
  }

  return {
    source: {
      sourceKey: "open_beauty_facts",
      sourceLabel: "Open Beauty Facts",
      sourceType: "public_dataset",
      authority: matchType === "barcode" ? 0.8 : 0.68,
      trusted: true,
      matchSignals: {
        barcodeMatch: matchType === "barcode",
        titleBrandMatch: matchType !== "barcode"
      },
      fields: {
        title: product.product_name || "",
        brand: product.brands || "",
        ingredients: product.ingredients_text || "",
        claims: [
          ...(product.labels_tags || []).slice(0, 6),
          ...(product.categories_tags || []).slice(0, 6)
        ],
        barcode: product.code || "",
        image: product.image_front_url || "",
        categoryHints: (product.categories_tags || []).slice(0, 6)
      },
      evidence: {
        matchType,
        url: product.url || ""
      }
    },
    candidate: {
      title: product.product_name || "",
      brand: product.brands || "",
      image: product.image_front_url || "",
      url: product.url || "",
      sourceType: "open_beauty_facts_search",
      sourceLabel: "Open Beauty Facts",
      confidence: matchType === "barcode" ? 0.74 : 0.6,
      reasons: [matchType === "barcode" ? "Matched by barcode in Open Beauty Facts." : "Found a close public-database beauty match."],
      category: "skincare",
      claims: [
        ...(product.labels_tags || []).slice(0, 6),
        ...(product.categories_tags || []).slice(0, 6)
      ]
    }
  };
}

export async function enrichBeautyProduct(product, settings) {
  const baseUrl = buildBeautyBaseUrl(settings);
  const sources = [];
  const candidates = [];
  const warnings = [];

  try {
    if (product.barcode) {
      const byBarcode = await fetchJson(`${baseUrl}/api/v2/product/${encodeURIComponent(product.barcode)}.json`);
      if (byBarcode.status === 1 && byBarcode.product) {
        const mapped = mapBeautyProduct(byBarcode.product, "barcode");
        if (mapped) {
          sources.push(mapped.source);
          candidates.push(mapped.candidate);
        }
      }
    }
  } catch (error) {
    warnings.push("Open Beauty Facts barcode lookup was unavailable.");
  }

  if (!sources.length) {
    try {
      const query = encodeURIComponent(`${product.brand || ""} ${product.title}`.trim());
      const search = await fetchJson(`${baseUrl}/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=4`);
      (search.products || []).forEach((entry, index) => {
        const mapped = mapBeautyProduct(entry, index === 0 ? "search" : "candidate");
        if (mapped?.candidate) {
          candidates.push(mapped.candidate);
        }
        if (index === 0 && mapped?.source) {
          sources.push(mapped.source);
        }
      });
    } catch (error) {
      warnings.push("Open Beauty Facts search was unavailable.");
    }
  }

  return { sources, candidates, warnings };
}
