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
const SUPPLEMENT_FILLERS = ["maltodextrin", "silicon dioxide", "magnesium stearate", "titanium dioxide"];
const SUPPLEMENT_SWEETENERS = ["sucralose", "acesulfame potassium", "stevia", "sugar alcohol"];
const ECO_FRAGRANCE_TERMS = ["fragrance", "parfum", "limonene", "linalool", "citronellol"];
const ECO_HARSH_TERMS = ["ammonia", "bleach", "quaternary ammonium", "benzalkonium chloride", "2-butoxyethanol"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeIngredientList(ingredients) {
  if (!ingredients) {
    return [];
  }

  const rawText = Array.isArray(ingredients)
    ? ingredients.map((item) => item.displayName || item.canonicalName || item).join(", ")
    : String(ingredients);

  return rawText
    .replace(/\bcontains\s*:\s*/gi, "")
    .split(/,(?![^()]*\))/)
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

export function inferScoreLabel(score) {
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
  components.push({ title, effect, reason });
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
    if (names.some((name) => name.includes(benefit.key))) {
      score += benefit.score;
      benefits.push({ title: benefit.label, detail: benefit.reason });
      pushComponent(components, benefit.label, `+${benefit.score}`, benefit.reason);
    }
  }

  for (const rule of SKINCARE_FLAG_INGREDIENTS) {
    if (names.some((name) => rule.keys.some((key) => name.includes(key)))) {
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
      flags.push({ title: rule.label, severity: rule.severity, effect: `-${penalty}`, detail: rule.reason });
      pushComponent(components, rule.label, `-${penalty}`, rule.reason);
    }
  }

  if (!names.length) {
    score -= 14;
    flags.push({
      title: "Limited ingredient visibility",
      severity: "high",
      effect: "-14",
      detail: "The ingredient list could not be confidently extracted, which makes the score more conservative."
    });
  }

  const supportedClaims = (product.claims || []).map((claim) => claim.toLowerCase());
  if (supportedClaims.some((claim) => claim.includes("fragrance free")) && !names.some((name) => name.includes("fragrance") || name.includes("parfum"))) {
    score += 5;
    tags.push("fragrance free");
  }

  if (names.some((name) => name.includes("fragrance") || name.includes("parfum"))) {
    tags.push("fragrance present");
  }

  if (preferences.fragranceFree) {
    if (tags.includes("fragrance present")) {
      preferenceHits.push("Conflicts with your fragrance-free preference.");
    } else {
      preferenceHits.push("Matches your fragrance-free preference.");
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

  if (preferences.acneSafe && !flags.some((item) => item.title === "Acne-trigger caution")) {
    score += 3;
    preferenceHits.push("Looks friendlier for acne-prone routines.");
  }

  if (preferences.vegan && supportedClaims.some((claim) => claim.includes("vegan"))) {
    score += 2;
    tags.push("vegan");
  }

  if (preferences.crueltyFree && supportedClaims.some((claim) => claim.includes("cruelty free"))) {
    score += 2;
    tags.push("cruelty free");
  }

  const scoreLabel = inferScoreLabel(score);
  return {
    score: clamp(score, 8, 98),
    scoreLabel,
    scoreTone: scoreToneClass(scoreLabel),
    flags,
    benefits,
    components,
    tags: uniqueTags(tags),
    preferenceHits
  };
}

export function scoreFood(product, preferences) {
  const ingredients = normalizeIngredientList(product.ingredients);
  const names = ingredients.map((item) => item.canonicalName);
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
      benefits.push({ title: "Protein support", detail: "Protein content looks strong for a quick food comparison." });
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
      benefits.push({ title: "Fiber support", detail: "Fiber is a meaningful positive signal for satiety and ingredient quality." });
      pushComponent(components, "Fiber", "+7", "Fiber content is strong for a snack-style product.");
    } else if (fiber >= 3) {
      score += 3;
      pushComponent(components, "Fiber", "+3", "Fiber content adds a moderate positive signal.");
    }
  }

  if (addedSugar != null) {
    if (addedSugar >= 14) {
      score -= 12;
      flags.push({ title: "Higher added sugar", severity: "high", effect: "-12", detail: "Added sugar looks high for an everyday product and may be worth caution." });
    } else if (addedSugar >= 8) {
      score -= 7;
      flags.push({ title: "Moderate added sugar", severity: "medium", effect: "-7", detail: "Added sugar is noticeable and may matter if you are optimizing for lower-sugar choices." });
    } else if (addedSugar <= 4) {
      score += 5;
      tags.push("low sugar");
      benefits.push({ title: "Lower sugar profile", detail: "Added sugar appears fairly restrained." });
    }
  }

  if (sodium != null) {
    if (sodium >= 480) {
      score -= 10;
      flags.push({ title: "High sodium", severity: "high", effect: "-10", detail: "Sodium looks high for a routine purchase and may be worth caution." });
    } else if (sodium >= 300) {
      score -= 5;
      flags.push({ title: "Moderate sodium", severity: "medium", effect: "-5", detail: "Sodium is noticeable and may matter if you prefer lower-sodium products." });
    }
  }

  const dyeHits = FOOD_DYES.filter((dye) => names.some((name) => name.includes(dye)));
  if (dyeHits.length) {
    const penalty = 8 + Math.max(0, dyeHits.length - 1) * 2;
    score -= penalty;
    flags.push({ title: "Artificial dyes present", severity: dyeHits.length > 1 ? "high" : "medium", effect: `-${penalty}`, detail: "Artificial dyes are often flagged by shoppers looking for a simpler ingredient profile." });
    tags.push("artificial dye present");
  }

  const sweetenerHits = FOOD_SWEETENERS.filter((sweetener) => names.some((name) => name.includes(sweetener)));
  if (sweetenerHits.length) {
    score -= 6;
    flags.push({ title: "Artificial sweetener present", severity: "medium", effect: "-6", detail: "Artificial sweeteners are commonly avoided by some shoppers depending on their preferences." });
  }

  const additiveHits = FOOD_ADDITIVES.filter((additive) => names.some((name) => name.includes(additive)));
  if (additiveHits.length >= 2) {
    score -= 7;
    flags.push({ title: "Heavier additive load", severity: "medium", effect: "-7", detail: "Multiple preservatives or texture additives suggest a more processed profile." });
    tags.push("ultra-processed");
  } else if (names.length && names.length <= 8) {
    score += 5;
    tags.push("simple ingredient list");
    benefits.push({ title: "Simpler ingredient list", detail: "A shorter ingredient list is often easier to evaluate quickly." });
  }

  if (preferences.lowSugar) {
    if (addedSugar != null && addedSugar <= 6) {
      score += 5;
      preferenceHits.push("Fits your low-sugar preference.");
    } else if (addedSugar != null) {
      score -= 4;
      preferenceHits.push("Conflicts with your low-sugar preference.");
    }
  }

  if (preferences.highProtein) {
    if (protein != null && protein >= 12) {
      score += 4;
      preferenceHits.push("Fits your protein-focused preference.");
    } else {
      score -= 3;
      preferenceHits.push("Protein looks modest for a protein-focused pick.");
    }
  }

  if (preferences.lowSodium) {
    if (sodium != null && sodium <= 180) {
      score += 3;
      preferenceHits.push("Fits your lower-sodium preference.");
    } else if (sodium != null) {
      score -= 4;
      preferenceHits.push("Conflicts with your lower-sodium preference.");
    }
  }

  if (preferences.dyeAvoidance && dyeHits.length) {
    score -= 5;
    preferenceHits.push("Conflicts with your dye-avoidance preference.");
  }

  if (preferences.sweetenerAvoidance && sweetenerHits.length) {
    score -= 5;
    preferenceHits.push("Conflicts with your sweetener-avoidance preference.");
  }

  if (!ingredients.length) {
    score -= 10;
    flags.push({ title: "Limited ingredient visibility", severity: "high", effect: "-10", detail: "The ingredient list is incomplete, which makes this analysis more conservative." });
  }

  const scoreLabel = inferScoreLabel(score);
  return {
    score: clamp(score, 8, 98),
    scoreLabel,
    scoreTone: scoreToneClass(scoreLabel),
    flags,
    benefits,
    components,
    tags: uniqueTags(tags),
    preferenceHits
  };
}

