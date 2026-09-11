export const APARTMENT_TYPES = ["0+1", "1+1", "2+1", "3+1", "4+1"];

export const MAX_BUILDING_NAME_LENGTH = 60;

export const MAX_DUE_AMOUNT = 50000;

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

export const INCOME_CATEGORIES = [
  { value: "rent", label: "Kira" },
  { value: "parking", label: "Otopark" },
  { value: "donation", label: "Bağış" },
  { value: "other", label: "Diğer" },
];

export const EXPENSE_CATEGORIES = [
  { value: "maintenance", label: "Bakım & Onarım" },
  { value: "cleaning", label: "Temizlik" },
  { value: "utility", label: "Fatura / Abonelik" },
  { value: "staff", label: "Personel" },
  { value: "other", label: "Diğer" },
];

export const TRANSACTION_CATEGORY_LABELS = Object.fromEntries([
  ["dues", "Aidat"],
  ...INCOME_CATEGORIES.map((category) => [category.value, category.label]),
  ...EXPENSE_CATEGORIES.map((category) => [category.value, category.label]),
]);

export const DUES_STATUS_LABELS = {
  unpaid: "Ödenmedi",
  partial: "Kısmen Ödendi",
  paid: "Ödendi",
};

export const DUES_STATUS_ORDER = ["paid", "partial", "unpaid"];

export const EMPTY_RESIDENT_LABEL = "Sakin yok";

export const UNNAMED_RESIDENT_LABEL = "Adı girilmemiş";

export const UNEXPECTED_ERROR_MESSAGE = "Beklenmedik bir hata oluştu.";
