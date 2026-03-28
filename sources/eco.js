export async function enrichEcoProduct(product) {
  const sources = [];
  const candidates = [];
  const warnings = [];

  if ((product.claims || []).some((claim) => String(claim).toLowerCase().includes("safer choice"))) {
    sources.push({
      sourceKey: "retailer_safer_choice_claim",
      sourceLabel: `${product.retailerLabel} claim`,
      sourceType: "retailer_claim",
      authority: 0.62,
      trusted: true,
      matchSignals: {
        titleBrandMatch: true
      },
      fields: {
        title: product.title,
        brand: product.brand,
        ingredients: product.ingredientsText,
        claims: product.claims,
        categoryHints: product.categoryHints
      },
      evidence: {
        matchType: "claim"
      }
    });
  }

  if (!product.ingredientsText) {
    warnings.push("Cleaning-product ingredient transparency is limited on this page.");
  }

  return { sources, candidates, warnings };
}
