// Locale aware folding for every renderer text comparison. A locale-less toLowerCase turns the dotted capital
// I into i plus a combining dot, so a record typed in capitals never matched. Trimming happens here as well.
export function searchKey(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr");
}
