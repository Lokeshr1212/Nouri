const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const MEAL_LIBRARY = {
  breakfast: [
    { name: "Herbed eggs on toast", description: "26g protein · ready in 10 min", calories: 405, protein: 28, carbs: 34, fats: 18, emoji: "🍳" },
    { name: "Berry oats bowl", description: "Fibre-rich · fresh berries", calories: 432, protein: 24, carbs: 58, fats: 12 },
    { name: "Avo toast & eggs", description: "Healthy fats · wholegrain", calories: 445, protein: 22, carbs: 36, fats: 24 },
    { name: "Banana pancakes", description: "Soft & satisfying", calories: 386, protein: 16, carbs: 62, fats: 9 },
    { name: "Yogurt berry parfait", description: "Layered protein breakfast", calories: 348, protein: 23, carbs: 42, fats: 9 },
  ],
  lunch: [
    { name: "Rainbow falafel wrap", description: "Fresh, filling, fibre-forward", calories: 514, protein: 21, carbs: 62, fats: 21 },
    { name: "Garden protein bowl", description: "Chicken, greens & grains", calories: 486, protein: 38, carbs: 52, fats: 16 },
    { name: "Red lentil soup", description: "Comforting & hearty", calories: 380, protein: 20, carbs: 52, fats: 10 },
    { name: "Coconut curry bowl", description: "Veg-packed, mildly spiced", calories: 520, protein: 18, carbs: 60, fats: 22 },
    { name: "Lemon pasta salad", description: "Bright & balanced", calories: 460, protein: 17, carbs: 62, fats: 16 },
  ],
  dinner: [
    { name: "Harissa chickpea traybake", description: "Yogurt, greens & herbs", calories: 510, protein: 26, carbs: 64, fats: 18 },
    { name: "Ginger salmon rice bowl", description: "Omega-3 rich · meal-prep friendly", calories: 574, protein: 39, carbs: 66, fats: 19 },
    { name: "Taco bowl", description: "Spiced, crunchy, colourful", calories: 540, protein: 30, carbs: 58, fats: 20 },
    { name: "Homemade pizza", description: "Wholegrain base & veg toppings", calories: 580, protein: 24, carbs: 70, fats: 22 },
    { name: "Chicken & veg stir-fry", description: "Quick, lean & saucy", calories: 490, protein: 36, carbs: 46, fats: 17 },
  ],
  snack: [
    { name: "Yogurt, berries & seeds", description: "Sweet, satisfying, balanced", calories: 238, protein: 15, carbs: 30, fats: 7 },
    { name: "Dark chocolate square", description: "Afternoon pick-me-up", calories: 168, protein: 3, carbs: 16, fats: 11 },
    { name: "Apple & almond butter", description: "Crunchy & energising", calories: 210, protein: 6, carbs: 28, fats: 10 },
    { name: "Protein smoothie", description: "Berry & banana blend", calories: 220, protein: 25, carbs: 24, fats: 4 },
  ],
};

const SNACK_TIMES = {
  breakfast: "08:00",
  lunch: "13:00",
  dinner: "19:30",
  snack: "16:30",
};

function pickMeals(targets, seed) {
  const breakfast = pick(MEAL_LIBRARY.breakfast, seed + 1);
  const lunch = pick(MEAL_LIBRARY.lunch, seed + 2);
  const dinner = pick(MEAL_LIBRARY.dinner, seed + 3);
  const snack = pick(MEAL_LIBRARY.snack, seed + 4);
  const meals = [breakfast, lunch, dinner, snack];
  const total = meals.reduce((sum, m) => sum + m.calories, 0);
  const scale = targets.calorieTarget / total;
  return meals
    .filter(Boolean)
    .slice(0, targets.includeSnacks === false ? 3 : 4)
    .map((m, i) => ({
      name: m.name,
      description: m.description,
      mealType: TIMES[i],
      calories: Math.max(100, Math.round(m.calories * scale)),
      protein: Math.max(1, Math.round(m.protein * scale)),
      carbs: Math.max(1, Math.round(m.carbs * scale)),
      fats: Math.max(1, Math.round(m.fats * scale)),
      scheduledTime: SNACK_TIMES[TIMES[i]],
    }));
}

