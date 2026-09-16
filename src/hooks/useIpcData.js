import { use, useDeferredValue, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";

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
  const key = useDeferredValue(JSON.stringify([location.key, version, method, payload]));

  if (!requests.has(key)) {
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
