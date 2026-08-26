// Turns a SQLite constraint error into a Turkish message. Last line of defence, because the
// handler should have caught the bad input first.
function extractConstraintCol(msg, prefix, columnLabels) {
  const raw = msg.split(prefix)[1]?.trim();
  if (!raw) return null;

  const cols = raw
    .split(",")
    .map((part) => part.trim().split(".").pop())
    .filter(Boolean);
  if (cols.length === 0) return null;

  return cols.find((col) => col in columnLabels) ?? cols[0];
}

// Only the UNIQUE and NOT NULL branches read a label, so give a column a label only when it
// sits in a UNIQUE index or is NOT NULL.
function createDbErrorResolver(columnLabels = {}) {
  return function resolveDbError(err, context) {
    const msg = err.message ?? "";

    if (msg.includes("UNIQUE constraint failed")) {
      const col = extractConstraintCol(msg, "UNIQUE constraint failed:", columnLabels);
      const label = columnLabels[col] ?? "Alan";
      return `${label} zaten kullanılıyor.`;
    }

    // CHECK and FOREIGN KEY give no useful column name, so they get one general sentence.
    if (msg.includes("CHECK constraint failed")) {
      return `${context} sırasında girilen değerlerden biri geçerli aralıkta değil. Lütfen kontrol edin.`;
    }

    if (msg.includes("NOT NULL constraint failed")) {
      const col = extractConstraintCol(msg, "NOT NULL constraint failed:", columnLabels);
      const label = columnLabels[col] ?? "Zorunlu alan";
      return `${label} boş bırakılamaz.`;
    }

    if (msg.includes("FOREIGN KEY constraint failed")) {
      return "İlişkili kayıt bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.";
    }

    return `${context} sırasında beklenmeyen bir hata oluştu.`;
  };
}

module.exports = { createDbErrorResolver };
