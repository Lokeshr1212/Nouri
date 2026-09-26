const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const {
  todayUTC,
  addDays,
  toDateOnly,
  weekdayLabel,
  monthShort,
  dayOfMonth,
} = require("../utils/date");

function sum(list, key) {
  return list.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
}

function fillDays(raw, weekDates) {
  return weekDates.map((date) => {
    const value = raw[date] || 0;
    return { date, value, label: weekdayLabel(date)[0], active: date === weekDates[weekDates.length - 1] };
  });
}

exports.getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const today = todayUTC();

  const [user, profile, todayLogs, weekLogs, meals, hydration, habits, weights] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, plan: true },
    }),
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.foodLog.findMany({
      where: { userId, loggedAt: toDateOnly(today) },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    prisma.foodLog.findMany({
      where: {
        userId,
        loggedAt: { in: Array.from({ length: 7 }, (_, i) => toDateOnly(addDays(today, -6 + i))) },
      },
    }),
    prisma.meal.findMany({
      where: { userId, scheduledDate: { gte: toDateOnly(today) } },
      orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
      take: 8,
    }),
    prisma.hydrationEntry.findUnique({
      where: { userId_date: { userId, date: toDateOnly(today) } },
    }),
    prisma.habit.findMany({ where: { userId, date: toDateOnly(today) } }),
    prisma.weightEntry.findMany({ where: { userId }, orderBy: { recordedAt: "desc" }, take: 1 }),
  ]);

  const calorieGoal = profile?.calorieGoal || 2000;
  const proteinGoal = profile?.proteinGoal || 120;
  const carbGoal = profile?.carbGoal || 210;
  const fatGoal = profile?.fatGoal || 65;
  const hydrationGoal = profile?.hydrationGoalGlasses || 8;

  const dailyCalories = sum(todayLogs, "calories");
  const caloriesRemaining = Math.max(calorieGoal - dailyCalories, 0);
  const caloriePercent = calorieGoal > 0 ? Math.min(100, Math.round((dailyCalories / calorieGoal) * 100)) : 0;

  const macros = {
    protein: { current: sum(todayLogs, "protein"), target: proteinGoal, pct: proteinGoal > 0 ? Math.min(100, Math.round((sum(todayLogs, "protein") / proteinGoal) * 100)) : 0 },
    carbs: { current: sum(todayLogs, "carbs"), target: carbGoal, pct: carbGoal > 0 ? Math.min(100, Math.round((sum(todayLogs, "carbs") / carbGoal) * 100)) : 0 },
    fats: { current: sum(todayLogs, "fats"), target: fatGoal, pct: fatGoal > 0 ? Math.min(100, Math.round((sum(todayLogs, "fats") / fatGoal) * 100)) : 0 },
  };

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i));
  const raw = {};
  for (const log of weekLogs) {
    if (log.loggedAt instanceof Date) {
      const key = log.loggedAt.toISOString().slice(0, 10);
      raw[key] = (raw[key] || 0) + (Number(log.calories) || 0);
    }
  }
  for (const date of weekDates) if (!raw[date]) raw[date] = 0;
  const weeklyCalories = fillDays(raw, weekDates);

  const formattedHeading = `${weekdayLabel(today)}, ${dayOfMonth(today)} ${monthShort(today)}`;

  const hydrationStatus = {
    current: Math.round(Number(hydration?.amountGlasses || 0)),
    goal: hydrationGoal,
    remaining: Math.max(hydrationGoal - Number(hydration?.amountGlasses || 0), 0),
    amountMl: hydration?.amountMl || Math.round((hydration?.amountGlasses || 0) * 250),
  };

  const habitsDoneToday = habits.length;

  const firstName = (user.name || "there").trim().split(/\s+/)[0];

  ok(res, {
    user: {
      name: user.name,
      firstName,
      email: user.email,
      plan: user.plan,
    },
    date: { today, heading: formattedHeading, weekday: weekdayLabel(today) },
    energy: {
      goal: calorieGoal,
      consumed: dailyCalories,
      remaining: caloriesRemaining,
      percent: caloriePercent,
    },
    macros,
    todaysMeals: todayLogs.map((log) => ({
      id: log.id,
      name: log.foodName,
      description: log.servingSize ? `${log.servingSize} · ${log.mealType}` : String(log.mealType[0]).toUpperCase() + log.mealType.slice(1),
      calories: log.calories,
      mealType: log.mealType,
      time: log.createdAt,
    })),
    weeklyCalories,
    upcomingMeals: meals.slice(0, 3).map((meal) => ({
      id: meal.id,
      name: meal.name,
      description: meal.description,
      mealType: meal.mealType,
      calories: meal.calories,
      date: meal.scheduledDate instanceof Date ? meal.scheduledDate.toISOString().slice(0, 10) : meal.scheduledDate,
      time: meal.scheduledTime,
    })),
    hydration: hydrationStatus,
    habitsDoneToday,
    currentWeight: weights[0]?.weight || null,
  });
});