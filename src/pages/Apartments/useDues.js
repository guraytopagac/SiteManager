import { useState, useEffect, useCallback } from "react";

/**
 * Fetches the dues list for a manager for a given year/month.
 * Shared by the read-only view page and the management page.
 */
export function useDues(buildingId, year, month) {
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const refetch = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    setErrorMessage("");
    const response = await window.electronAPI.getDuesForMonth({ buildingId, year, month });
    if (response.success) {
      setDues(response.data);
    } else {
      setErrorMessage(response.message || "Veriler alınamadı.");
    }
    setLoading(false);
  }, [buildingId, year, month]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (!buildingId) return;
      setLoading(true);
      setErrorMessage("");
      const response = await window.electronAPI.getDuesForMonth({ buildingId, year, month });
      if (!isMounted) return;
      if (response.success) {
        setDues(response.data);
      } else {
        setErrorMessage(response.message || "Veriler alınamadı.");
      }
      setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [buildingId, year, month]);

  return { dues, loading, errorMessage, refetch };
}
