import { STATUS_LABELS } from "../constants";
import { formatCurrency } from "@/utils/currency";

function DuesTable({ dues, onStatusClick, renderRowActions }) {
  const COLUMN_COUNT = 9;

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
          <th>İşlem</th>
        </tr>
      </thead>
      <tbody>
        {dues.length === 0 ? (
          <tr>
            <td colSpan={COLUMN_COUNT} className="table-empty-cell">
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
              <td className="resident-cell">{due.resident_name || <span className="resident-empty">—</span>}</td>
              <td>{formatCurrency(due.due_amount)}</td>
              <td>{formatCurrency(due.paid_amount)}</td>
              <td>
                <button className={`status-badge status-${due.status}`} onClick={() => onStatusClick(due)}>
                  {STATUS_LABELS[due.status]}
                </button>
              </td>
              <td className="action-cell">{renderRowActions(due)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default DuesTable;
