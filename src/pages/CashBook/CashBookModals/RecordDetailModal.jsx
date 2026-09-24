// Everything that can be done to one record. A cancelled record offers nothing, and an income created by a
// collection can only be cancelled through that collection, so a note names the route instead: the dues page
// for a monthly charge, the investment page for a fund contribution. An expense paid out of the investment
// fund says so and is cancelled here like any other. A payout belongs to the fund page and offers nothing, a
// transfer into the severance fund can be cancelled but prints no voucher. A transfer between cash and bank
// prints nothing either, it only moves money inside the main cash, and an advance or its repayment names the
// employee and prints nothing as well. A dues refund can be neither cancelled nor printed, and a dues income
// whose payment was refunded stays in the ledger but has nothing left to cancel or print.

import { FiInfo, FiX } from "react-icons/fi";
import "./CashBookModals.css";
import DetailRow from "@/components/DetailRow/DetailRow";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { ADVANCE_CATEGORIES, CASH_ACCOUNT_LABELS, TRANSACTION_CATEGORY_LABELS } from "@/utils/constants";
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
  transfer: {
    title: "Aktarım Detayı",
    cancelLabel: "Aktarımı İptal Et",
  },
};

const COLLECTED_INCOME_NOTES = {
  dues: (
    <>
      Bu kayıt bir aidat tahsilatından oluşturuldu ve buradan iptal edilemez. Geri almak için <b>Aidat Takibi</b>{" "}
      sayfasından ilgili tahsilatı iptal edin.
    </>
  ),
  investment_dues: (
    <>
      Bu kayıt bir yatırım aidatı tahsilatından oluşturuldu ve buradan iptal edilemez. Geri almak için{" "}
      <b>Yatırım Aidatı</b> sayfasından ilgili tahsilatı iptal edin.
    </>
  ),
};

const INVESTMENT_EXPENSE_NOTE = "Bu gider yatırım fonundan ödendi ve fonun bakiyesinden düşülür.";

const REFUND_NOTE = (
  <>
    Bu kayıt bir peşin aidat iadesidir ve iptal edilemez. Yanlış bir iade, <b>Aidat Takibi</b>&apos;nden peşin tahsilat
    olarak yeniden girilmelidir.
  </>
);

const REFUNDED_INCOME_NOTE =
  "Bu tahsilat daha sonra iade edildi. Para bu tarihte kasaya girdi, iade günü ayrı bir gider olarak kasadan çıktı.";

const FUND_TRANSFER_NOTE = "Bu kayıt ana kasadan tazminat kasasına yapılan bir aktarımdır.";

const FUND_PAYOUT_NOTE = (
  <>
    Bu ödeme tazminat kasasından yapıldı ve ana kasanın toplamına girmez. Ödemeyi iptal etmek için <b>Personel</b>{" "}
    sayfasını kullanın.
  </>
);

function DetailNote({ children }) {
  return (
    <div className="cb-detail-note">
      <span className="cb-detail-note-icon" aria-hidden="true">
        <FiInfo />
      </span>
      <p>{children}</p>
    </div>
  );
}

function RecordDetailModal({ transaction, description, building, onClose, onCreateDocument, onCancel }) {
  const text = TYPES[transaction.type];
  const isCancelled = Boolean(transaction.is_cancelled);
  const collectedNote = COLLECTED_INCOME_NOTES[transaction.category];
  const isInvestmentExpense = transaction.is_investment === 1;
  const isFundPayout = transaction.type === "severance_payout";
  const isFundTransfer = transaction.category === "severance_fund";
  const isAdvance = ADVANCE_CATEGORIES.includes(transaction.category);
  const isRefund = transaction.category === "dues_refund";
  const isRefunded = transaction.is_refunded === 1;
  const hasDocument =
    !isAdvance &&
    !isRefunded &&
    (transaction.type === "income" || (transaction.type === "expense" && !isFundTransfer && !isRefund));
  // A refund is final, and a refunded income has no payment left to cancel through the dues page either.
  const hasActions = !isCancelled && !isFundPayout && !isRefund && !isRefunded;
  // Only income and expense name an account. A transfer says its direction in the category.
  const hasAccount = transaction.type === "income" || transaction.type === "expense";

  useEscapeKey(onClose);

  return (
    <div className="cb-md-overlay">
      <div className="cb-md-box">
        <div className="cb-md-head">
          <div className="cb-md-identity">
            <h2 className="cb-md-title">{text.title}</h2>
            <span className="cb-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button type="button" className="cb-md-close" onClick={onClose} aria-label="Kapat">
            <FiX />
          </button>
        </div>

        <div className="cb-md-body">
          <dl className="cb-detail-list">
            <DetailRow label="Tarih" value={formatDate(transaction.date)} />
            <DetailRow
              label="Kategori"
              value={TRANSACTION_CATEGORY_LABELS[transaction.category] ?? transaction.category}
            />
            <DetailRow label="Tutar" value={formatCurrency(transaction.amount)} />
            {hasAccount ? <DetailRow label="Ödeme Tipi" value={CASH_ACCOUNT_LABELS[transaction.account]} /> : null}
            {isInvestmentExpense ? <DetailRow label="Ödeme Kaynağı" value="Yatırım fonu" /> : null}
            {isAdvance ? <DetailRow label="Çalışan" value={transaction.employee_name} /> : null}
            <DetailRow label={transaction.type === "severance_payout" ? "Çalışan" : "Açıklama"} value={description} />
            <DetailRow label="Kaydı Giren" value={transaction.entered_by} />
            {isCancelled ? <DetailRow label="İptal Tarihi" value={formatDate(transaction.cancelled_at)} /> : null}
            {isCancelled ? <DetailRow label="İptal Nedeni" value={transaction.cancel_reason} /> : null}
            {isCancelled ? <DetailRow label="İptal Eden" value={transaction.cancelled_by_name} /> : null}
          </dl>

          {collectedNote && !isCancelled && !isRefunded ? <DetailNote>{collectedNote}</DetailNote> : null}
          {isRefunded ? <DetailNote>{REFUNDED_INCOME_NOTE}</DetailNote> : null}
          {isRefund && !isCancelled ? <DetailNote>{REFUND_NOTE}</DetailNote> : null}
          {isInvestmentExpense && !isCancelled ? <DetailNote>{INVESTMENT_EXPENSE_NOTE}</DetailNote> : null}
          {isFundPayout && !isCancelled ? <DetailNote>{FUND_PAYOUT_NOTE}</DetailNote> : null}
          {isFundTransfer && !isCancelled ? <DetailNote>{FUND_TRANSFER_NOTE}</DetailNote> : null}

          {hasActions ? (
            <div className="cb-md-actions">
              {hasDocument ? (
                <button type="button" className="cb-md-btn-solid" onClick={onCreateDocument}>
                  {text.documentLabel}
                </button>
              ) : null}
              {collectedNote ? null : (
                <button type="button" className="cb-md-btn-danger" onClick={onCancel}>
                  {isFundTransfer ? "Aktarımı İptal Et" : text.cancelLabel}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default RecordDetailModal;
