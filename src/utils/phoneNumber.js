// Phone numbers are stored as 10 bare digits, the grouping is display only. The same pair feeds the panel
// row and the masked edit input, which is why it lives here rather than inside a page.

const GROUPS = [3, 3, 2, 2];
const PHONE_LENGTH = 10;

export function phoneDigits(value) {
  let digits = String(value ?? "").replace(/\D/g, "");

  // The country code is only dropped when digits are left over, otherwise a subscriber number that happens to
  // start with those two digits would lose them.
  if (digits.startsWith("90") && digits.length > PHONE_LENGTH) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);

  return digits.slice(0, PHONE_LENGTH);
}

export function formatPhone(value) {
  const digits = phoneDigits(value);
  // Empty stays empty rather than becoming the em dash placeholder: the same output also fills an input
  // value, and a placeholder written into a text field would be edited as if it were data.
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
