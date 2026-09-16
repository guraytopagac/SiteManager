export function searchKey(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr");
}
