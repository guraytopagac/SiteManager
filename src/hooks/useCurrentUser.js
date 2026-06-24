import { useEffect, useState } from "react";
import { SESSION_USER_KEY } from "../utils/constants";

function getUser() {
  try {
    const u = JSON.parse(sessionStorage.getItem(SESSION_USER_KEY));
    if (!u?.id) return null;
    const { id, role, username, email } = u;
    return { id, role, username, email };
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
