import { useEffect, useState } from "react";

export const VALID_ROLES = ["admin", "manager"];

const SESSION_USER_KEY = "currentUser";
const SESSION_CHANGED_EVENT = "user-session-changed";

function pickSessionFields(user) {
  if (!user?.id || !VALID_ROLES.includes(user.role)) return null;
  const { id, role, username, email, last_login } = user;
  return { id, role, username, email, last_login };
}

function isSameSessionUser(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.role === b.role &&
    a.username === b.username &&
    a.email === b.email &&
    a.last_login === b.last_login
  );
}

export function getCurrentUser() {
  try {
    return pickSessionFields(JSON.parse(sessionStorage.getItem(SESSION_USER_KEY)));
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  const sessionUser = pickSessionFields(user);
  if (!sessionUser) return;
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(sessionUser));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function clearCurrentUser() {
  sessionStorage.clear();
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function hasRole(user, expectedRole) {
  return user?.role === expectedRole;
}

export function homePathFor(user) {
  return hasRole(user, "admin") ? "/admin" : "/dashboard";
}

export function useCurrentUser() {
  const [user, setUser] = useState(getCurrentUser);

  useEffect(() => {
    const handler = () =>
      setUser((currentUser) => {
        const updatedUser = getCurrentUser();
        if (isSameSessionUser(currentUser, updatedUser)) {
          return currentUser;
        }
        return updatedUser;
      });
    window.addEventListener(SESSION_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, handler);
  }, []);

  return user;
}
