import { useEffect, useState } from "react";
import { SESSION_USER_KEY } from "../utils/constants";

function getUser() {
  try {
    const sessionUser = JSON.parse(sessionStorage.getItem(SESSION_USER_KEY));
    if (!sessionUser?.id) return null;
    const { id, role, username, email, last_login } = sessionUser;
    return { id, role, username, email, last_login };
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
