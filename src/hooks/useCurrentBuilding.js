import { useEffect, useState } from "react";

const SESSION_BUILDING_KEY = "currentBuilding";
const SESSION_CHANGED_EVENT = "building-session-changed";

function pickBuildingFields(building) {
  if (!building?.id) return null;
  const { id, name } = building;
  return { id, name };
}

function isSameBuilding(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.name === b.name;
}

export function getCurrentBuilding() {
  try {
    return pickBuildingFields(JSON.parse(sessionStorage.getItem(SESSION_BUILDING_KEY)));
  } catch {
    return null;
  }
}

export function setCurrentBuilding(building) {
  const sessionBuilding = pickBuildingFields(building);
  if (!sessionBuilding) return;
  sessionStorage.setItem(SESSION_BUILDING_KEY, JSON.stringify(sessionBuilding));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function useCurrentBuilding() {
  const [building, setBuilding] = useState(getCurrentBuilding);

  useEffect(() => {
    const handler = () =>
      setBuilding((current) => {
        const updated = getCurrentBuilding();
        if (isSameBuilding(current, updated)) {
          return current;
        }
        return updated;
      });
    window.addEventListener(SESSION_CHANGED_EVENT, handler);
    window.addEventListener("user-session-changed", handler);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, handler);
      window.removeEventListener("user-session-changed", handler);
    };
  }, []);

  return building;
}
