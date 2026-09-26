const env = require("../config/env");
const { hashCode } = require("../utils/crypto");
const ApiError = require("../utils/ApiError");

const PROMPT = `You are Nouri, an expert nutritionist analysing a food photo.
Examine the image and return a JSON object with exactly this shape:
{
  "foodName": "<short descriptive name>",
  "confidence": <0-100 integer>,
  "calories": <integer kcal estimate>,
  "protein": <grams number>,
  "carbs": <grams number>,
  "fats": <grams number>,
  "ingredients": ["<top 5-8 likely ingredients>"],
  "servingSize": "<human readable serving e.g. 1 bowl (350g)>"
}
Rules:
- Estimate the whole plate/dish in the image.
- Be honest about uncertainty; lower confidence when unsure.
- Do not include anything other than the JSON.`;

async function analyzeWithGemini(imageBuffer, mimeType) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.geminiModel
  )}:generateContent`;

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBuffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
    },
  };

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.geminiApiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(502, "AI_UNREACHABLE", "Could not reach the AI provider. Check your network settings.");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[gemini]", response.status, text.slice(0, 500));
    if (response.status === 400) {
      throw new ApiError(502, "AI_BAD_REQUEST", `The AI provider rejected the request (check GEMINI_MODEL).`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(502, "AI_UNAUTHORIZED", "The AI provider rejected the API key. Check GEMINI_API_KEY.");
    }
    throw new ApiError(502, "AI_ERROR", "The AI provider returned an error while analysing the image.");
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) throw new ApiError(502, "AI_NO_RESULT", "The AI provider returned no analysis.");

  return parseAiJson(text, { source: "gemini" });
}

function parseAiJson(text, extra) {
  try {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const calories = Math.max(0, Math.round(Number(parsed.calories) || 0));
    const protein = Math.max(0, Number(parsed.protein) || 0);
    const carbs = Math.max(0, Number(parsed.carbs) || 0);
    const fats = Math.max(0, Number(parsed.fats) || 0);
    const confidence = Math.min(100, Math.max(0, Math.round(Number(parsed.confidence) || 0)));
    if (calories <= 0) throw new Error("missing calories");
    return {
      foodName: String(parsed.foodName || "Analysed meal").slice(0, 120),
      confidence,
      calories,
      protein,
      carbs,
      fats,
      ingredients: Array.isArray(parsed.ingredients)
        ? parsed.ingredients.slice(0, 10).map((i) => String(i)).filter(Boolean)
        : [],
      servingSize: String(parsed.servingSize || "1 serving"),
      ...extra,
    };
  } catch (error) {
    throw new ApiError(502, "AI_BAD_RESPONSE", "The AI provider returned an unreadable response.");
  }
}

async function analyzeWithMock(imagePath, originalName = "") {
  const seed = hashCode(`${imagePath}:${originalName}`);
  const templates = [
    { name: "Garden protein bowl", calories: 486, protein: 38, carbs: 52, fats: 16, ingredients: ["grilled chicken", "greens", "quinoa", "tomato", "avocado", "olive oil"], serving: "1 bowl (420g)" },
    { name: "Breakfast bowl", calories: 432, protein: 24, carbs: 58, fats: 12, ingredients: ["oats", "berries", "almond butter", "banana", "chia seeds"], serving: "1 bowl (360g)" },
    { name: "Harissa chickpea traybake", calories: 510, protein: 26, carbs: 64, fats: 18, ingredients: ["chickpeas", "harissa", "bell pepper", "onion", "olive oil", "herbs"], serving: "1 plate (450g)" },
    { name: "Herbed eggs on toast", calories: 405, protein: 28, carbs: 34, fats: 18, ingredients: ["eggs", "sourdough", "spinach", "herbs", "butter"], serving: "2 slices (280g)" },
    { name: "Rainbow falafel wrap", calories: 514, protein: 21, carbs: 62, fats: 21, ingredients: ["falafel", "wholegrain wrap", "hummus", "cucumber", "carrot", "red cabbage"], serving: "1 wrap (330g)" },
    { name: "Ginger salmon rice bowl", calories: 574, protein: 39, carbs: 66, fats: 19, ingredients: ["salmon", "rice", "ginger", "broccoli", "sesame", "soy"], serving: "1 bowl (460g)" },
    { name: "Yogurt, berries & seeds", calories: 238, protein: 15, carbs: 30, fats: 7, ingredients: ["greek yogurt", "berries", "granola", "chia seeds", "honey"], serving: "1 cup (250g)" },
  ];
  const template = templates[seed % templates.length];
  const variety = seed % 3 === 0 ? 1 : seed % 3 === 1 ? 0 : -1;
  const calories = Math.max(150, template.calories + variety * 34);
  const factor = calories / template.calories;
  const confidence = 76 + (seed % 19);

  return {
    foodName: template.name,
    confidence,
    calories,
    protein: Math.round(template.protein * factor),
    carbs: Math.round(template.carbs * factor),
    fats: Math.round(template.fats * factor),
    ingredients: template.ingredients,
    servingSize: template.serving,
    source: "mock",
    mock: true,
  };
}

async function analyzeFoodImage({ buffer, mimeType, imagePath, originalName }) {
  const mime = mimeType || "image/jpeg";
  if (env.aiProvider === "gemini" && env.geminiApiKey) {
    try {
      const result = await analyzeWithGemini(buffer, mime);
      result.source = "gemini";
      return result;
    } catch (error) {
      if (env.nodeEnv === "production") throw error;
      console.error("[food][analyze] Gemini failed — falling back to mock:", error.message);
      const result = analyzeWithMock(imagePath, originalName);
      result.mock = true;
      return result;
    }
  }
  return analyzeWithMock(imagePath, originalName);
}

module.exports = { analyzeFoodImage, analyzeWithGemini, analyzeWithMock };