export const getToday = () => new Date().toISOString().split("T")[0];

export const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export const formatDateTime = (dateStr) => new Date(dateStr).toLocaleString("tr-TR");

export const formatBytes = (bytes) => {
  if (!bytes) return "0 MB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
};
