// Everything about one employee and what can be done to them. The table row stays one line, so the details
// cut from it (leaving date, the eligibility sentence, whether an amount was paid) are spelled out here.
// A payout is offered only while the employee has not left, and it is cancelled from the movements list.

import { FiX } from "react-icons/fi";
import "./SeveranceFundModals.css";
import DetailRow from "@/components/DetailRow/DetailRow";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";

function DetailModal({ employee, building, onClose, onEdit, onPay }) {
  const hasLeft = Boolean(employee.end_date);

  useEscapeKey(onClose);

  let payoutRow;
  if (!hasLeft) {
    payoutRow = (
      <DetailRow
        label="Tahmini Tazminat"
        value={employee.is_eligible ? formatCurrency(employee.liability) : "1 yıl dolunca hak doğar"}
      />
    );
  } else if (employee.payout_id) {
    payoutRow = (
      <DetailRow
        label="Ödenen Tazminat"
        value={`${formatCurrency(employee.payout_amount)} · ${formatDate(employee.payout_date)}`}
      />
    );
  } else {
    payoutRow = <DetailRow label="Ödenen Tazminat" value="Ödeme yok" />;
  }

  return (
    <div className="sf-md-overlay">
      <div className="sf-md-box">
        <div className="sf-md-head">
          <div className="sf-md-identity">
            <h2 className="sf-md-title" title={employee.full_name}>
              {employee.full_name}
            </h2>
            <span className="sf-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button type="button" className="sf-md-close" onClick={onClose} aria-label="Kapat">
            <FiX />
          </button>
        </div>

        <div className="sf-md-body">
          <dl className="sf-md-details">
            <DetailRow label="Görev" value={employee.role} />
            <DetailRow label="İşe Giriş" value={formatDate(employee.start_date)} />
            {hasLeft ? <DetailRow label="Ayrılış" value={formatDate(employee.end_date)} /> : null}
            <DetailRow label="Çalışılan Gün" value={`${employee.worked_days.toLocaleString("tr-TR")} gün`} />
            <DetailRow label="Brüt Ücret" value={formatCurrency(employee.gross_wage)} />
            {payoutRow}
          </dl>

          <div className="sf-md-actions">
            <button type="button" className="sf-md-btn-outline" onClick={onEdit}>
              Çalışanı Düzenle
            </button>
            {hasLeft ? null : (
              <button type="button" className="sf-btn-solid" onClick={onPay}>
                Tazminatı Öde
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetailModal;
