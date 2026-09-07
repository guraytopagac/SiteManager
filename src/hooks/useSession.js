import { useSyncExternalStore } from "react";

const SESSION_KEY = "session";
const NO_SESSION = { user: null, building: null };
const ASSUME_SETUP_DONE = { needsSetup: false, username: null };

const listeners = new Set();
let sessionState = restoreState();
let accountState = ASSUME_SETUP_DONE;

function restoreState() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || NO_SESSION;
  } catch (err) {
    console.error("[useSession] restoreState:", err);
    return NO_SESSION;
  }
}

function commitState(user, building) {
  sessionState = { user, building };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionState));
  listeners.forEach((listener) => listener());
}

function addListener(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getUser = () => sessionState.user;
const getBuilding = () => sessionState.building;

export function useSession() {
  return useSyncExternalStore(addListener, getUser);
}

export function useCurrentBuilding() {
  return useSyncExternalStore(addListener, getBuilding);
}

export function setSession(user) {
  commitState(user, sessionState.building);
}

export function setCurrentBuilding(building) {
  commitState(sessionState.user, building);
}

export function clearCurrentBuilding() {
  commitState(sessionState.user, null);
}

export function clearSession() {
  commitState(null, null);
}

export async function loadAccountState() {
  try {
    const res = await window.electronAPI.getSetupState();
    accountState = res?.success ? { needsSetup: res.needsSetup, username: res.username } : ASSUME_SETUP_DONE;
  } catch (err) {
    console.error("[useSession] getSetupState:", err);
    accountState = ASSUME_SETUP_DONE;
  }
}

export function markSetupComplete(username) {
  accountState = { needsSetup: false, username };
}

export const needsSetup = () => accountState.needsSetup;
export const savedUsername = () => accountState.username;
