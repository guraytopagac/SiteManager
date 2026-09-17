// Page state and slicing for every paged list. The state lives here rather than inside the Pager component
// because the caller is the one that needs the sliced list to render its own rows.

import { useState } from "react";

export function usePagination(items, pageSize, resetKey = "") {
  const [page, setPage] = useState(1);
  const [seenKey, setSeenKey] = useState(resetKey);

  // Reset during render rather than in an effect, otherwise a filter change would paint one frame with the
  // old page number before correcting itself.
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Clamped on read, because the list can shrink under the stored page without the reset key changing.
  const currentPage = Math.min(page, pageCount);
  const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return { pageItems, currentPage, pageCount, setPage };
}