export function scoreSupplements(product, preferences) {
  const ingredients = normalizeIngredientList(product.ingredients);
  const names = ingredients.map((item) => item.canonicalName);
  const nutrition = product.nutrition || {};
  let score = 68;
  const components = [];
  const flags = [];
  const benefits = [];
  const tags = [];
  const preferenceHits = [];

  if (/proprietary blend/i.test(product.nutritionText || "") || /proprietary blend/i.test(product.ingredients || "")) {
    score -= 12;
    flags.push({ title: "Proprietary blend", severity: "high", effect: "-12", detail: "A proprietary blend reduces dosage clarity and transparency." });
  } else {
    score += 5;
    benefits.push({ title: "Clearer label", detail: "The available label data looks more transparent than a proprietary-blend format." });
  }

  const fillerHits = SUPPLEMENT_FILLERS.filter((item) => names.some((name) => name.includes(item)));
  if (fillerHits.length) {
    const penalty = 5 + Math.max(0, fillerHits.length - 1) * 2;
    score -= penalty;
    flags.push({ title: "Filler load", severity: fillerHits.length > 1 ? "medium" : "low", effect: `-${penalty}`, detail: "Multiple filler-style ingredients add some caution for shoppers seeking a simpler label." });
  }

  const sweetenerHits = SUPPLEMENT_SWEETENERS.filter((item) => names.some((name) => name.includes(item)));
  if (sweetenerHits.length) {
    score -= 5;
    flags.push({ title: "Sweetener burden", severity: "medium", effect: "-5", detail: "Sweeteners are often avoided by shoppers who want a simpler supplement profile." });
  }

  const protein = parseNutritionValue(nutrition.protein);
  if (protein != null && protein >= 20) {
    score += 8;
    tags.push("high protein");
    benefits.push({ title: "Protein-forward", detail: "Protein content looks strong for a supplement-style product." });
  }

  if (preferences.highProtein && protein != null && protein >= 20) {
    score += 4;
    preferenceHits.push("Fits your protein-focused preference.");
  }

  if (!ingredients.length) {
    score -= 10;
    flags.push({ title: "Limited label visibility", severity: "high", effect: "-10", detail: "Only part of the ingredient or supplement-facts panel was available." });
  }

  const scoreLabel = inferScoreLabel(score);
  return {
    score: clamp(score, 12, 96),
    scoreLabel,
    scoreTone: scoreToneClass(scoreLabel),
    flags,
    benefits,
    components,
    tags: uniqueTags(tags),
    preferenceHits
  };
}

