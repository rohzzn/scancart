const SKINCARE_POSITIVE_INGREDIENTS = [
  { key: "ceramide", label: "Ceramides", score: 6, reason: "Barrier-supporting ingredients add a meaningful positive signal." },
  { key: "niacinamide", label: "Niacinamide", score: 5, reason: "Niacinamide is often appreciated for balancing and barrier-supportive formulas." },
  { key: "glycerin", label: "Glycerin", score: 4, reason: "Glycerin is a strong hydration-supporting humectant." },
  { key: "panthenol", label: "Panthenol", score: 4, reason: "Panthenol is commonly used to support soothing, hydration, and barrier comfort." },
  { key: "hyaluronic acid", label: "Hyaluronic acid", score: 3, reason: "Hyaluronic acid adds hydration support." },
  { key: "squalane", label: "Squalane", score: 4, reason: "Squalane is usually a gentle, supportive emollient." },
  { key: "allantoin", label: "Allantoin", score: 3, reason: "Allantoin is commonly used in calming formulas." }
];

const SKINCARE_FLAG_INGREDIENTS = [
  { keys: ["fragrance", "parfum"], label: "Fragrance", severity: "high", penalty: 12, reason: "Fragrance is commonly avoided by people with sensitive or reactive skin." },
  { keys: ["denatured alcohol", "sd alcohol", "alcohol denat"], label: "Drying alcohol", severity: "high", penalty: 10, reason: "High-position drying alcohol can feel irritating or drying in leave-on skincare." },
  { keys: ["peppermint oil", "eucalyptus oil", "lavender oil", "citrus peel oil"], label: "Essential oil irritant", severity: "medium", penalty: 7, reason: "Strong essential oils can be a concern for sensitive skin." },
  { keys: ["isopropyl myristate", "coconut oil"], label: "Acne-trigger caution", severity: "medium", penalty: 5, reason: "This ingredient can be worth caution for acne-prone users depending on the full formula." },
  { keys: ["methylparaben", "propylparaben", "butylparaben"], label: "Parabens present", severity: "low", penalty: 4, reason: "Some users intentionally avoid parabens and may want a clearer alternative." }
];

