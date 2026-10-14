import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Evaluation from "@/lib/Evaluation";

export const dynamic = "force-dynamic";

type RecordItem = {
  model: string;
  organization: string;
  benchmark: string;
  score: number;
  metric: string;
  category: string;
};

function inferCategories(work: string) {
  const value = work.toLowerCase();
  const weights: Record<string, number> = { Reasoning: 0, Coding: 0, Knowledge: 0, Safety: 0 };
  const terms: Record<string, string[]> = {
    Coding: ["code", "coding", "program", "software", "develop", "developer", "debug", "website", "app", "script", "repository", "repo", "sql", "python", "javascript"],
    Reasoning: ["reason", "math", "calculate", "logic", "solve", "plan", "analyze", "analysis", "step-by-step", "problem", "proof"],
    Knowledge: ["research", "fact", "knowledge", "study", "learn", "explain", "summarize", "document", "answer", "question", "academic"],
    Safety: ["safe", "safety", "moderate", "moderation", "harm", "policy", "risk", "sensitive", "trust", "customer support"],
  };
  for (const [category, words] of Object.entries(terms)) {
    weights[category] = words.reduce((score, word) => score + (value.includes(word) ? (word.includes(" ") ? 2 : 1) : 0), 0);
  }
  const max = Math.max(...Object.values(weights));
  const categories = max === 0 ? ["Reasoning", "Coding", "Knowledge", "Safety"] : Object.entries(weights).filter(([, score]) => score > 0).map(([name]) => name);
  return { categories, weights };
}

function rankModels(records: RecordItem[], categories: string[]) {
  const groups = new Map<string, RecordItem[]>();
  for (const record of records) {
    const group = groups.get(record.model) ?? [];
    group.push(record);
    groups.set(record.model, group);
  }
  return [...groups.entries()].map(([model, items]) => {
    const matching = items.filter((item) => categories.includes(item.category));
    const evidence = matching.length ? matching : items;
    const average = evidence.reduce((sum, item) => sum + item.score, 0) / evidence.length;
    return {
      model,
      organization: items[0].organization,
      average: Math.round(average * 10) / 10,
      evidence: evidence.slice().sort((a, b) => b.score - a.score).slice(0, 3).map(({ benchmark, metric, score, category }) => ({ benchmark, metric, score, category })),
      demo: model.startsWith("Demo ·") || model.startsWith("Demo -"),
    };
  }).sort((a, b) => b.average - a.average).slice(0, 8);
}

function extractResponseText(data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }) {
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => typeof part.text === "string" ? part.text : "").join("\n").trim();
}

/** Models to try in order when the primary model is unavailable (503). */
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3-flash-preview"];

async function callGemini(apiKey: string, primaryModel: string, payload: object): Promise<{ response?: Response; model: string; error?: string }> {
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter((m) => m !== primaryModel)];
  for (const model of modelsToTry) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000),
      });
      if (response.status === 503) {
        console.warn(`Gemini model ${model} returned 503 (high demand), trying next fallback...`);
        continue;
      }
      return { response, model };
    } catch (err) {
      console.warn(`Gemini model ${model} request failed:`, err instanceof Error ? err.message : "unknown");
      continue;
    }
  }
  return { model: primaryModel, error: "All Gemini models are currently unavailable due to high demand. Please try again later." };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const work = typeof body.work === "string" ? body.work.trim() : "";
    if (work.length < 12 || work.length > 1200) {
      return NextResponse.json({ error: "Describe your work in 12 to 1,200 characters." }, { status: 400 });
    }

    await connectToDatabase();
    const records = await Evaluation.find().select("model organization benchmark score metric category").limit(300).lean() as unknown as RecordItem[];
    if (!records.length) return NextResponse.json({ error: "Add evaluation cards before asking for a recommendation." }, { status: 404 });

    const { categories } = inferCategories(work);
    const candidates = rankModels(records, categories);
    if (!candidates.length) return NextResponse.json({ error: "There are no models with evaluation results to compare yet." }, { status: 404 });

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    let aiNotice = apiKey ? "" : "Gemini is not configured yet. Add GEMINI_API_KEY to .env.local and restart the app to get Gemini recommendations.";
    let quotaInfo = false;
    if (apiKey) {
      const primaryModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
      const payload = {
        systemInstruction: { parts: [{ text: "You are Evalboard's model-selection assistant. Choose exactly one model from the supplied candidates for the user's stated work. Only use the supplied evaluation evidence. Do not claim benchmarks predict every real task, do not treat unlike benchmarks as directly comparable, and mention when the evidence is demo data. Return concise JSON only with keys model and reason. The model value must exactly match one candidate's model field." }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ work, relevantAreas: categories, candidates }) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 300 },
      };
      const { response, model, error: callError } = await callGemini(apiKey, primaryModel, payload);
      if (callError) {
        aiNotice = callError;
      } else if (response && !response.ok) {
        let errorStatus = "unknown_error";
        try {
          const errorBody = await response.json();
          if (typeof errorBody?.error?.status === "string") errorStatus = errorBody.error.status;
        } catch { /* Keep the diagnostic generic if the error body is not JSON. */ }
        console.error("Gemini recommendation request failed:", response.status, errorStatus);
        if (response.status === 429 || errorStatus === "RESOURCE_EXHAUSTED") {
          aiNotice = "Gemini API quota or rate limit was reached. Check your Google AI Studio usage and try again.";
          quotaInfo = true;
        } else if (response.status === 401 || response.status === 403 || errorStatus === "PERMISSION_DENIED" || errorStatus === "UNAUTHENTICATED") {
          aiNotice = "Gemini rejected the API key. Check GEMINI_API_KEY and make sure the Gemini API is enabled for its Google project.";
        } else if (response.status === 404 || errorStatus === "NOT_FOUND") {
          aiNotice = `The configured Gemini model (${model}) is unavailable. Check GEMINI_MODEL and your model access.`;
        } else {
          aiNotice = "Gemini could not complete this request. Check the API key, model access, and usage limits; this match uses evaluation data instead.";
        }
      } else if (response) {
        const result = await response.json();
        const text = extractResponseText(result);
        try {
          const parsed = JSON.parse(text) as { model?: unknown; reason?: unknown };
          const recommendation = candidates.find((candidate) => candidate.model === parsed.model);
          if (recommendation && typeof parsed.reason === "string") {
            return NextResponse.json({ mode: "ai", model: `Gemini · ${model}`, categories, recommendation, reason: parsed.reason, candidates });
          }
        } catch { /* Use the local evidence-based match when the model response is not valid JSON. */ }
        aiNotice = "Gemini returned an unusable response, so this match uses your evaluation data instead.";
      }
    }

    const recommendation = candidates[0];
    const areas = [...new Set(recommendation.evidence.map((item) => item.category))].join(" and ");
    const reason = `${recommendation.model} has the strongest average score in the available ${areas} evaluation records (${recommendation.average} across ${recommendation.evidence.length} shown result${recommendation.evidence.length === 1 ? "" : "s"}). Treat this as a starting point: benchmark scores are only a proxy for your specific workflow.`;
    return NextResponse.json({ mode: "data-match", model: null, categories, recommendation, reason, candidates, aiNotice, quotaInfo });
  } catch (error) {
    console.error("Could not make a model recommendation:", error);
    return NextResponse.json({ error: "Could not load evaluation data. Check the MongoDB connection and try again." }, { status: 503 });
  }
}
