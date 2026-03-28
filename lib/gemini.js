function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

async function callGemini(prompt, settings) {
  if (!settings.geminiApiKey) {
    return null;
  }

  const model = settings.geminiModel || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  return safeParseJson(text);
}

function compactEvidence(analysis) {
  return {
    title: analysis.product.title,
    brand: analysis.product.brand,
    retailer: analysis.product.retailerLabel,
    category: analysis.product.category,
    subcategory: analysis.product.subcategory,
    ingredients: analysis.product.ingredientsList?.slice(0, 20).map((item) => item.displayName || item.canonicalName) || [],
    nutrition: analysis.product.nutrition || {},
    positives: analysis.benefits.slice(0, 4),
    concerns: analysis.flags.slice(0, 4),
    score: analysis.score,
    confidence: analysis.confidence,
    preferences: analysis.preferenceHits,
    warnings: analysis.warnings,
    sources: analysis.sources.map((source) => ({
      sourceLabel: source.sourceLabel,
      selectedFor: source.selectedFor,
      authorityWeight: source.authorityWeight,
      matchType: source.matchType
    }))
  };
}

function buildFallbackExplanation(analysis) {
  const positives = analysis.benefits.slice(0, 2).map((item) => item.title.toLowerCase());
  const concerns = analysis.flags.slice(0, 2).map((item) => item.title.toLowerCase());
  const confidenceNote = analysis.confidence.overall < 0.65
    ? "This read is based on limited verified data, so the verdict is intentionally conservative."
    : "";

  let shortExplanation = `${analysis.product.title} lands at ${analysis.score.label.toLowerCase()} based on the available product data and source checks.`;
  if (positives.length) {
    shortExplanation += ` Helpful positives include ${positives.join(" and ")}.`;
  }
  if (concerns.length) {
    shortExplanation += ` Main caution areas are ${concerns.join(" and ")}.`;
  }
  if (confidenceNote) {
    shortExplanation += ` ${confidenceNote}`;
  }

  const detailedExplanation = [
    shortExplanation,
    analysis.preferenceHits.length ? `Preference fit: ${analysis.preferenceHits.join(" ")}` : "",
    analysis.warnings.length ? `Verification note: ${analysis.warnings.join(" ")}` : ""
  ].filter(Boolean).join(" ");

  return {
    shortExplanation,
    detailedExplanation,
    topReasons: [
      ...analysis.benefits.slice(0, 2).map((item) => item.detail),
      ...analysis.flags.slice(0, 2).map((item) => item.detail)
    ].slice(0, 4)
  };
}

export async function generateAnalysisExplanation(analysis, settings) {
  const fallback = buildFallbackExplanation(analysis);
  if (!settings.geminiApiKey) {
    return { ...fallback, source: "fallback" };
  }

  const prompt = [
    "You are ScanCart, a calm shopping intelligence assistant.",
    "Return JSON only with keys shortExplanation, detailedExplanation, topReasons.",
    "Use the deterministic score as the truth.",
    "Do not invent ingredients, do not override the score, do not diagnose, and do not fearmonger.",
    "Use concise, practical, plain English. When confidence is limited, explicitly say that the read is based on the available data.",
    JSON.stringify(compactEvidence(analysis), null, 2)
  ].join("\n\n");

  try {
    const parsed = await callGemini(prompt, settings);
    if (parsed?.shortExplanation && parsed?.detailedExplanation) {
      return { ...parsed, source: "gemini" };
    }
  } catch (error) {
    return { ...fallback, source: "fallback", error: error.message };
  }

  return { ...fallback, source: "fallback" };
}

export async function generateComparisonExplanation(currentAnalysis, alternative, settings) {
  const fallback = {
    summary: `${alternative.title} looks like a stronger fit than ${currentAnalysis.product.title} because it appears cleaner, more aligned with the category, or more preference-friendly based on the available evidence.`
  };

  if (!settings.geminiApiKey) {
    return fallback;
  }

  const prompt = [
    "You are ScanCart, a calm shopping intelligence assistant.",
    "Return JSON only with key summary.",
    "Explain why the alternative may be a better or better-fit option.",
    "Do not claim certainty. Stay grounded in the structured evidence.",
    JSON.stringify({ current: compactEvidence(currentAnalysis), alternative }, null, 2)
  ].join("\n\n");

  try {
    const parsed = await callGemini(prompt, settings);
    if (parsed?.summary) {
      return parsed;
    }
  } catch (error) {
    return fallback;
  }

  return fallback;
}

export async function askGeminiQuestion(question, analysis, settings, compareTarget = null) {
  if (!settings.geminiApiKey) {
    return {
      answer: "Add a Gemini API key in ScanCart settings to enable the assistant. The rule-based score is still active without it."
    };
  }

  const prompt = [
    "You are ScanCart's product assistant.",
    "Return JSON only with a single key named answer.",
    "Base your answer only on the structured evidence below.",
    "Stay concise, plain-English, practical, and non-medical.",
    "Do not invent ingredients or claims. If confidence is limited, say so.",
    JSON.stringify({ question, current: compactEvidence(analysis), compareTarget }, null, 2)
  ].join("\n\n");

  try {
    const parsed = await callGemini(prompt, settings);
    if (parsed?.answer) {
      return parsed;
    }
  } catch (error) {
    return {
      answer: `Gemini was unavailable just now, so ScanCart cannot answer that question yet. ${error.message}`
    };
  }

  return {
    answer: "Gemini returned an incomplete answer. Try asking again or refresh the analysis."
  };
}
