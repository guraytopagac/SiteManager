export const getToday = () => new Date().toISOString().split("T")[0];

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

// SQLite's datetime('now') stores UTC as "YYYY-MM-DD HH:MM:SS" with no timezone marker,
// which JS would otherwise misread as local time. Normalize to explicit UTC before parsing.
const asUtcDate = (dateStr) => new Date(dateStr.includes("T") ? dateStr : `${dateStr.replace(" ", "T")}Z`);

export const formatDateTime = (dateStr) => asUtcDate(dateStr).toLocaleString("tr-TR");

export const formatShortDate = (dateStr) =>
  asUtcDate(dateStr).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const formatTime = (dateStr) =>
  asUtcDate(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

export const formatBytes = (bytes) => {
  if (!bytes) return "0 MB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
};