export function scoreEcoCleaning(product, preferences) {
  const ingredients = normalizeIngredientList(product.ingredients);
  const names = ingredients.map((item) => item.canonicalName);
  let score = 66;
  const components = [];
  const flags = [];
  const benefits = [];
  const tags = [];
  const preferenceHits = [];

  const fragranceHits = ECO_FRAGRANCE_TERMS.filter((item) => names.some((name) => name.includes(item)) || (product.claims || []).some((claim) => String(claim).toLowerCase().includes(item)));
  if (fragranceHits.length) {
    const penalty = 8 + Math.max(0, fragranceHits.length - 1) * 2;
    score -= penalty;
    flags.push({ title: "Fragrance burden", severity: "medium", effect: `-${penalty}`, detail: "Added fragrance and fragrance allergens are commonly avoided by shoppers seeking gentler cleaning products." });
  }

  const harshHits = ECO_HARSH_TERMS.filter((item) => names.some((name) => name.includes(item)));
  if (harshHits.length) {
    const penalty = 10 + Math.max(0, harshHits.length - 1) * 2;
    score -= penalty;
    flags.push({ title: "Harsh chemistry detected", severity: "high", effect: `-${penalty}`, detail: "The formula appears to include harsher cleaning agents, which may not fit gentler-cleaning preferences." });
  }

  if ((product.claims || []).some((claim) => String(claim).toLowerCase().includes("fragrance free"))) {
    score += 6;
    tags.push("fragrance free");
    benefits.push({ title: "Fragrance-free positioning", detail: "The product appears to be marketed as fragrance free or unscented." });
  }

  if ((product.claims || []).some((claim) => String(claim).toLowerCase().includes("safer choice"))) {
    score += 7;
    tags.push("safer choice");
    benefits.push({ title: "Safer-choice claim", detail: "The product references a safer-chemistry style claim on the page." });
  }

  if (preferences.fragranceFree) {
    if (fragranceHits.length) {
      score -= 4;
      preferenceHits.push("Conflicts with your fragrance-free preference.");
    } else {
      score += 4;
      preferenceHits.push("Fits your fragrance-free preference.");
    }
  }

  if (!ingredients.length) {
    score -= 12;
    flags.push({ title: "Limited ingredient transparency", severity: "high", effect: "-12", detail: "Cleaning-product ingredient data was limited, so this verdict stays cautious." });
  }

  const scoreLabel = inferScoreLabel(score);
  return {
    score: clamp(score, 10, 94),
    scoreLabel,
    scoreTone: scoreToneClass(scoreLabel),
    flags,
    benefits,
    components,
    tags: uniqueTags(tags),
    preferenceHits
  };
}

