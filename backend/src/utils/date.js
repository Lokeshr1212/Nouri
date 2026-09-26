function toDateOnly(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateOnlyString(date = new Date()) {
  if (typeof date === "string") return date;
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  return addDays(dateStr, diff);
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function weekdayLabel(dateStr) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(`${dateStr}T00:00:00.000Z`).getUTCDay()];
}

function weekdayInitial(dateStr) {
  return weekdayLabel(dateStr)[0];
}

function dayOfMonth(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`).getUTCDate();
}

function monthShort(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

function formatShortDate(dateStr) {
  return `${monthShort(dateStr)} ${dayOfMonth(dateStr)}`;
}

function hourLabel(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const hours12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? "AM" : "PM";
  return `${hours12}:${String(m || 0).padStart(2, "0")} ${suffix}`;
}

module.exports = {
  toDateOnly,
  dateOnlyString,
  addDays,
  startOfWeek,
  todayUTC,
  weekdayLabel,
  weekdayInitial,
  dayOfMonth,
  monthShort,
  formatShortDate,
  hourLabel,
};