const FOOD_DYES = ["red 40", "yellow 5", "yellow 6", "blue 1", "blue 2", "green 3"];
const FOOD_SWEETENERS = ["sucralose", "acesulfame potassium", "aspartame", "saccharin", "erythritol"];
const FOOD_ADDITIVES = ["sodium benzoate", "potassium sorbate", "bht", "bha", "polysorbate 80", "carrageenan", "mono and diglycerides"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeIngredientList(ingredients) {
  if (!ingredients) {
    return [];
  }

  const rawText = Array.isArray(ingredients) ? ingredients.join(", ") : String(ingredients);

  return rawText
    .replace(/\bcontains\s*:\s*/gi, "")
    .split(/,(?![^(]*\))/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({
      displayName: item,
      canonicalName: item
        .toLowerCase()
        .replace(/\([^)]*\)/g, "")
        .replace(/[^a-z0-9+\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    }));
}

function parseNutritionValue(value) {
  if (value == null) {
    return null;
  }
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function inferScoreLabel(score) {
  if (score >= 90) {
    return "Excellent";
  }
  if (score >= 75) {
    return "Good";
  }
  if (score >= 60) {
    return "Fair";
  }
  if (score >= 40) {
    return "Caution";
  }
  return "Avoid";
}

function scoreToneClass(label) {
  if (label === "Excellent" || label === "Good") {
    return "good";
  }
  if (label === "Fair") {
    return "fair";
  }
  if (label === "Caution") {
    return "caution";
  }
  return "avoid";
}

function pushComponent(components, title, effect, reason) {
  components.push({
    title,
    effect,
    reason
  });
}

function uniqueTags(tags) {
  return [...new Set(tags.filter(Boolean))];
}

export function scoreSkincare(product, preferences) {
  const ingredients = normalizeIngredientList(product.ingredients);
  const names = ingredients.map((item) => item.canonicalName);
  let score = 74;
  const components = [];
  const flags = [];
  const benefits = [];
  const tags = [];
  const preferenceHits = [];

  for (const benefit of SKINCARE_POSITIVE_INGREDIENTS) {
    const found = names.some((name) => name.includes(benefit.key));
    if (found) {
      score += benefit.score;
      benefits.push({
        title: benefit.label,
        detail: benefit.reason
      });
      pushComponent(components, benefit.label, `+${benefit.score}`, benefit.reason);
    }
  }

  for (const rule of SKINCARE_FLAG_INGREDIENTS) {
    const found = names.some((name) => rule.keys.some((key) => name.includes(key)));
    if (found) {
      let penalty = rule.penalty;
      if (preferences.sensitiveSkin && rule.label === "Fragrance") {
        penalty += 4;
      }
      if (preferences.acneSafe && rule.label === "Acne-trigger caution") {
        penalty += 4;
      }
      if (preferences.parabenFree && rule.label === "Parabens present") {
        penalty += 4;
      }
      score -= penalty;
      flags.push({
        title: rule.label,
        severity: rule.severity,
        effect: `-${penalty}`,
        detail: rule.reason
      });
      pushComponent(components, rule.label, `-${penalty}`, rule.reason);
    }
  }

  if (!names.length) {
    score -= 14;
    flags.push({
      title: "Limited ingredient visibility",
      severity: "high",
      effect: "-14",
      detail: "The ingredient list could not be confidently extracted, which reduces confidence and makes the score more conservative."
    });
  }

  const supportedClaims = (product.claims || []).map((claim) => claim.toLowerCase());
  if (supportedClaims.some((claim) => claim.includes("fragrance free")) && !names.some((name) => name.includes("fragrance") || name.includes("parfum"))) {
    score += 5;
    tags.push("fragrance free");
    preferenceHits.push("Matches fragrance-free preference");
  }

  if (names.some((name) => name.includes("fragrance") || name.includes("parfum"))) {
    tags.push("fragrance present");
  }

  if (preferences.fragranceFree) {
    if (tags.includes("fragrance present")) {
      preferenceHits.push("Conflicts with your fragrance-free preference");
    } else {
      preferenceHits.push("Matches your fragrance-free preference");
      score += 4;
    }
  }

  if (preferences.sensitiveSkin) {
    if (!tags.includes("fragrance present")) {
      score += 4;
      tags.push("sensitive-skin friendly");
    } else {
      tags.push("sensitive-skin caution");
    }
  }

  if (preferences.acneSafe) {
    const acneConcern = flags.some((item) => item.title === "Acne-trigger caution");
    if (!acneConcern) {
      score += 3;
      preferenceHits.push("Looks friendlier for acne-prone routines");
    }
  }

  if (preferences.vegan && supportedClaims.some((claim) => claim.includes("vegan"))) {
    score += 2;
    tags.push("vegan");
    preferenceHits.push("Marked vegan");
  }

  if (preferences.crueltyFree && supportedClaims.some((claim) => claim.includes("cruelty free"))) {
    score += 2;
    tags.push("cruelty free");
    preferenceHits.push("Marked cruelty free");
  }

  return {
    score: clamp(score, 8, 98),
    scoreLabel: inferScoreLabel(score),
    scoreTone: scoreToneClass(inferScoreLabel(score)),
    flags,
    benefits,
    components,
    tags: uniqueTags(tags),
    preferenceHits
  };
}

export function scoreFood(product, preferences) {
  const ingredients = normalizeIngredientList(product.ingredients);
  const ingredientNames = ingredients.map((item) => item.canonicalName);
  const nutrition = product.nutrition || {};
  const addedSugar = parseNutritionValue(nutrition.addedSugars ?? nutrition.addedSugar ?? nutrition.sugars);
  const sodium = parseNutritionValue(nutrition.sodium);
  const protein = parseNutritionValue(nutrition.protein);
  const fiber = parseNutritionValue(nutrition.fiber);
  let score = 72;
  const components = [];
  const flags = [];
  const benefits = [];
  const tags = [];
  const preferenceHits = [];

  if (protein != null) {
    if (protein >= 12) {
      score += 8;
      tags.push("high protein");
      benefits.push({
        title: "Protein support",
        detail: "Protein content looks strong for a quick food comparison."
      });
      pushComponent(components, "Protein", "+8", "Protein content looks strong for this category.");
    } else if (protein >= 8) {
      score += 4;
      pushComponent(components, "Protein", "+4", "Protein content is a helpful positive signal.");
    }
  }

  if (fiber != null) {
    if (fiber >= 5) {
      score += 7;
      tags.push("fiber support");
      benefits.push({
        title: "Fiber support",
        detail: "Fiber is a meaningful positive signal for satiety and ingredient quality."
      });
      pushComponent(components, "Fiber", "+7", "Fiber content is strong for a snack-style product.");
    } else if (fiber >= 3) {
      score += 3;
      pushComponent(components, "Fiber", "+3", "Fiber content adds a moderate positive signal.");
    }
  }

  if (addedSugar != null) {
    if (addedSugar >= 14) {
      score -= 12;
      flags.push({
        title: "Higher added sugar",
        severity: "high",
        effect: "-12",
        detail: "Added sugar looks high for an everyday product and may be worth caution."
      });
    } else if (addedSugar >= 8) {
      score -= 7;
      flags.push({
        title: "Moderate added sugar",
        severity: "medium",
        effect: "-7",
        detail: "Added sugar is noticeable and may matter if you are optimizing for lower-sugar choices."
      });
    } else if (addedSugar <= 4) {
      score += 5;
      tags.push("low sugar");
      benefits.push({
        title: "Lower sugar profile",
        detail: "Added sugar appears fairly restrained."
      });
    }
  }

  if (sodium != null) {
    if (sodium >= 480) {
      score -= 10;
      flags.push({
        title: "High sodium",
        severity: "high",
        effect: "-10",
        detail: "Sodium looks high for a routine purchase and may be worth caution."
      });
    } else if (sodium >= 300) {
      score -= 5;
      flags.push({
        title: "Moderate sodium",
        severity: "medium",
        effect: "-5",
        detail: "Sodium is noticeable and may matter if you prefer lower-sodium products."
      });
    }
  }

  const dyeHits = FOOD_DYES.filter((dye) => ingredientNames.some((name) => name.includes(dye)));
  if (dyeHits.length) {
    const penalty = 8 + Math.max(0, dyeHits.length - 1) * 2;
    score -= penalty;
    flags.push({
      title: "Artificial dyes present",
      severity: dyeHits.length > 1 ? "high" : "medium",
      effect: `-${penalty}`,
      detail: "Artificial dyes are often flagged by shoppers looking for a simpler ingredient profile."
    });
    tags.push("artificial dye present");
  }

  const sweetenerHits = FOOD_SWEETENERS.filter((sweetener) => ingredientNames.some((name) => name.includes(sweetener)));
  if (sweetenerHits.length) {
    score -= 6;
    flags.push({
      title: "Artificial sweetener present",
      severity: "medium",
      effect: "-6",
      detail: "Artificial sweeteners are commonly avoided by some shoppers depending on their preferences."
    });
  }

  const additiveHits = FOOD_ADDITIVES.filter((additive) => ingredientNames.some((name) => name.includes(additive)));
  if (additiveHits.length >= 2) {
    score -= 7;
    flags.push({
      title: "Heavier additive load",
      severity: "medium",
      effect: "-7",
      detail: "Multiple preservatives or texture additives suggest a more processed profile."
    });
    tags.push("ultra-processed");
  } else if (ingredientNames.length && ingredientNames.length <= 8) {
    score += 5;
    tags.push("simple ingredient list");
    benefits.push({
      title: "Simpler ingredient list",
      detail: "A shorter ingredient list is often easier to evaluate quickly."
    });
  }

  if (preferences.lowSugar) {
    if (addedSugar != null && addedSugar <= 6) {
      score += 5;
      preferenceHits.push("Fits your low-sugar preference");
    } else if (addedSugar != null) {
      score -= 4;
      preferenceHits.push("Conflicts with your low-sugar preference");
    }
  }

  if (preferences.highProtein) {
    if (protein != null && protein >= 12) {
      score += 4;
      preferenceHits.push("Fits your protein-focused preference");
    } else {
      score -= 3;
      preferenceHits.push("Protein looks modest for a protein-focused pick");
    }
  }

  if (preferences.lowSodium) {
    if (sodium != null && sodium <= 180) {
      score += 3;
      preferenceHits.push("Fits your lower-sodium preference");
    } else if (sodium != null) {
      score -= 4;
      preferenceHits.push("Conflicts with your lower-sodium preference");
    }
  }

  if (preferences.dyeAvoidance && dyeHits.length) {
    score -= 5;
    preferenceHits.push("Conflicts with your dye-avoidance preference");
  }

  if (preferences.sweetenerAvoidance && sweetenerHits.length) {
    score -= 5;
    preferenceHits.push("Conflicts with your sweetener-avoidance preference");
  }

  if (!ingredients.length) {
    score -= 10;
    flags.push({
      title: "Limited ingredient visibility",
      severity: "high",
      effect: "-10",
      detail: "The ingredient list is incomplete, which makes this analysis more conservative."
    });
  }

  return {
    score: clamp(score, 8, 98),
    scoreLabel: inferScoreLabel(score),
    scoreTone: scoreToneClass(inferScoreLabel(score)),
    flags,
    benefits,
    components,
    tags: uniqueTags(tags),
    preferenceHits
  };
}

export function scoreUnknown(product) {
  const hasIngredients = normalizeIngredientList(product.ingredients).length > 0;
  const baseScore = hasIngredients ? 62 : 48;
  const scoreLabel = inferScoreLabel(baseScore);
  return {
    score: baseScore,
    scoreLabel,
    scoreTone: scoreToneClass(scoreLabel),
    flags: hasIngredients ? [] : [{
      title: "Limited data",
      severity: "high",
      effect: "-14",
      detail: "Not enough structured product data was found to apply a stronger category-specific score."
    }],
    benefits: [],
    components: [],
    tags: [],
    preferenceHits: []
  };
}

export function scoreAlternativePreview(candidate, category, preferences) {
  const title = String(candidate.title || "").toLowerCase();
  let score = 66;
  const reasons = [];

  if (category === "skincare") {
    if (title.includes("fragrance free") || title.includes("unscented")) {
      score += 8;
      reasons.push("Title suggests a fragrance-free or unscented formula.");
    }
    if (title.includes("ceramide") || title.includes("niacinamide")) {
      score += 6;
      reasons.push("Title points to supportive skincare actives.");
    }
    if (preferences.sensitiveSkin && title.includes("sensitive")) {
      score += 5;
      reasons.push("Looks aligned with sensitive-skin positioning.");
    }
  }

  if (category === "food") {
    if (title.includes("protein")) {
      score += preferences.highProtein ? 8 : 4;
      reasons.push("Title suggests stronger protein support.");
    }
    if (title.includes("low sugar") || title.includes("no sugar")) {
      score += preferences.lowSugar ? 8 : 5;
      reasons.push("Title suggests lower sugar positioning.");
    }
    if (title.includes("organic") || title.includes("simple")) {
      score += 3;
      reasons.push("Title suggests a simpler ingredient profile.");
    }
  }

  if (candidate.rating && candidate.rating >= 4.4) {
    score += 3;
  }

  const scoreLabel = inferScoreLabel(score);
  return {
    score: clamp(score, 20, 95),
    scoreLabel,
    scoreTone: scoreToneClass(scoreLabel),
    reasons
  };
}
