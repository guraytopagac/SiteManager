// Shared by every paged list. Table shells stay twinned per page because each owns its column widths and
// page size, while paging has no such measurement. The row is always shown, the buttons tell if it is usable.

import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import "./Pager.css";

function Pager({ currentPage, pageCount, onChange }) {
  return (
    <div className="pager">
      <button
        type="button"
        className="pager-btn"
        onClick={() => onChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Önceki sayfa"
      >
        <FiChevronLeft />
      </button>
      <span className="pager-info">
        Sayfa {currentPage} / {pageCount}
      </span>
      <button
        type="button"
        className="pager-btn"
        onClick={() => onChange(Math.min(pageCount, currentPage + 1))}
        disabled={currentPage === pageCount}
        aria-label="Sonraki sayfa"
      >
        <FiChevronRight />
      </button>
    </div>
  );
}

export default Pager;
