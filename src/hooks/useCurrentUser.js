export function useCurrentUser() {
  return JSON.parse(sessionStorage.getItem("currentUser") || "{}");
}
