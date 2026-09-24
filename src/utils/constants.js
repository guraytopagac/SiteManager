// Renderer constants with no owning module, read by more than one file.
// A list used by a single file stays in that file. Adding an entry here means naming a second consumer first.

// Mirrors APARTMENT_TYPES in electron/modules/shared/validate.js. Both sides and the schema CHECK change
// together.
export const APARTMENT_TYPES = ["0+1", "1+1", "2+1", "3+1", "4+1"];

// UI counterpart of the schema CHECK on buildings.name.
export const MAX_BUILDING_NAME_LENGTH = 60;

// UI counterpart of the schema CHECK on apartments.due_amount, used as the max attribute of three amount inputs.
export const MAX_DUE_AMOUNT = 50000;

// The opening balance a fund can be started with. Same limit as the two opening_balance CHECKs, read by
// the staff page and the investment page.
export const MAX_OPENING_BALANCE = 100000000;

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

// Mirrors CASH_ACCOUNTS in electron/modules/shared/validate.js.
export const CASH_ACCOUNT_LABELS = {
  cash: "Nakit",
  bank: "Banka",
};

// Labels name where the money came from and never reuse the monthly fee wording, which would promise an accrual.
// Category lists are grouped for the picker, a group without a label prints its options loose. Within a group
// the order is alphabetical. The catch-all is in no group, the picker prints it on a row of its own below them.
export const OTHER_CATEGORY = { value: "other", label: "Diğer" };

export const INCOME_CATEGORY_GROUPS = [
  {
    label: null,
    categories: [
      { value: "advance_repayment", label: "Avans İadesi" },
      { value: "interest", label: "Faiz Geliri" },
      { value: "penalty", label: "Gecikme Bedeli" },
      { value: "rent", label: "Ortak Alan Kirası" },
      { value: "special_fee", label: "Ortak Harcama" },
      { value: "parking", label: "Otopark" },
      { value: "utility_share", label: "Su / Isı Payı" },
    ],
  },
];

// Mirrors EXPENSE_CATEGORIES in cashbook/handlers.js. The list is long enough to need groups. The value
// utility predates the split of the bills and now reads as the other bills, staff as the salary.
export const EXPENSE_CATEGORY_GROUPS = [
  {
    label: "Faturalar",
    categories: [
      { value: "utility", label: "Diğer Faturalar" },
      { value: "electricity", label: "Elektrik" },
      { value: "heating", label: "Isınma / Yakıt" },
      { value: "water", label: "Su" },
    ],
  },
  {
    label: "Bina ve Bakım",
    categories: [
      { value: "elevator", label: "Asansör" },
      { value: "garden", label: "Bahçe / Peyzaj" },
      { value: "maintenance", label: "Bakım / Onarım" },
      { value: "equipment", label: "Demirbaş / Yatırım" },
      { value: "cleaning", label: "Temizlik" },
    ],
  },
  {
    label: "Personel",
    categories: [
      { value: "staff_advance", label: "Personel Avansı" },
      { value: "staff", label: "Personel Maaşı" },
      { value: "staff_insurance", label: "Personel SGK" },
      { value: "severance_fund", label: "Tazminat Aktarımı" },
    ],
  },
  {
    label: "Yönetim",
    categories: [
      { value: "bank_fee", label: "Banka Masrafı" },
      { value: "building_insurance", label: "Bina Sigortası" },
      { value: "legal", label: "Hukuk / Avukatlık" },
      { value: "office", label: "Kırtasiye / Büro" },
      { value: "management", label: "Yönetim / Denetim Ücreti" },
    ],
  },
];

// The two categories that name an employee: the advance given and its repayment. The record modal asks for
// the employee on them, the detail modal names the employee and prints no document.
export const ADVANCE_CATEGORIES = ["staff_advance", "advance_repayment"];

// Derived rather than written out: the same label prints on the selection chip and in the table cell, and two
// hand-kept copies drift the moment one of them is renamed.
// The payout and the two transfers are never picked by hand, they are list rows of their own, not records
// of a category. A dues refund is a real expense category, but only the prepayment refund writes it.
export const TRANSACTION_CATEGORY_LABELS = {
  dues: "Aidat",
  investment_dues: "Yatırım Aidatı",
  [OTHER_CATEGORY.value]: OTHER_CATEGORY.label,
  severance_payout: "Tazminat Ödemesi",
  dues_refund: "Aidat İadesi",
  to_bank: "Bankaya Yatırma",
  to_cash: "Bankadan Çekme",
};

for (const group of [...INCOME_CATEGORY_GROUPS, ...EXPENSE_CATEGORY_GROUPS]) {
  for (const category of group.categories) {
    TRANSACTION_CATEGORY_LABELS[category.value] = category.label;
  }
}

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

// An apartment with no owner row for the month being viewed. Read by the investment list and by the
// payment modal, which names the owner when it collects a fund contribution.
export const EMPTY_OWNER_LABEL = "Malik yok";

export const UNNAMED_RESIDENT_LABEL = "Adı girilmemiş";

// Owned here rather than by dialog.js, because three pages write it into an in-page error panel instead of a
// dialog and could not read it from the dialog layer.
export const UNEXPECTED_ERROR_MESSAGE = "Beklenmedik bir hata oluştu.";
