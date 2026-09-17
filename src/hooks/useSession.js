// The only owner of the session. The account and the selected building are two fields of one state, since
// they share a storage key and are cleared together. Nothing else in the renderer writes to sessionStorage.

import { useSyncExternalStore } from "react";
import { getCurrentYear, setLedgerStartYear } from "@/utils/date";

const SESSION_KEY = "session";
const NO_SESSION = { user: null, building: null };
// The name states what the value means: not "there is no account" but "the state could not be read, assume
// setup happened". Landing on login by mistake is recoverable, opening setup over a live account is not.
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

// The single write path. Memory, storage and subscribers move together, and the untouched field is read back
// from the current state, so writing a building never drops the session. Objects are stored as they arrive.
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

// Resolved once before the tree mounts, which is why the readers below are plain functions: setup is a one-way
// door. The call also carries the first year of the ledger, handed to the date layer that owns it.
export async function loadAccountState() {
  try {
    const res = await window.electronAPI.getSetupState();
    if (res?.success) {
      accountState = { needsSetup: res.needsSetup, username: res.username };
      setLedgerStartYear(res.startYear);
    } else {
      accountState = ASSUME_SETUP_DONE;
    }
  } catch (err) {
    console.error("[useSession] getSetupState:", err);
    accountState = ASSUME_SETUP_DONE;
  }
}

export function markSetupComplete(username) {
  accountState = { needsSetup: false, username };
  setLedgerStartYear(getCurrentYear());
}

export function setSavedUsername(username) {
  accountState = { ...accountState, username };
}

export const needsSetup = () => accountState.needsSetup;
export const savedUsername = () => accountState.username;
