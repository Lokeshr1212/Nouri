const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const { toDateOnly, todayUTC, addDays } = require("../utils/date");
const { generateDietPlan } = require("../services/dietPlanService");

function serializeMeal(meal) {
  return {
    id: meal.id,
    name: meal.name,
    description: meal.description,
    mealType: meal.mealType,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fats: meal.fats,
    scheduledDate: meal.scheduledDate instanceof Date ? meal.scheduledDate.toISOString().slice(0, 10) : meal.scheduledDate,
    scheduledTime: meal.scheduledTime,
  };
}

function serializePlan(plan) {
  return {
    id: plan.id,
    startDate: plan.startDate instanceof Date ? plan.startDate.toISOString().slice(0, 10) : plan.startDate,
    endDate: plan.endDate instanceof Date ? plan.endDate.toISOString().slice(0, 10) : plan.endDate,
    dailyCalorieTarget: plan.dailyCalorieTarget,
    proteinTarget: plan.proteinTarget,
    plantVarietyTarget: plan.plantVarietyTarget,
    notes: plan.notes,
  };
}

async function getProfileTargets(userId) {
  const profile = await prisma.nutritionProfile.findUnique({ where: { userId } });
  return {
    calorieTarget: profile?.calorieGoal || 2000,
    proteinTarget: profile?.proteinGoal || 120,
    plantVarietyTarget: profile?.plantVarietyTarget || 30,
    preferences: profile?.dietaryPreferences || [],
    allergies: profile?.allergies || [],
  };
}

async function loadPlan(userId, planId) {
  if (planId) {
    return prisma.dietPlan.findFirst({ where: { id: planId, userId } });
  }
  const today = toDateOnly(todayUTC());
  const active = await prisma.dietPlan.findFirst({
    where: { userId, startDate: { lte: today }, endDate: { gte: today } },
    orderBy: { startDate: "desc" },
  });
  if (active) return active;
  return prisma.dietPlan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
}

function groupDays(plan, meals) {
  const byDay = {};
  for (const meal of meals) {
    const date = meal.scheduledDate instanceof Date ? meal.scheduledDate.toISOString().slice(0, 10) : meal.scheduledDate;
    if (!byDay[date]) byDay[date] = [];
    byDay[date].push(serializeMeal(meal));
  }
  const days = [];
  let cursor = plan.startDate instanceof Date ? plan.startDate.toISOString().slice(0, 10) : plan.startDate;
  const end = plan.endDate instanceof Date ? plan.endDate.toISOString().slice(0, 10) : plan.endDate;
  while (cursor <= end) {
    days.push({ date: cursor, meals: byDay[cursor] || [] });
    cursor = addDays(cursor, 1);
  }
  return days;
}

exports.getPlan = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const plan = await loadPlan(userId, req.query.planId);
  if (!plan) {
    return ok(res, { plan: null, days: [], targets: await getProfileTargets(userId) });
  }
  const meals = await prisma.meal.findMany({
    where: { userId, dietPlanId: plan.id },
    orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
  });
  ok(res, {
    plan: serializePlan(plan),
    days: groupDays(plan, meals),
    targets: {
      calorieTarget: plan.dailyCalorieTarget,
      proteinTarget: plan.proteinTarget,
      plantVarietyTarget: plan.plantVarietyTarget,
    },
  });
});

exports.createPlan = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profileTargets = await getProfileTargets(userId);
  const today = todayUTC();

  const calorieTarget = Math.max(1000, Math.min(6000, Number(req.body.dailyCalorieTarget) || profileTargets.calorieTarget));
  const proteinTarget = Math.max(30, Math.min(400, Number(req.body.proteinTarget) || profileTargets.proteinTarget));
  const plantVarietyTarget = Math.max(10, Math.min(60, Number(req.body.plantVarietyTarget) || profileTargets.plantVarietyTarget));

  const startBase = toDateOnly(req.body.startDate || today);
  if (!startBase) throw new ApiError(422, "INVALID_DATE", "A valid startDate is required.");
  const start = startBase.toISOString().slice(0, 10);
  const end = addDays(start, 6);

  const generated = await generateDietPlan({
    calorieTarget,
    proteinTarget,
    plantVarietyTarget,
    preferences: profileTargets.preferences,
    allergies: profileTargets.allergies,
    startDate: start,
    days: 7,
  });

  const plan = await prisma.dietPlan.create({
    data: {
      userId,
      startDate: toDateOnly(start),
      endDate: toDateOnly(end),
      dailyCalorieTarget: calorieTarget,
      proteinTarget,
      plantVarietyTarget,
      notes: req.body.notes || null,
      meals: { create: generated.dayPlans.flatMap((day) => day.meals.map((m) => ({
        userId,
        name: m.name,
        description: m.description,
        mealType: m.mealType,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fats: m.fats,
        scheduledDate: toDateOnly(m.scheduledDate),
        scheduledTime: m.scheduledTime || null,
      }))) },
    },
    include: { meals: true },
  });

  ok(res, {
    plan: serializePlan(plan),
    days: groupDays(plan, plan.meals),
    targets: { calorieTarget, proteinTarget, plantVarietyTarget },
    source: generated.source,
  }, 201);
});

