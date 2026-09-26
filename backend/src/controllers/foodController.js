const fs = require("fs");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const { toDateOnly, todayUTC } = require("../utils/date");
const foodAnalysisService = require("../services/foodAnalysisService");
const nutritionService = require("../services/nutritionService");

exports.analyze = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, "IMAGE_REQUIRED", "Please choose a meal photo to analyse.");

  const buffer = fs.readFileSync(req.file.path);
  const result = await foodAnalysisService.analyzeFoodImage({
    buffer,
    mimeType: req.file.mimetype,
    imagePath: req.file.path,
    originalName: req.file.originalname,
  });

  ok(res, {
    ...result,
    imageUrl: `/uploads/${req.file.filename}`,
  });
});

exports.log = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    foodName,
    mealType = "snack",
    calories,
    protein,
    carbs,
    fats,
    servingSize,
    loggedAt,
  } = req.body;

  if (!foodName || !String(foodName).trim()) {
    throw new ApiError(422, "FOOD_NAME_REQUIRED", "Please enter a food name.");
  }

  const hasNutrition = [calories, protein, carbs, fats].some((v) => v !== undefined && v !== null && v !== "");
  let enriched = null;

  let final = {
    foodName: String(foodName).trim(),
    mealType: escapeMealType(mealType),
  };

  if (hasNutrition) {
    final.calories = Math.max(0, Math.round(Number(calories) || 0));
    final.protein = Number(protein) || 0;
    final.carbs = Number(carbs) || 0;
    final.fats = Number(fats) || 0;
    final.servingSize = servingSize || null;
    final.source = "manual";
  } else {
    enriched = await nutritionService.getNutrition(final.foodName);
    final.calories = enriched.calories;
    final.protein = enriched.protein;
    final.carbs = enriched.carbs;
    final.fats = enriched.fats;
    final.servingSize = enriched.serving || null;
    final.source = "auto";
  }

  if (!final.calories) {
    throw new ApiError(422, "NUTRITION_UNKNOWN", "We could not estimate nutrition for that food. Add calories, or use the photo analysis instead.");
  }

  const date = toDateOnly(loggedAt || todayUTC());

  const entry = await prisma.foodLog.create({
    data: {
      userId,
      foodName: final.foodName,
      mealType: final.mealType,
      calories: final.calories,
      protein: final.protein,
      carbs: final.carbs,
      fats: final.fats,
      servingSize: final.servingSize,
      source: final.source,
      loggedAt: date,
    },
  });

  ok(res, { log: entry, enriched, source: final.source }, 201);
});

function escapeMealType(value) {
  const type = String(value || "snack").toLowerCase().trim();
  if (["breakfast", "lunch", "dinner", "snack"].includes(type)) return type;
  return "snack";
}