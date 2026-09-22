// Values the modal and the printed document both need. They sit beside the document so the modal and the
// document read one copy instead of each other.

import { TRANSACTION_CATEGORY_LABELS } from "@/utils/constants";
import { formatMonthYear } from "@/utils/date";

const FILE_NAME_PREFIXES = { income: "makbuz", expense: "gider-pusulasi" };
const TR_LETTERS = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };

const fileNamePart = (value, maxLength) =>
  String(value ?? "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (letter) => TR_LETTERS[letter])
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");

export const organizationName = (buildingName) => buildingName.toLocaleUpperCase("tr");

export function receiptPayerName(receipt) {
  if (receipt.apartment_no != null) {
    return receipt.resident_name ?? `Daire ${receipt.apartment_no} Sakini`;
  }
  return receipt.payer_name ?? "";
}

export function receiptDescription(receipt) {
  if (receipt.apartment_no != null) {
    return `Daire ${receipt.apartment_no}, ${formatMonthYear(receipt.year, receipt.month)} aidatı`;
  }
  return receipt.description || TRANSACTION_CATEGORY_LABELS[receipt.category] || "";
}

export const voucherDescription = (voucher) =>
  voucher.description || TRANSACTION_CATEGORY_LABELS[voucher.category] || "";

// Names the document: type, serial, building, counterparty and date, folded to ASCII. The serial keeps two
// same-day documents apart, and a dues receipt has none since it covers a whole month.
export function documentFileName(type, record, buildingName) {
  const isDuesReceipt = type === "income" && record.apartment_no != null;
  const party = type === "income" ? record.payer_name : record.vendor_name;

  const head = isDuesReceipt
    ? FILE_NAME_PREFIXES[type]
    : `${FILE_NAME_PREFIXES[type]}-${String(record.id).padStart(4, "0")}`;
  const subject = isDuesReceipt
    ? `daire-${fileNamePart(record.apartment_no, 10)}`
    : fileNamePart(party || TRANSACTION_CATEGORY_LABELS[record.category], 40);
  const period = isDuesReceipt ? `${record.year}-${String(record.month).padStart(2, "0")}` : record.date;

  return `${[head, fileNamePart(buildingName, 30), subject, period].filter(Boolean).join("_")}.pdf`;
}

// Long free text shrinks rather than overflowing the clipped sheet. The optional fourth step was added by
// measurement, for the longest description made of unbreakable words.
export function textSizeClass(text, compactFrom, tightFrom, denseFrom) {
  const length = String(text ?? "").length;
  if (denseFrom !== undefined && length >= denseFrom) return "fill--dense";
  if (length >= tightFrom) return "fill--tight";
  if (length >= compactFrom) return "fill--compact";
  return "";
}
