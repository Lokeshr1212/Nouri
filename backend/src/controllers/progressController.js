const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const { toDateOnly, todayUTC, addDays, weekdayInitial } = require("../utils/date");

function sum(list, key) {
  return list.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
}

function dateKey(input) {
  if (input instanceof Date) return input.toISOString().slice(0, 10);
  return String(input).slice(0, 10);
}

async function getDailyCalorieSeries(userId, days) {
  const logs = await prisma.foodLog.findMany({
    where: { userId, loggedAt: { gte: toDateOnly(addDays(todayUTC(), -(days - 1))) } },
  });
  const raw = {};
  for (const log of logs) {
    const key = dateKey(log.loggedAt);
    raw[key] = (raw[key] || 0) + (Number(log.calories) || 0);
  }
  return raw;
}

async function getHabitGrid(userId, days = 21) {
  const today = todayUTC();
  const start = addDays(today, -(days - 1));
  const habits = await prisma.habit.findMany({
    where: { userId, date: { gte: toDateOnly(start) } },
    orderBy: { date: "asc" },
  });
  const doneByDate = new Set();
  for (const h of habits) if (h.completed) doneByDate.add(dateKey(h.date));

  const grid = [];
  let cursor = start;
  while (cursor <= today) {
    grid.push({ date: cursor, initial: weekdayInitial(cursor), done: doneByDate.has(cursor) });
    cursor = addDays(cursor, 1);
  }
  return grid;
}

function computeStreaks(doneDates) {
  if (doneDates.length === 0) return { current: 0, personalBest: 0 };
  let current = 0;
  let look = todayUTC();
  if (!doneDates.has(look)) {
    look = addDays(look, -1);
    if (!doneDates.has(look)) current = 0;
  }
  while (doneDates.has(look)) {
    current += 1;
    look = addDays(look, -1);
  }

  const sorted = [...doneDates].sort();
  let best = 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (addDays(sorted[i - 1], 1) === sorted[i]) run += 1;
    else run = 1;
    if (run > best) best = run;
  }
  if (sorted.length > 0 && best === 0) best = 1;
  return { current, personalBest: Math.max(best, current) };
}

exports.getProgress = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const today = todayUTC();
  const weeks = Math.max(4, Math.min(16, Number(req.query.weeks) || 8));

  const [
    weights,
    calorieSeries,
    habitDatesAll,
    habits,
  ] = await Promise.all([
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { recordedAt: "asc" } }),
    getDailyCalorieSeries(userId, 7),
    prisma.habit.findMany({
      where: { userId, completed: true, date: { gte: toDateOnly(addDays(today, -89)) } },
      select: { date: true },
    }),
    prisma.habit.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 150 }),
  ]);

  const trendStart = addDays(today, -7 * weeks);
  const trend = weights
    .filter((w) => dateKey(w.recordedAt) >= trendStart)
    .map((w) => ({ date: dateKey(w.recordedAt), weight: w.weight }));

  const doneDates = new Set(habitDatesAll.map((h) => dateKey(h.date)));
  const streaks = computeStreaks(doneDates);

  const maxWeight = Math.max(...trend.map((p) => p.weight), 0);
  const minWeight = trend.length ? Math.min(...trend.map((p) => p.weight)) : 0;

  const currentWeight = weights.length ? weights[weights.length - 1].weight : null;
  const weight30DaysAgo = addDays(today, -30);
  const monthEntries = weights.filter((w) => dateKey(w.recordedAt) >= weight30DaysAgo);
  const weightChangeMonth =
    monthEntries.length >= 2
      ? Number((currentWeight - monthEntries[0].weight).toFixed(1))
      : weights.length >= 2
      ? Number((currentWeight - weights[0].weight).toFixed(1))
      : 0;

  const dailyAverage = (() => {
    const values = weekDatesValues(calorieSeries);
    if (values.length === 0) return 0;
    const total = values.reduce((acc, day) => acc + day.value, 0);
    return Math.round(total / 7);
  })();

  const habitNames = [...new Set(habits.map((h) => h.habitName))];

  ok(res, {
    weeks,
    currentWeight,
    weightChangeMonth,
    weightTrend: trend,
    weightRange: { min: minWeight, max: maxWeight },
    dailyCalorieAverage: dailyAverage,
    habitStreak: streaks.current,
    personalBestStreak: streaks.personalBest,
    habitGrid: await getHabitGrid(userId, 21),
    habitNames,
    date: { today },
  });
});

function weekDatesValues(raw) {
  const today = todayUTC();
  return Array.from({ length: 7 }, (_, i) => ({ date: addDays(today, -6 + i), value: raw[addDays(today, -6 + i)] || 0 }));
}

exports.getWeightHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const weeks = Math.max(4, Math.min(16, Number(req.query.weeks) || 8));
  const start = addDays(todayUTC(), -7 * weeks);
  const entries = await prisma.weightEntry.findMany({
    where: { userId, recordedAt: { gte: toDateOnly(start) } },
    orderBy: { recordedAt: "asc" },
  });
  ok(res, {
    weeks,
    points: entries.map((e) => ({ date: dateKey(e.recordedAt), weight: e.weight })),
  });
});

exports.addWeight = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const weight = Number(req.body.weight);
  if (!Number.isFinite(weight) || weight < 20 || weight > 500) {
    throw new ApiError(422, "VALIDATION_ERROR", "Enter a valid weight in kg (20–500).");
  }
  const recordedAt = toDateOnly(req.body.recordedAt || todayUTC());
  const entry = await prisma.weightEntry.create({ data: { userId, weight, recordedAt } });

  const [latest, weights] = await Promise.all([
    prisma.weightEntry.findFirst({ where: { userId }, orderBy: { recordedAt: "desc" } }),
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { recordedAt: "asc" } }),
  ]);
  const change = weights.length >= 2 ? Number((latest.weight - weights[0].weight).toFixed(1)) : 0;

  ok(res, { entry, currentWeight: latest.weight, weightChange: change }, 201);
});

exports.addHabit = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const habitName = String(req.body.habitName || "track meals").trim();
  const date = toDateOnly(req.body.date || todayUTC());
  const completed = req.body.completed === undefined ? true : Boolean(req.body.completed);

  const existing = await prisma.habit.findUnique({
    where: { userId_habitName_date: { userId, habitName, date } },
  });

  let row;
  if (existing) {
    row = await prisma.habit.update({
      where: { id: existing.id },
      data: { completed: req.body.completed === undefined ? !existing.completed : completed },
    });
  } else {
    row = await prisma.habit.create({ data: { userId, habitName, date, completed } });
  }

  const doneDate = date.toISOString().slice(0, 10);
  const recent = await prisma.habit.findMany({
    where: { userId, completed: true, date: { gte: toDateOnly(addDays(todayUTC(), -89)) } },
    select: { date: true },
  });
  const doneDates = new Set(recent.map((h) => dateKey(h.date)));
  if (row.completed) doneDates.add(doneDate);
  const streaks = computeStreaks(doneDates);

  ok(res, { habit: { ...row, date: doneDate }, streak: streaks.current, personalBest: streaks.personalBest }, 201);
});

exports.getHabits = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  ok(res, { habitGrid: await getHabitGrid(userId, 21) });
});