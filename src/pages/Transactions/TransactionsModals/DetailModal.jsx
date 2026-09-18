// Everything that can be done to one record. A cancelled record offers nothing, and an income created by a
// collection can only be cancelled through that collection, so a note names the route instead. A payout
// belongs to the fund page and offers nothing, a transfer into the fund can be cancelled but prints no voucher.

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
  severance_payout: {
    title: "Tazminat Ödemesi",
  },
};

const DUES_INCOME_NOTE =
  "Bu kayıt bir aidat tahsilatından oluşturuldu ve buradan iptal edilemez. Geri almak için Aidat Takibi sayfasından ilgili tahsilatı iptal edin.";

const FUND_TRANSFER_NOTE = "Bu kayıt ana kasadan tazminat kasasına yapılan bir aktarımdır.";

const FUND_PAYOUT_NOTE =
  "Bu ödeme tazminat kasasından yapıldı ve ana kasanın toplamına girmez. Ödemeyi iptal etmek için Tazminat Kasası sayfasını kullanın.";

function DetailModal({ transaction, building, onClose, onCreateDocument, onCancel }) {
  const text = TYPES[transaction.type];
  const isCancelled = Boolean(transaction.is_cancelled);
  const isDuesIncome = transaction.category === "dues";
  const isFundPayout = transaction.type === "severance_payout";
  const isFundTransfer = transaction.category === "severance_fund";

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
            <DetailRow
              label={transaction.type === "severance_payout" ? "Çalışan" : "Açıklama"}
              value={transaction.description}
            />
            {isCancelled ? <DetailRow label="İptal Tarihi" value={formatDate(transaction.cancelled_at)} /> : null}
            {isCancelled ? <DetailRow label="İptal Nedeni" value={transaction.cancel_reason} /> : null}
          </dl>

          {isDuesIncome && !isCancelled ? <p className="tx-detail-note">{DUES_INCOME_NOTE}</p> : null}
          {isFundPayout && !isCancelled ? <p className="tx-detail-note">{FUND_PAYOUT_NOTE}</p> : null}
          {isFundTransfer && !isCancelled ? <p className="tx-detail-note">{FUND_TRANSFER_NOTE}</p> : null}

          {isCancelled || isFundPayout ? null : (
            <div className="tx-md-actions">
              {isFundTransfer ? null : (
                <button type="button" className="tx-md-btn-solid" onClick={onCreateDocument}>
                  {text.documentLabel}
                </button>
              )}
              {isDuesIncome ? null : (
                <button type="button" className="tx-md-btn-danger" onClick={onCancel}>
                  {isFundTransfer ? "Aktarımı İptal Et" : text.cancelLabel}
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
