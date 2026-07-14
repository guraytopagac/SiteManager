import { useState, useEffect, useCallback } from "react";

/**
 * Fetches the dues list for a manager for a given year/month.
 * Shared by the read-only view page and the management page.
 */
export function useDues(managerId, year, month) {
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const refetch = useCallback(async () => {
    if (!managerId) return;
    setLoading(true);
    setErrorMessage("");
    const response = await window.electronAPI.getDuesForMonth(managerId, year, month);
    if (response.success) {
      setDues(response.data);
    } else {
      setErrorMessage(response.message || "Veriler alınamadı.");
    }
    setLoading(false);
  }, [managerId, year, month]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!managerId) return;
      setLoading(true);
      setErrorMessage("");
      const response = await window.electronAPI.getDuesForMonth(managerId, year, month);
      if (cancelled) return;
      if (response.success) {
        setDues(response.data);
      } else {
        setErrorMessage(response.message || "Veriler alınamadı.");
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [managerId, year, month]);

  return { dues, loading, errorMessage, refetch };
}
