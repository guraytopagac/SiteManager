import { useEffect, useState } from "react";

function getUser() {
  try {
    const u = JSON.parse(sessionStorage.getItem("currentUser"));
    return u?.id ? u : null;
  } catch {
    return null;
  }
}

export function useCurrentUser() {
  const [user, setUser] = useState(getUser);

  useEffect(() => {
    const handler = () => setUser(getUser());
    window.addEventListener("user-session-changed", handler);
    return () => window.removeEventListener("user-session-changed", handler);
  }, []);

  return user;
}