export function scoreUnknown(product) {
  const hasIngredients = normalizeIngredientList(product.ingredients).length > 0;
  const baseScore = hasIngredients ? 54 : 42;
  const scoreLabel = inferScoreLabel(baseScore);
  return {
    score: baseScore,
    scoreLabel,
    scoreTone: scoreToneClass(scoreLabel),
    flags: [{
      title: "Unsupported or weakly classified product",
      severity: "high",
      effect: "-12",
      detail: "ScanCart could not confidently map this product into a supported category, so the score remains cautious."
    }],
    benefits: [],
    components: [],
    tags: [],
    preferenceHits: []
  };
}

export function scoreProduct(product, preferences, classification) {
  if (classification.category === "skincare") {
    return scoreSkincare(product, preferences);
  }
  if (classification.category === "food") {
    return scoreFood(product, preferences);
  }
  if (classification.category === "supplements") {
    return scoreSupplements(product, preferences);
  }
  if (classification.category === "eco_cleaning") {
    return scoreEcoCleaning(product, preferences);
  }
  return scoreUnknown(product);
}

export function scoreAlternativePreview(candidate, category, preferences, subcategory = "unknown") {
  const title = String(candidate.title || "").toLowerCase();
  const claims = (candidate.claims || []).map((item) => String(item).toLowerCase());
  let score = 66;
  let preferenceFit = 0;
  const reasons = [];

  if (category === "skincare") {
    if (title.includes("fragrance free") || title.includes("unscented") || claims.includes("fragrance free")) {
      score += 8;
      preferenceFit += preferences.fragranceFree ? 4 : 2;
      reasons.push("Looks fragrance-free or unscented.");
    }
    if (title.includes("ceramide") || title.includes("niacinamide")) {
      score += 6;
      reasons.push("Title points to supportive skincare actives.");
    }
    if (preferences.sensitiveSkin && (title.includes("sensitive") || claims.includes("sensitive skin"))) {
      score += 5;
      preferenceFit += 4;
      reasons.push("Looks aligned with sensitive-skin positioning.");
    }
    if (subcategory !== "unknown" && title.includes(subcategory.replace(/_/g, " "))) {
      score += 4;
    }
  }

  if (category === "food") {
    if (title.includes("protein")) {
      score += preferences.highProtein ? 8 : 4;
      preferenceFit += preferences.highProtein ? 5 : 0;
      reasons.push("Title suggests stronger protein support.");
    }
    if (title.includes("low sugar") || title.includes("no sugar") || claims.includes("low sugar")) {
      score += preferences.lowSugar ? 8 : 5;
      preferenceFit += preferences.lowSugar ? 5 : 1;
      reasons.push("Title suggests lower sugar positioning.");
    }
    if (title.includes("organic") || title.includes("simple")) {
      score += 3;
      reasons.push("Title suggests a simpler ingredient profile.");
    }
  }

  if (category === "supplements") {
    if (title.includes("protein")) {
      score += 6;
      reasons.push("Looks protein-forward.");
    }
    if (title.includes("gummy")) {
      score -= 2;
      reasons.push("Gummy supplements can carry more sugar or sweeteners.");
    }
  }

  if (category === "eco_cleaning") {
    if (title.includes("free and clear") || title.includes("fragrance free") || claims.includes("fragrance free")) {
      score += 7;
      preferenceFit += preferences.fragranceFree ? 5 : 2;
      reasons.push("Looks like a lower-fragrance cleaning option.");
    }
    if (title.includes("plant") || claims.includes("safer choice")) {
      score += 5;
      reasons.push("Looks positioned as a gentler or cleaner-chemistry option.");
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
    preferenceFit,
    reasons
  };
}
