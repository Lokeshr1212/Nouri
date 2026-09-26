const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ok } = require("../utils/response");
const { toDateOnly, todayUTC } = require("../utils/date");

exports.getGrocery = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const date = toDateOnly(req.query.date) || toDateOnly(todayUTC());
  const items = await prisma.groceryItem.findMany({
    where: { userId, date },
    orderBy: [{ completed: "asc" }, { createdAt: "asc" }],
  });
  ok(res, {
    date: date.toISOString().slice(0, 10),
    items: items.map((i) => ({ id: i.id, itemName: i.itemName, completed: i.completed })),
  });
});

exports.addGrocery = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const itemName = String(req.body.itemName || "").trim();
  if (!itemName) throw new ApiError(422, "VALIDATION_ERROR", "Grocery item name is required.");
  const date = toDateOnly(req.body.date) || toDateOnly(todayUTC());

  const item = await prisma.groceryItem.create({
    data: { userId, itemName, date, completed: false },
  });
  ok(res, { item: { id: item.id, itemName: item.itemName, completed: item.completed } }, 201);
});

exports.updateGrocery = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const existing = await prisma.groceryItem.findFirst({ where: { id, userId } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Grocery item not found.");

  const data = {};
  if (req.body.completed !== undefined) data.completed = Boolean(req.body.completed);
  if (req.body.itemName !== undefined) {
    const name = String(req.body.itemName || "").trim();
    if (!name) throw new ApiError(422, "VALIDATION_ERROR", "Grocery item name is required.");
    data.itemName = name;
  }

  const item = await prisma.groceryItem.update({ where: { id: existing.id }, data });
  ok(res, { item: { id: item.id, itemName: item.itemName, completed: item.completed } });
});

exports.deleteGrocery = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const existing = await prisma.groceryItem.findFirst({ where: { id, userId } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Grocery item not found.");
  await prisma.groceryItem.delete({ where: { id: existing.id } });
  ok(res, { message: "Grocery item deleted." });
});