const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const { toDateOnly, todayUTC, dateOnlyString } = require("../utils/date");

const ML_PER_GLASS = 250;

exports.getHydration = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const date = toDateOnly(req.query.date || todayUTC()) || toDateOnly(todayUTC());

  const profile = await prisma.nutritionProfile.findUnique({ where: { userId } });
  const goal = profile?.hydrationGoalGlasses || 8;

  const entry = await prisma.hydrationEntry.findUnique({ where: { userId_date: { userId, date } } });
  const amount = entry?.amountGlasses || 0;

  ok(res, {
    id: entry?.id || null,
    date: dateOnlyString(date),
    goal,
    amountGlasses: amount,
    amountMl: entry?.amountMl || Math.round(amount * ML_PER_GLASS),
    remaining: Math.max(goal - amount, 0),
  });
});

exports.addHydration = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const date = toDateOnly(req.body.date || todayUTC()) || toDateOnly(todayUTC());
  const add = Math.max(0, Math.min(30, Number(req.body.amountGlasses) || 1));

  const profile = await prisma.nutritionProfile.findUnique({ where: { userId } });
  const goal = profile?.hydrationGoalGlasses || 8;

  const entry = await prisma.hydrationEntry.upsert({
    where: { userId_date: { userId, date } },
    update: { amountGlasses: { increment: add } },
    create: { userId, date, amountGlasses: add, amountMl: Math.round(add * ML_PER_GLASS) },
  });

  const amount = Number(entry.amountGlasses);
  const updated = await prisma.hydrationEntry.update({
    where: { id: entry.id },
    data: { amountMl: Math.round(amount * ML_PER_GLASS) },
  });

  ok(res, {
    id: updated.id,
    date: dateOnlyString(date),
    goal,
    amountGlasses: Number(updated.amountGlasses),
    amountMl: updated.amountMl,
    remaining: Math.max(goal - Number(updated.amountGlasses), 0),
  }, 201);
});

exports.updateHydration = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const entry = await prisma.hydrationEntry.findFirst({ where: { id, userId } });
  if (!entry) throw new ApiError(404, "NOT_FOUND", "Hydration entry not found.");

  const raw = req.body.amountGlasses;
  const base = raw === undefined || raw === null || raw === "" ? Number(entry.amountGlasses) : Number(raw);
  const amount = Math.max(0, Math.min(30, Number.isFinite(base) ? base : Number(entry.amountGlasses)));

  const updated = await prisma.hydrationEntry.update({
    where: { id: entry.id },
    data: { amountGlasses: amount, amountMl: Math.round(amount * ML_PER_GLASS) },
  });

  const profile = await prisma.nutritionProfile.findUnique({ where: { userId } });
  const goal = profile?.hydrationGoalGlasses || 8;

  ok(res, {
    id: updated.id,
    date: dateOnlyString(updated.date),
    goal,
    amountGlasses: Number(updated.amountGlasses),
    amountMl: updated.amountMl,
    remaining: Math.max(goal - Number(updated.amountGlasses), 0),
  });
});

exports.getGoal = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const profile = await prisma.nutritionProfile.findUnique({ where: { userId } });
  ok(res, { goal: profile?.hydrationGoalGlasses || 8 });
});