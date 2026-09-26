const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { ok } = require("../utils/response");

function toInt(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

function toFloat(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toArray(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim());
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

exports.getProfile = asyncHandler(async (req, res) => {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, plan: true, googleId: true, createdAt: true },
    }),
    prisma.nutritionProfile.findUnique({ where: { userId: req.user.id } }),
  ]);
  ok(res, { user, profile });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const body = req.body;

  const profileData = {};
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined;

  const age = toInt(body.age);
  const heightCm = toFloat(body.heightCm);
  const currentWeightKg = toFloat(body.currentWeightKg);
  const targetWeightKg = toFloat(body.targetWeightKg);
  const calorieGoal = toInt(body.calorieGoal);
  const proteinGoal = toInt(body.proteinGoal);
  const carbGoal = toInt(body.carbGoal);
  const fatGoal = toInt(body.fatGoal);
  const hydrationGoalGlasses = toInt(body.hydrationGoalGlasses);

  if (body.gender !== undefined) profileData.gender = body.gender === "" ? null : String(body.gender);
  if (age !== undefined && (age < 1 || age > 130)) throw new ApiError(422, "VALIDATION_ERROR", "Age must be between 1 and 130.");
  if (age !== undefined) profileData.age = age;
  if (heightCm !== undefined && (heightCm < 50 || heightCm > 260)) throw new ApiError(422, "VALIDATION_ERROR", "Height must be a valid number in cm.");
  if (heightCm !== undefined) profileData.heightCm = heightCm;
  if (currentWeightKg !== undefined && (currentWeightKg < 20 || currentWeightKg > 500)) throw new ApiError(422, "VALIDATION_ERROR", "Current weight must be a valid number in kg.");
  if (currentWeightKg !== undefined) profileData.currentWeightKg = currentWeightKg;
  if (targetWeightKg !== undefined && (targetWeightKg < 20 || targetWeightKg > 500)) throw new ApiError(422, "VALIDATION_ERROR", "Target weight must be a valid number in kg.");
  if (targetWeightKg !== undefined) profileData.targetWeightKg = targetWeightKg;
  if (body.activityLevel !== undefined) profileData.activityLevel = String(body.activityLevel);
  if (calorieGoal !== undefined) profileData.calorieGoal = Math.max(800, Math.min(8000, calorieGoal));
  if (proteinGoal !== undefined) profileData.proteinGoal = Math.max(10, Math.min(500, proteinGoal));
  if (carbGoal !== undefined) profileData.carbGoal = Math.max(10, Math.min(900, carbGoal));
  if (fatGoal !== undefined) profileData.fatGoal = Math.max(5, Math.min(400, fatGoal));
  if (hydrationGoalGlasses !== undefined) profileData.hydrationGoalGlasses = Math.max(1, Math.min(30, hydrationGoalGlasses));
  const dietaryPreferences = toArray(body.dietaryPreferences);
  if (dietaryPreferences !== undefined) profileData.dietaryPreferences = dietaryPreferences;
  const allergies = toArray(body.allergies);
  if (allergies !== undefined) profileData.allergies = allergies;

  if (Object.keys(profileData).length > 0) {
    await prisma.nutritionProfile.upsert({
      where: { userId },
      update: profileData,
      create: { userId, ...profileData },
    });
  }
  if (name) {
    await prisma.user.update({ where: { id: userId }, data: { name } });
  }

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, plan: true, googleId: true, createdAt: true },
    }),
    prisma.nutritionProfile.findUnique({ where: { userId } }),
  ]);

  ok(res, { user, profile });
});