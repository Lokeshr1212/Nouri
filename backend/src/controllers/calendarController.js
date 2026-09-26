const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const { toDateOnly, todayUTC, startOfWeek, addDays, weekdayLabel } = require("../utils/date");

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
    dietPlanId: meal.dietPlanId,
    editable: Boolean(meal.dietPlanId),
    source: meal.dietPlanId ? "plan" : "manual",
  };
}

exports.getCalendar = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const today = todayUTC();
  const { startDate, endDate } = req.query;

  let start = startDate;
  let end = endDate;
  if (start && end) {
    const s = toDateOnly(String(start));
    const e = toDateOnly(String(end));
    if (!s || !e) throw new ApiError(422, "INVALID_DATE", "startDate and endDate must be valid dates (YYYY-MM-DD).");
    start = s.toISOString().slice(0, 10);
    end = e.toISOString().slice(0, 10);
  } else {
    start = startOfWeek(today);
    end = addDays(start, 6);
  }
  if (end < start) [start, end] = [end, start];

  const meals = await prisma.meal.findMany({
    where: { userId, scheduledDate: { gte: toDateOnly(start), lte: toDateOnly(end) } },
    orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
  });

  const byDay = {};
  for (const meal of meals) {
    const date = meal.scheduledDate instanceof Date ? meal.scheduledDate.toISOString().slice(0, 10) : meal.scheduledDate;
    if (!byDay[date]) byDay[date] = [];
    byDay[date].push(serializeMeal(meal));
  }

  const days = [];
  let cursor = start;
  while (cursor <= end) {
    days.push({
      date: cursor,
      weekday: weekdayLabel(cursor),
      isToday: cursor === today,
      meals: byDay[cursor] || [],
    });
    cursor = addDays(cursor, 1);
  }

  ok(res, { startDate: start, endDate: end, today, days });
});

exports.createMeal = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    name,
    description,
    mealType = "breakfast",
    calories = 0,
    protein,
    carbs,
    fats,
    scheduledDate,
    scheduledTime,
  } = req.body;

  const date = toDateOnly(scheduledDate || todayUTC());
  if (!date) throw new ApiError(422, "INVALID_DATE", "A valid scheduledDate is required (YYYY-MM-DD).");

  const meal = await prisma.meal.create({
    data: {
      userId,
      name: String(name || "Meal").trim(),
      description: description || null,
      mealType,
      calories: Math.max(0, Math.round(Number(calories) || 0)),
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fats: Number(fats) || 0,
      scheduledDate: date,
      scheduledTime: /^\d{1,2}:\d{2}/.test(String(scheduledTime || "")) ? scheduledTime : null,
      dietPlanId: null,
    },
  });

  ok(res, { meal: serializeMeal(meal) }, 201);
});

exports.updateMeal = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const existing = await prisma.meal.findFirst({ where: { id, userId } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Meal not found.");

  const body = req.body;
  const data = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description || null;
  if (body.mealType !== undefined) data.mealType = body.mealType;
  if (body.calories !== undefined) data.calories = Math.max(0, Math.round(Number(body.calories) || 0));
  if (body.protein !== undefined) data.protein = Number(body.protein) || 0;
  if (body.carbs !== undefined) data.carbs = Number(body.carbs) || 0;
  if (body.fats !== undefined) data.fats = Number(body.fats) || 0;
  if (body.scheduledTime !== undefined)
    data.scheduledTime = /^\d{1,2}:\d{2}/.test(String(body.scheduledTime || "")) ? body.scheduledTime : null;
  if (body.scheduledDate !== undefined) {
    const date = toDateOnly(body.scheduledDate);
    if (date) data.scheduledDate = date;
  }

  const meal = await prisma.meal.update({ where: { id: existing.id }, data });
  ok(res, { meal: serializeMeal(meal) });
});

exports.deleteMeal = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const existing = await prisma.meal.findFirst({ where: { id, userId } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Meal not found.");

  await prisma.meal.delete({ where: { id: existing.id } });
  ok(res, { message: "Meal deleted." });
});