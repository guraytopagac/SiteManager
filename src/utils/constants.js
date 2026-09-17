// Renderer constants with no owning module, read by more than one file.
// A list used by a single file stays in that file. Adding an entry here means naming a second consumer first.

// Mirrors APARTMENT_TYPES in electron/modules/shared/validate.js. Both sides and the schema CHECK change
// together.
export const APARTMENT_TYPES = ["0+1", "1+1", "2+1", "3+1", "4+1"];

// UI counterpart of the schema CHECK on buildings.name.
export const MAX_BUILDING_NAME_LENGTH = 60;

// UI counterpart of the schema CHECK on apartments.due_amount, used as the max attribute of three amount inputs.
export const MAX_DUE_AMOUNT = 50000;

// is_occupant travels as a form field rather than a separate state, so ResidentFieldset needs only form and
// setForm from either modal.
export const EMPTY_RESIDENT_FORM = {
  full_name: "",
  phone: "",
  email: "",
  national_id: "",
  household_size: "",
  is_occupant: false,
};

export const RESIDENT_TYPE_LABELS = {
  owner: "Malik",
  tenant: "Kiracı",
};

// Mirrors PAYMENT_METHODS in electron/modules/shared/validate.js.
export const PAYMENT_METHOD_LABELS = {
  cash: "Nakit",
  bank_transfer: "Havale / EFT",
  card: "Kredi Kartı",
  other: "Diğer",
};

// Six slots by design: the chips form a three by two grid and a seventh entry opens a third row. Labels name
// where the money came from and never reuse the monthly fee wording, which would promise an accrual.
export const INCOME_CATEGORIES = [
  { value: "rent", label: "Ortak Alan Kirası" },
  { value: "parking", label: "Otopark" },
  { value: "utility_share", label: "Su / Isı Payı" },
  { value: "special_fee", label: "Ortak Harcama" },
  { value: "penalty", label: "Gecikme Bedeli" },
  { value: "other", label: "Diğer" },
];

// Mirrors EXPENSE_CATEGORIES in financial/handlers.js, same six slot rule as the income list.
export const EXPENSE_CATEGORIES = [
  { value: "maintenance", label: "Bakım / Onarım" },
  { value: "cleaning", label: "Temizlik" },
  { value: "utility", label: "Faturalar" },
  { value: "heating", label: "Isınma / Yakıt" },
  { value: "staff", label: "Personel" },
  { value: "other", label: "Diğer" },
];

// Derived rather than written out: the same label prints on the selection chip and in the table cell, and two
// hand-kept copies drift the moment one of them is renamed.
// The last two are never picked by hand: the fund transfer is written by the severance fund and the payout
// is a list row of its own, not an expense record.
export const TRANSACTION_CATEGORY_LABELS = Object.fromEntries([
  ["dues", "Aidat"],
  ...INCOME_CATEGORIES.map((category) => [category.value, category.label]),
  ...EXPENSE_CATEGORIES.map((category) => [category.value, category.label]),
  ["severance_fund", "Tazminat Aktarımı"],
  ["severance_payout", "Tazminat Ödemesi"],
]);

export const DUES_STATUS_LABELS = {
  unpaid: "Ödenmedi",
  partial: "Kısmen Ödendi",
  paid: "Ödendi",
};

// Display order only, the wording stays in DUES_STATUS_LABELS. Two screens print this triple in the same order
// and the order drifts if each of them spells it out.
export const DUES_STATUS_ORDER = ["paid", "partial", "unpaid"];

// Two separate facts, never one label: a role with no record at all versus a record whose name was left blank.
export const EMPTY_RESIDENT_LABEL = "Sakin yok";

export const UNNAMED_RESIDENT_LABEL = "Adı girilmemiş";

// Owned here rather than by dialog.js, because three pages write it into an in-page error panel instead of a
// dialog and could not read it from the dialog layer.
export const UNEXPECTED_ERROR_MESSAGE = "Beklenmedik bir hata oluştu.";
