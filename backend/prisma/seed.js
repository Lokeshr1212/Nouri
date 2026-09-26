const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { generateMockPlan } = require("../src/services/dietPlanService");

const prisma = new PrismaClient();

const DEMO_EMAIL = "alex@nouri.app";
const DEMO_PASSWORD = "NouriDemo123!";

function toDateOnly(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const WEEK_LOGS = [
  // Mon..Sun daily totals shaped like the original dashboard chart
  { dayOffset: -6, totals: 1160 },
  { dayOffset: -5, totals: 1620 },
  { dayOffset: -4, totals: 1330 },
  { dayOffset: -3, totals: 1810 },
  { dayOffset: -2, totals: 1490 },
  { dayOffset: -1, totals: 1234 },
];

const TODAY_LOGS = [
  { foodName: "Breakfast bowl", mealType: "breakfast", calories: 432, protein: 24, carbs: 58, fats: 12, servingSize: "Oats, berries & almond butter" },
  { foodName: "Garden protein bowl", mealType: "lunch", calories: 486, protein: 38, carbs: 52, fats: 16, servingSize: "Chicken, greens & grains" },
  { foodName: "Berry protein shake", mealType: "snack", calories: 350, protein: 25, carbs: 40, fats: 6, servingSize: "1 shake (400ml)" },
  { foodName: "Dark chocolate", mealType: "snack", calories: 168, protein: 3, carbs: 16, fats: 11, servingSize: "1 square" },
];

const WEEK_MEALS = [
  { foodName: "Overnight oats", calories: 430, protein: 22, carbs: 60, fats: 14 },
  { foodName: "Chicken & quinoa salad", calories: 470, protein: 40, carbs: 44, fats: 16 },
  { foodName: "Tomato chickpea curry", calories: 510, protein: 26, carbs: 62, fats: 18 },
  { foodName: "Sliced fruit", calories: 250, protein: 5, carbs: 60, fats: 2 },
];

const WEIGHT_ENTRIES = [
  { dayOffset: -56, weight: 75.2 },
  { dayOffset: -49, weight: 74.8 },
  { dayOffset: -42, weight: 74.3 },
  { dayOffset: -35, weight: 73.9 },
  { dayOffset: -28, weight: 73.2 },
  { dayOffset: -21, weight: 73.0 },
  { dayOffset: -14, weight: 72.6 },
  { dayOffset: -7, weight: 72.2 },
  { dayOffset: 0, weight: 71.4 },
];

const GROCERY_ITEMS = ["Baby spinach", "Lemon & fresh herbs", "Greek yogurt", "Wholegrain bread"];

function habitPattern() {
  const today = todayIso();
  const pattern = [];
  for (let i = -59; i <= 0; i += 1) {
    let done = true;
    if (i === -41) done = false;
    if (i >= -40 && i <= -21 && (i % 9 === 0)) done = false;
    if (i === -18) done = false;
    if (i === -13) done = false;
    if (i === -5) done = false;
    pattern.push({ date: addDays(today, i), done, habitName: "track meals" });
  }
  return pattern;
}

async function main() {
  console.log("Seeding Nouri database...");

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const today = todayIso();

  const user = await prisma.user.create({
    data: {
      name: "Alex Rivera",
      email: DEMO_EMAIL,
      passwordHash,
      plan: "free",
      nutritionProfile: {
        create: {
          age: 30,
          gender: "other",
          heightCm: 178,
          currentWeightKg: 71.4,
          targetWeightKg: 68,
          activityLevel: "moderate",
          calorieGoal: 2000,
          proteinGoal: 120,
          carbGoal: 210,
          fatGoal: 65,
          hydrationGoalGlasses: 8,
          dietaryPreferences: ["balanced", "high-protein"],
          allergies: ["peanuts"],
        },
      },
    },
    include: { nutritionProfile: true },
  });

  const userId = user.id;

  for (const log of TODAY_LOGS) {
    await prisma.foodLog.create({
      data: {
        userId,
        foodName: log.foodName,
        mealType: log.mealType,
        calories: log.calories,
        protein: log.protein,
        carbs: log.carbs,
        fats: log.fats,
        servingSize: log.servingSize,
        source: "manual",
        loggedAt: toDateOnly(today),
      },
    });
  }

  for (const day of WEEK_LOGS) {
    const date = addDays(today, day.dayOffset);
    for (const meal of WEEK_MEALS) {
      await prisma.foodLog.create({
        data: {
          userId,
          foodName: meal.foodName,
          mealType: "dinner",
          calories: Math.round(meal.calories * (day.totals / 1660)),
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
          servingSize: "1 serving",
          source: "manual",
          loggedAt: toDateOnly(date),
        },
      });
    }
  }

  const monday = addDays(today, -((new Date(`${today}T00:00:00.000Z`).getUTCDay() + 6) % 7));
  const demoPlan = generateMockPlan({
    calorieTarget: 2000,
    proteinTarget: 120,
    startDate: monday,
    days: 7,
    seed: 7,
  });

  const plan = await prisma.dietPlan.create({
    data: {
      userId,
      startDate: toDateOnly(monday),
      endDate: toDateOnly(addDays(monday, 6)),
      dailyCalorieTarget: 2000,
      proteinTarget: 120,
      plantVarietyTarget: 30,
      notes: "A lighter, high-protein week. Generated by the Nouri meal planner.",
    },
  });

  for (const day of demoPlan.dayPlans) {
    for (const meal of day.meals) {
      await prisma.meal.create({
        data: {
          userId,
          dietPlanId: plan.id,
          name: meal.name,
          description: meal.description,
          mealType: meal.mealType,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
          scheduledDate: toDateOnly(meal.scheduledDate),
          scheduledTime: meal.scheduledTime,
        },
      });
    }
  }

  for (const entry of WEIGHT_ENTRIES) {
    await prisma.weightEntry.create({
      data: { userId, weight: entry.weight, recordedAt: toDateOnly(addDays(today, entry.dayOffset)) },
    });
  }

  for (const h of habitPattern()) {
    await prisma.habit.create({
      data: { userId, habitName: h.habitName, date: toDateOnly(h.date), completed: h.done },
    });
  }

  for (const item of GROCERY_ITEMS) {
    await prisma.groceryItem.create({
      data: { userId, itemName: item, completed: false, date: toDateOnly(today) },
    });
  }

  await prisma.hydrationEntry.create({
    data: { userId, date: toDateOnly(today), amountGlasses: 5, amountMl: 1250 },
  });

  console.log(`Seeded demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  profile goals: ${user.nutritionProfile.calorieGoal} kcal, ${user.nutritionProfile.proteinGoal}g protein`);
  console.log("  plan week:", monday, "->", addDays(monday, 6));
  console.log("Seeding complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });