export function searchKey(value) {
  return String(value ?? "").toLocaleLowerCase("tr");
}
