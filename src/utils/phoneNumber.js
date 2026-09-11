const GROUPS = [3, 3, 2, 2];
const PHONE_LENGTH = 10;

export function phoneDigits(value) {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("90") && digits.length > PHONE_LENGTH) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);

  return digits.slice(0, PHONE_LENGTH);
}

export function formatPhone(value) {
  const digits = phoneDigits(value);
  if (!digits) return "";

  const parts = [];
  let index = 0;

  for (const size of GROUPS) {
    if (index >= digits.length) break;
    parts.push(digits.slice(index, index + size));
    index += size;
  }

  return parts.join(" ");
}
