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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.geminiModel)}:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`;
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
        temperature: 0.4,
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

function buildFallbackExplanation(analysis) {
  const positives = analysis.benefits.slice(0, 2).map((item) => item.title.toLowerCase());
  const concerns = analysis.flags.slice(0, 2).map((item) => item.title.toLowerCase());
  const confidenceNote = analysis.confidence.overall < 0.65
    ? "This read is based on limited verified data, so the verdict is intentionally conservative."
    : "";

  let shortExplanation = `${analysis.product.title} lands at ${analysis.score.label.toLowerCase()} based on the available ingredient and product signals.`;

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
    "Write JSON only with keys shortExplanation, detailedExplanation, topReasons.",
    "Ground everything in the evidence. Do not diagnose, do not fearmonger, and do not state certainty when confidence is limited.",
    "Use phrases like 'may be irritating', 'commonly avoided by', 'based on the available data', and 'worth caution' when appropriate.",
    "",
    "Analysis evidence:",
    JSON.stringify({
      title: analysis.product.title,
      brand: analysis.product.brand,
      category: analysis.product.category,
      score: analysis.score,
      confidence: analysis.confidence,
      tags: analysis.tags,
      flags: analysis.flags,
      benefits: analysis.benefits,
      preferenceHits: analysis.preferenceHits,
      warnings: analysis.warnings,
      sources: analysis.sources.map((source) => ({
        type: source.sourceType,
        authority: source.authorityWeight,
        fields: source.fields
      }))
    }, null, 2)
  ].join("\n");

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

export async function askGeminiQuestion(question, analysis, settings, compareTarget = null) {
  if (!settings.geminiApiKey) {
    return {
      answer: "Add a Gemini API key in ScanCart settings to enable the assistant. The rule-based score is still active without it."
    };
  }

  const prompt = [
    "You are ScanCart's product assistant.",
    "Answer in JSON only with a single key named answer.",
    "Base your answer only on the structured evidence below.",
    "Stay practical, concise, and non-medical.",
    compareTarget ? "The user is comparing two products." : "The user is asking about the current product.",
    "",
    JSON.stringify({
      question,
      product: analysis,
      compareTarget
    }, null, 2)
  ].join("\n");

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
