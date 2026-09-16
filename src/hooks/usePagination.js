import { useState } from "react";

export function usePagination(items, pageSize, resetKey = "") {
  const [page, setPage] = useState(1);
  const [seenKey, setSeenKey] = useState(resetKey);

  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return { pageItems, currentPage, pageCount, setPage };
}
