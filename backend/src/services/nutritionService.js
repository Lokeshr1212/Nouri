const { hashCode } = require("../utils/crypto");

const FOOD_DB = [
  { foodName: "oats", calories: 150, protein: 5, carbs: 27, fats: 3, serving: "1 bowl (40g dry)" },
  { foodName: "oatmeal", calories: 150, protein: 5, carbs: 27, fats: 3, serving: "1 bowl (40g dry)" },
  { foodName: "egg", calories: 78, protein: 6, carbs: 1, fats: 5, serving: "1 large egg" },
  { foodName: "banana", calories: 105, protein: 1, carbs: 27, fats: 0, serving: "1 medium banana" },
  { foodName: "apple", calories: 95, protein: 0, carbs: 25, fats: 0, serving: "1 medium apple" },
  { foodName: "chicken breast", calories: 165, protein: 31, carbs: 0, fats: 4, serving: "100g cooked" },
  { foodName: "salmon", calories: 208, protein: 20, carbs: 0, fats: 13, serving: "100g cooked" },
  { foodName: "rice", calories: 130, protein: 3, carbs: 28, fats: 0, serving: "1 cup cooked" },
  { foodName: "brown rice", calories: 216, protein: 5, carbs: 45, fats: 2, serving: "1 cup cooked" },
  { foodName: "pasta", calories: 220, protein: 8, carbs: 43, fats: 1, serving: "1 cup cooked" },
  { foodName: "potato", calories: 161, protein: 4, carbs: 37, fats: 0, serving: "1 medium (150g)" },
  { foodName: "sweet potato", calories: 112, protein: 2, carbs: 26, fats: 0, serving: "1 medium (130g)" },
  { foodName: "broccoli", calories: 55, protein: 4, carbs: 11, fats: 1, serving: "1 cup" },
  { foodName: "spinach", calories: 23, protein: 3, carbs: 4, fats: 0, serving: "2 cups" },
  { foodName: "avocado", calories: 240, protein: 3, carbs: 12, fats: 22, serving: "1 whole" },
  { foodName: "toast", calories: 128, protein: 4, carbs: 25, fats: 1, serving: "1 slice" },
  { foodName: "bread", calories: 128, protein: 4, carbs: 25, fats: 1, serving: "1 slice" },
  { foodName: "yogurt", calories: 100, protein: 10, carbs: 11, fats: 2, serving: "1 cup plain" },
  { foodName: "greek yogurt", calories: 100, protein: 17, carbs: 6, fats: 1, serving: "170g tub" },
  { foodName: "almond", calories: 164, protein: 6, carbs: 6, fats: 14, serving: "28g (23 almonds)" },
  { foodName: "chocolate", calories: 220, protein: 3, carbs: 24, fats: 13, serving: "1 bar (40g)" },
  { foodName: "protein shake", calories: 180, protein: 25, carbs: 8, fats: 3, serving: "1 scoop + water" },
  { foodName: "lentils", calories: 230, protein: 18, carbs: 40, fats: 1, serving: "1 cup cooked" },
  { foodName: "chickpeas", calories: 269, protein: 15, carbs: 45, fats: 4, serving: "1 cup cooked" },
  { foodName: "salad", calories: 150, protein: 5, carbs: 12, fats: 10, serving: "1 large bowl" },
  { foodName: "soup", calories: 180, protein: 10, carbs: 22, fats: 6, serving: "1 bowl" },
  { foodName: "sandwich", calories: 380, protein: 18, carbs: 44, fats: 14, serving: "1 sandwich" },
  { foodName: "pizza", calories: 285, protein: 12, carbs: 36, fats: 10, serving: "1 slice" },
  { foodName: "burger", calories: 500, protein: 25, carbs: 40, fats: 25, serving: "1 burger" },
  { foodName: "coffee", calories: 5, protein: 0, carbs: 1, fats: 0, serving: "1 cup black" },
  { foodName: "tea", calories: 2, protein: 0, carbs: 0, fats: 0, serving: "1 cup" },
];

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const BY_KEY_LENGTH_DESC = [...FOOD_DB].sort(
  (a, b) => normalize(b.foodName).length - normalize(a.foodName).length
);

function lookupFood(foodName) {
  const normalized = normalize(foodName);
  if (!normalized) return null;
  for (const item of BY_KEY_LENGTH_DESC) {
    const key = normalize(item.foodName);
    if (normalized === key || normalized.includes(key) || key.includes(normalized)) {
      return { ...item, source: "mock" };
    }
  }
  return null;
}

function estimate(foodName) {
  const normalized = normalize(foodName);
  const seed = hashCode(normalized);
  const calories = 120 + (seed % 480);
  const protein = Math.round(calories * (0.12 + (seed % 11) / 100));
  const carbs = Math.round(calories * (0.35 + (seed % 15) / 100));
  const fats = Math.round(calories * (0.2 + (seed % 14) / 100));
  return {
    foodName: foodName.trim().slice(0, 120),
    calories,
    protein,
    carbs,
    fats,
    serving: "1 serving (approx.)",
    source: "estimation",
  };
}

async function getNutrition(foodName) {
  const match = lookupFood(foodName);
  if (match) return match;
  return estimate(foodName);
}

module.exports = { getNutrition, lookupFood, estimate };