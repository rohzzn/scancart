function buildDsldBaseUrl(settings) {
  return String(settings.nihDsldApiBaseUrl || "https://api.ods.od.nih.gov/dsld/v8").replace(/\/$/, "");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function normalizeDsldResults(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }
  if (Array.isArray(payload?.products)) {
    return payload.products;
  }
  return [];
}

function mapDsldProduct(entry) {
  if (!entry) {
    return null;
  }

  const title = entry.product_name || entry.full_name || entry.name || "";
  const brand = entry.brand_name || entry.brand || "";
  const labelUrl = entry.url || entry.label_url || entry.product_url || "";

  return {
    source: {
      sourceKey: "nih_dsld",
      sourceLabel: "NIH DSLD",
      sourceType: "government_reference",
      authority: 0.78,
      trusted: true,
      matchSignals: {
        titleBrandMatch: true
      },
      fields: {
        title,
        brand,
        ingredients: entry.ingredients || entry.other_ingredients || "",
        nutrition: null,
        claims: [],
        barcode: entry.upc || entry.barcode || "",
        categoryHints: [entry.product_type || entry.category || ""].filter(Boolean)
      },
      evidence: {
        matchType: "search",
        url: labelUrl
      }
    },
    candidate: {
      title,
      brand,
      url: labelUrl,
      image: "",
      price: "",
      sourceType: "nih_dsld_search",
      sourceLabel: "NIH DSLD",
      confidence: 0.64,
      reasons: ["Found a supplement label match in the NIH database."],
      category: "supplements"
    }
  };
}

export async function enrichSupplementProduct(product, settings) {
  const sources = [];
  const candidates = [];
  const warnings = [];
  const baseUrl = buildDsldBaseUrl(settings);
  const query = encodeURIComponent(`${product.brand || ""} ${product.title}`.trim());

  try {
    const endpoints = [
      `${baseUrl}/search-filter?q=${query}&product_name=${encodeURIComponent(product.title || "")}&brand=${encodeURIComponent(product.brand || "")}&size=5`,
      `${baseUrl}/browse-products?q=${query}&size=5`
    ];

    for (const endpoint of endpoints) {
      const payload = await fetchJson(endpoint);
      const results = normalizeDsldResults(payload);
      if (!results.length) {
        continue;
      }

      results.slice(0, 5).forEach((entry, index) => {
        const mapped = mapDsldProduct(entry);
        if (!mapped) {
          return;
        }
        if (index === 0) {
          sources.push(mapped.source);
        }
        candidates.push(mapped.candidate);
      });
      break;
    }
  } catch (error) {
    warnings.push("NIH DSLD lookup was unavailable.");
  }

  return { sources, candidates, warnings };
}