exports.updatePlan = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const plan = await prisma.dietPlan.findFirst({ where: { id, userId } });
  if (!plan) throw new ApiError(404, "NOT_FOUND", "Diet plan not found.");

  const data = {};
  if (req.body.dailyCalorieTarget !== undefined) data.dailyCalorieTarget = Math.max(1000, Math.min(6000, Number(req.body.dailyCalorieTarget) || plan.dailyCalorieTarget));
  if (req.body.proteinTarget !== undefined) data.proteinTarget = Math.max(30, Math.min(400, Number(req.body.proteinTarget) || plan.proteinTarget));
  if (req.body.plantVarietyTarget !== undefined) data.plantVarietyTarget = Math.max(10, Math.min(60, Number(req.body.plantVarietyTarget) || plan.plantVarietyTarget));
  if (req.body.notes !== undefined) data.notes = req.body.notes || null;

  const updated = await prisma.dietPlan.update({
    where: { id: plan.id },
    data,
    include: {
      meals: {
        where: { userId },
        orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
      },
    },
  });

  ok(res, {
    plan: serializePlan(updated),
    days: groupDays(updated, updated.meals),
    targets: {
      calorieTarget: updated.dailyCalorieTarget,
      proteinTarget: updated.proteinTarget,
      plantVarietyTarget: updated.plantVarietyTarget,
    },
  });
});

exports.refreshPlan = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const plan = await prisma.dietPlan.findFirst({ where: { id, userId } });
  if (!plan) throw new ApiError(404, "NOT_FOUND", "Diet plan not found.");

  const start = plan.startDate instanceof Date ? plan.startDate.toISOString().slice(0, 10) : plan.startDate;
  const end = plan.endDate instanceof Date ? plan.endDate.toISOString().slice(0, 10) : plan.endDate;
  const daysCount = Math.round((toDateOnly(end) - toDateOnly(start)) / 86400000) + 1;

  const profile = await prisma.nutritionProfile.findUnique({ where: { userId } });
  const generated = await generateDietPlan({
    calorieTarget: plan.dailyCalorieTarget,
    proteinTarget: plan.proteinTarget,
    plantVarietyTarget: plan.plantVarietyTarget,
    preferences: profile?.dietaryPreferences || [],
    allergies: profile?.allergies || [],
    startDate: start,
    days: daysCount,
  });

  await prisma.$transaction([
    prisma.meal.deleteMany({ where: { dietPlanId: plan.id } }),
    prisma.meal.createMany({
      data: generated.dayPlans.flatMap((day) => day.meals.map((m) => ({
        userId,
        dietPlanId: plan.id,
        name: m.name,
        description: m.description,
        mealType: m.mealType,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fats: m.fats,
        scheduledDate: toDateOnly(m.scheduledDate),
        scheduledTime: m.scheduledTime || null,
      }))),
    }),
  ]);

  const meals = await prisma.meal.findMany({
    where: { userId, dietPlanId: plan.id },
    orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
  });

  ok(res, {
    plan: serializePlan(plan),
    days: groupDays(plan, meals),
    targets: {
      calorieTarget: plan.dailyCalorieTarget,
      proteinTarget: plan.proteinTarget,
      plantVarietyTarget: plan.plantVarietyTarget,
    },
    source: generated.source,
  });
});

exports.deletePlan = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const plan = await prisma.dietPlan.findFirst({ where: { id, userId } });
  if (!plan) throw new ApiError(404, "NOT_FOUND", "Diet plan not found.");

  await prisma.$transaction([
    prisma.meal.deleteMany({ where: { dietPlanId: plan.id } }),
    prisma.dietPlan.delete({ where: { id: plan.id } }),
  ]);

  ok(res, { message: "Diet plan deleted." });
});