const TIMES = ["breakfast", "lunch", "dinner", "snack"];

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function generateMockPlan({ calorieTarget = 2000, proteinTarget = 120, seed = 0, startDate, days = 7 }) {
  const dayPlans = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(`${startDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + i);
    const daySeed = seed + i * 7;
    const meals = pickMeals({ calorieTarget, includeSnacks: true }, daySeed).map((m) => ({
      ...m,
      scheduledDate: date.toISOString().slice(0, 10),
    }));
    dayPlans.push({ date: date.toISOString().slice(0, 10), meals });
  }
  return { proteinTarget, dayPlans };
}

const GENERATE_PROMPT = (targets) => `You are Nouri, a nutritionist building a balanced weekly meal plan.
Goals: ${targets.calorieTarget} kcal/day, ${targets.proteinTarget}g protein/day, ${targets.plantVarietyTarget} plant varieties/week.
Dietary preferences: ${targets.preferences.join(", ") || "none"}.
Allergies: ${targets.allergies.join(", ") || "none"}.
Return a JSON object: {
  "meals": [
    { "scheduledDate": "YYYY-MM-DD", "mealType": "breakfast|lunch|dinner|snack", "name": "..", "description": "..", "calories": <int>, "protein": <g>, "carbs": <g>, "fats": <g>, "scheduledTime": "HH:MM" }
  ]
}
Include exactly 4 meals per day for ${targets.days} days starting ${targets.startDate}.
Avoid all allergens listed. Keep total daily calories within 5% of the target.`;

async function generateWithGemini(targets) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    env.geminiModel
  )}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: GENERATE_PROMPT(targets) }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048, responseMimeType: "application/json" },
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.geminiApiKey },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(502, "AI_ERROR", "The AI provider could not generate a meal plan.");
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.meals)) throw new ApiError(502, "AI_BAD_RESPONSE", "AI returned an unexpected plan format.");
  return parsed.meals.map((m, i) => ({
    scheduledDate: String(m.scheduledDate || targets.startDate).slice(0, 10),
    mealType: ["breakfast", "lunch", "dinner", "snack"].includes(m.mealType) ? m.mealType : "snack",
    name: String(m.name || "Planned meal").slice(0, 120),
    description: String(m.description || "").slice(0, 200),
    calories: Math.max(50, Math.round(Number(m.calories) || 0)),
    protein: Math.max(0, Number(m.protein) || 0),
    carbs: Math.max(0, Number(m.carbs) || 0),
    fats: Math.max(0, Number(m.fats) || 0),
    scheduledTime: /^\d{1,2}:\d{2}$/.test(m.scheduledTime || "") ? m.scheduledTime : "12:00",
    _sort: i,
  }));
}

async function generateDietPlan({ calorieTarget, proteinTarget, plantVarietyTarget, preferences, allergies, startDate, days = 7, seed = Date.now() }) {
  const safeTargets = {
    calorieTarget: Math.max(1000, Math.min(6000, Number(calorieTarget) || 2000)),
    proteinTarget: Math.max(30, Math.min(400, Number(proteinTarget) || 120)),
    plantVarietyTarget: Math.max(10, Math.min(60, Number(plantVarietyTarget) || 30)),
    preferences: Array.isArray(preferences) ? preferences : [],
    allergies: Array.isArray(allergies) ? allergies : [],
    startDate,
    days,
  };

  if (env.aiProvider === "gemini" && env.geminiApiKey) {
    try {
      const meals = await generateWithGemini(safeTargets);
      const byDay = {};
      for (const meal of meals) {
        if (!byDay[meal.scheduledDate]) byDay[meal.scheduledDate] = [];
        byDay[meal.scheduledDate].push(meal);
      }
      const ordering = { breakfast: 1, lunch: 2, dinner: 3, snack: 4 };
      for (const list of Object.values(byDay)) {
        list.sort((a, b) => (ordering[a.mealType] || 9) - (ordering[b.mealType] || 9));
      }
      return {
        proteinTarget: safeTargets.proteinTarget,
        dayPlans: Object.keys(byDay)
          .sort()
          .map((date) => ({ date, meals: byDay[date] })),
        source: "gemini",
      };
    } catch (error) {
      if (env.nodeEnv === "production") throw error;
      console.error("[diet-plan][gemini] Gemini failed — falling back to mock:", error.message);
      return { ...generateMockPlan(safeTargets), source: "mock", mock: true };
    }
  }

  return { ...generateMockPlan(safeTargets), source: "mock" };
}

module.exports = { generateDietPlan, generateMockPlan };