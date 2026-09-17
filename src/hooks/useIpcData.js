// Reads screen data through the use() hook, so a page suspends until its data is ready and never paints an
// empty skeleton. Failures come back as an ordinary result object, so pages carry no try/catch of their own.

import { use, useDeferredValue, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";

// One in-flight promise per key. The entry is removed when the component that holds it unmounts, so every
// page entry and every modal open reads fresh data while a double render shares a single request.
const requests = new Map();

async function callIpc(method, payload) {
  try {
    return await window.electronAPI[method](payload);
  } catch (err) {
    console.error(`[useIpcData] ${method}:`, err);
    return { success: false, message: UNEXPECTED_ERROR_MESSAGE };
  }
}

export function useIpcData(method, payload) {
  const location = useLocation();
  const [version, setVersion] = useState(0);
  // Deferred so a period change or a reload keeps the previous rows on screen until the new data lands.
  // Callers therefore never have to wrap the change in a transition themselves.
  const key = useDeferredValue(JSON.stringify([location.key, version, method, payload]));

  if (!requests.has(key)) {
    // Arguments are read back out of the key rather than taken from the props, because the key lags behind
    // by design and the stored request has to match the key it is filed under.
    const [, , keyMethod, keyPayload] = JSON.parse(key);
    requests.set(key, callIpc(keyMethod, keyPayload));
  }
  const promise = requests.get(key);

  useEffect(() => {
    requests.set(key, promise);
    return () => requests.delete(key);
  }, [key, promise]);

  const reload = () => setVersion((current) => current + 1);

  return [use(promise), reload];
}
