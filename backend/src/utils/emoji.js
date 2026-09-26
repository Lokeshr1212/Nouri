const BOWL = "🍽️";

function mealTypeEmoji(mealType = "") {
  const type = String(mealType).toLowerCase();
  if (type.includes("breakfast")) return "🥣";
  if (type.includes("lunch")) return "🥗";
  if (type.includes("dinner")) return "🍛";
  if (type.includes("snack")) return "🍎";
  return BOWL;
}

function textEmoji(text = "") {
  const value = String(text).toLowerCase();
  const maps = [
    ["oat", "🥣"],
    ["berry", "🍓"],
    ["berry", "🍓"],
    ["egg", "🍳"],
    ["avocado", "🥑"],
    ["salad", "🥗"],
    ["green", "🥬"],
    ["chicken", "🍗"],
    ["fish", "🐟"],
    ["salmon", "🐟"],
    ["tuna", "🐟"],
    ["rice", "🍚"],
    ["noodle", "🍜"],
    ["pasta", "🍝"],
    ["traybake", "🍛"],
    ["curry", "🍛"],
    ["soup", "🍲"],
    ["lentil", "🍲"],
    ["stew", "🍲"],
    ["wrap", "🌯"],
    ["taco", "🌮"],
    ["burger", "🍔"],
    ["pizza", "🍕"],
    ["toast", "🍞"],
    ["bread", "🍞"],
    ["sandwich", "🥪"],
    ["pancake", "🥞"],
    ["waffle", "🧇"],
    ["yogurt", "🍦"],
    ["smoothie", "🥤"],
    ["shake", "🥤"],
    ["chocolate", "🍫"],
    ["cookie", "🍪"],
    ["cake", "🍰"],
    ["banana", "🍌"],
    ["apple", "🍎"],
    ["fruit", "🍎"],
    ["chia", "🥣"],
    ["bowl", "🥗"],
    ["water", "💧"],
    ["coffee", "☕"],
    ["tea", "🍵"],
    ["pudding", "🍮"],
  ];
  for (const [key, emoji] of maps) {
    if (value.includes(key)) return emoji;
  }
  return BOWL;
}

function foodEmoji(foodName = "", mealType = "") {
  return textEmoji(foodName) === BOWL ? mealTypeEmoji(mealType) : textEmoji(foodName);
}

module.exports = { foodEmoji, mealTypeEmoji, textEmoji };