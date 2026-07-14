// Turkey is fixed UTC+3 (no DST) — derive today's TR calendar date regardless of machine tz.
export const getToday = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().split("T")[0];

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

// Timestamps are stored in TR local time ("YYYY-MM-DD HH:MM:SS", already UTC+3, no tz marker).
// Parse them as local (no "Z") so they are displayed verbatim without a second conversion.
const asLocalDate = (dateStr) => new Date(dateStr.replace(" ", "T"));

export const formatDateTime = (dateStr) => asLocalDate(dateStr).toLocaleString("tr-TR");

export const formatShortDate = (dateStr) =>
  asLocalDate(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const formatTime = (dateStr) =>
  asLocalDate(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

export const formatBytes = (bytes) => {
  if (!bytes) return "0 MB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
};
