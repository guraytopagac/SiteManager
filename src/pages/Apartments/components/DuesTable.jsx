import { STATUS_LABELS } from "../constants";

/**
 * Renders the dues table. Behaves as read-only by default; pass `onStatusClick`
 * to make the status badge clickable (payment), and `renderRowActions` to add an
 * actions column (edit/delete). Neither prop → pure read-only view.
 */
function DuesTable({ dues, onStatusClick, renderRowActions }) {
  const hasActions = typeof renderRowActions === "function";
  const columnCount = hasActions ? 9 : 8;

  return (
    <table className="apartment-table">
      <thead>
        <tr>
          <th>Daire No</th>
          <th>Kat</th>
          <th>Tip</th>
          <th>m²</th>
          <th>Sakin</th>
          <th>Aidat</th>
          <th>Ödenen</th>
          <th>Durum</th>
          {hasActions && <th>İşlem</th>}
        </tr>
      </thead>
      <tbody>
        {dues.length === 0 ? (
          <tr>
            <td colSpan={columnCount} className="table-empty-cell">
              Kayıtlı daire bulunamadı.
            </td>
          </tr>
        ) : (
          dues.map((due) => (
            <tr key={due.apartment_id}>
              <td>{due.apartment_no}</td>
              <td>{due.floor}</td>
              <td>{due.type}</td>
              <td>{due.square_meters}</td>
              <td className="resident-cell">
                {due.resident_name || <span className="resident-empty">—</span>}
              </td>
              <td>{due.due_amount.toLocaleString("tr-TR")} ₺</td>
              <td>{due.paid_amount.toLocaleString("tr-TR")} ₺</td>
              <td>
                {onStatusClick ? (
                  <button className={`status-badge status-${due.status}`} onClick={() => onStatusClick(due)}>
                    {STATUS_LABELS[due.status]}
                  </button>
                ) : (
                  <span className={`status-badge status-${due.status} status-badge-static`}>
                    {STATUS_LABELS[due.status]}
                  </span>
                )}
              </td>
              {hasActions && <td className="action-cell">{renderRowActions(due)}</td>}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default DuesTable;
