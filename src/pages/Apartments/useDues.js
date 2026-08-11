import { useState, useEffect, useCallback } from "react";

export function useDues(buildingId, year, month) {
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(
    async (isActive = () => true) => {
      if (!buildingId) return;
      setLoading(true);
      setErrorMessage("");

      const response = await window.electronAPI.getDuesForMonth({ buildingId, year, month });
      if (!isActive()) return;

      if (response.success) {
        setDues(response.data);
      } else {
        setErrorMessage(response.message || "Veriler alınamadı.");
      }
      setLoading(false);
    },
    [buildingId, year, month],
  );

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await load(() => isMounted);
    })();
    return () => {
      isMounted = false;
    };
  }, [load]);

  const refetch = useCallback(() => load(), [load]);

  return { dues, loading, errorMessage, refetch };
}
