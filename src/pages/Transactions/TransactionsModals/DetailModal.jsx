import { FiX } from "react-icons/fi";
import "./TransactionsModals.css";
import DetailRow from "@/components/DetailRow/DetailRow";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { TRANSACTION_CATEGORY_LABELS } from "@/utils/constants";
import { formatCurrency } from "@/utils/currency";
import { formatDate } from "@/utils/date";

const TYPES = {
  income: {
    title: "Gelir Detayı",
    documentLabel: "Makbuz Oluştur",
    cancelLabel: "Geliri İptal Et",
  },
  expense: {
    title: "Gider Detayı",
    documentLabel: "Gider Pusulası Oluştur",
    cancelLabel: "Gideri İptal Et",
  },
};

const DUES_INCOME_NOTE =
  "Bu kayıt bir aidat tahsilatından oluşturuldu ve buradan iptal edilemez. Geri almak için Aidat Takibi sayfasından ilgili tahsilatı iptal edin.";

function DetailModal({ transaction, building, onClose, onCreateDocument, onCancel }) {
  const text = TYPES[transaction.type];
  const isCancelled = Boolean(transaction.is_cancelled);
  const isDuesIncome = transaction.category === "dues";

  useEscapeKey(onClose);

  return (
    <div className="tx-md-overlay">
      <div className="tx-md-box">
        <div className="tx-md-head">
          <div className="tx-md-identity">
            <h2 className="tx-md-title">{text.title}</h2>
            <span className="tx-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button type="button" className="tx-md-close" onClick={onClose} aria-label="Kapat">
            <FiX />
          </button>
        </div>

        <div className="tx-md-body">
          <dl className="tx-detail-list">
            <DetailRow label="Tarih" value={formatDate(transaction.date)} />
            <DetailRow
              label="Kategori"
              value={TRANSACTION_CATEGORY_LABELS[transaction.category] ?? transaction.category}
            />
            <DetailRow label="Tutar" value={formatCurrency(transaction.amount)} />
            <DetailRow label="Açıklama" value={transaction.description} />
            {isCancelled ? <DetailRow label="İptal Tarihi" value={formatDate(transaction.cancelled_at)} /> : null}
            {isCancelled ? <DetailRow label="İptal Nedeni" value={transaction.cancel_reason} /> : null}
          </dl>

          {isDuesIncome && !isCancelled ? <p className="tx-detail-note">{DUES_INCOME_NOTE}</p> : null}

          {isCancelled ? null : (
            <div className="tx-md-actions">
              <button type="button" className="tx-md-btn-solid" onClick={onCreateDocument}>
                {text.documentLabel}
              </button>
              {isDuesIncome ? null : (
                <button type="button" className="tx-md-btn-danger" onClick={onCancel}>
                  {text.cancelLabel}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DetailModal;
