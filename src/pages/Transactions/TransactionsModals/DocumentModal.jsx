// Builds the printable document for one record and lists every value it will print. A dues receipt has no
// editable field: its payer is that month's resident, and another name would detach it from the record.

import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import "./TransactionsModals.css";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useSession } from "@/hooks/useSession";
import { buildTransactionDocumentHtml } from "@/pages/Transactions/TransactionsPdf/buildTransactionDocumentHtml";
import {
  documentFileName,
  receiptDescription,
  receiptPayerName,
  voucherDescription,
} from "@/pages/Transactions/TransactionsPdf/documentFigures";
import { PAYMENT_METHOD_LABELS, UNEXPECTED_ERROR_MESSAGE } from "@/utils/constants";
import { formatCurrency, formatCurrencyInWords } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import { showDialog } from "@/utils/dialog";

const TYPES = {
  income: {
    title: "Tahsilat Makbuzu",
    documentType: "receipt",
    savedTitle: "Makbuz Kaydedildi",
  },
  expense: {
    title: "Gider Pusulası",
    documentType: "voucher",
    savedTitle: "Gider Pusulası Kaydedildi",
  },
};

function DocRow({ label, htmlFor, isTotal, children }) {
  return (
    <div className={isTotal ? "tx-doc-row tx-doc-row--total" : "tx-doc-row"}>
      <dt>{htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function DocumentModal({ transaction, building, onClose, onSaved }) {
  const session = useSession();
  const text = TYPES[transaction.type];
  const isReceipt = transaction.type === "income";

  const [record, setRecord] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [payerName, setPayerName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.electronAPI.getDocument({
          id: transaction.id,
          buildingId: building.id,
          type: transaction.type,
        });
        if (res.success) {
          setRecord(res.data);
          setPayerName(receiptPayerName(res.data));
          setVendorName(res.data.vendor_name ?? "");
          setVendorAddress(res.data.vendor_address ?? "");
        } else {
          setLoadError(res.message);
        }
      } catch (err) {
        console.error("[DocumentModal] getDocument:", err);
        setLoadError(UNEXPECTED_ERROR_MESSAGE);
      }
    })();
  }, [transaction.id, transaction.type, building.id]);

  const organization = `${building.name} Yönetimi`;
  const isDuesReceipt = isReceipt && record?.apartment_no != null;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useEscapeKey(handleClose);

  const documentInfo = () => {
    if (isReceipt) {
      return { payer_name: payerName.trim() || null };
    }
    return { vendor_name: vendorName, vendor_address: vendorAddress };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const scope = { id: transaction.id, buildingId: building.id, type: transaction.type };
    setIsSubmitting(true);

    try {
      // Save, read back, then print: names are formatted on the way in and the printed one must be the stored
      // one. A dues receipt has nothing to store, so the save is skipped.
      let res = isDuesReceipt
        ? { success: true }
        : await window.electronAPI.saveDocumentInfo({ ...scope, ...documentInfo() });
      if (res.success) {
        res = await window.electronAPI.getDocument(scope);
      }

      if (res.success) {
        const filename = documentFileName(transaction.type, res.data, building.name);
        const html = buildTransactionDocumentHtml({
          type: transaction.type,
          data: res.data,
          buildingName: building.name,
          managerName: session.managerName,
        });
        // Reuses the report saving channel, the page size comes from the document's own stylesheet. The type
        // only selects the save dialog title.
        res = await window.electronAPI.saveReportFile({ filename, html, documentType: text.documentType });
        if (res.success) {
          showDialog.toast(text.savedTitle, res.message);
          onSaved();
        } else if (!res.cancelled) {
          showDialog.error("Hata", res.message);
        }
      } else {
        showDialog.error("Hata", res.message);
      }
    } catch (err) {
      console.error("[DocumentModal] createDocument:", err);
      showDialog.error("Hata", UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderReceiptRows = () => (
    <>
      <DocRow label="Yönetim">{organization}</DocRow>
      <DocRow label="Tarih">{formatDate(record.date)}</DocRow>
      {isDuesReceipt ? (
        <DocRow label="Ödeyen">{receiptPayerName(record)}</DocRow>
      ) : (
        <DocRow label="Ödeyen" htmlFor="doc-payer">
          <input
            id="doc-payer"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="Örn. Ayşe Demir"
            maxLength={60}
          />
        </DocRow>
      )}
      <DocRow label="Açıklama">{receiptDescription(record)}</DocRow>
      {record.payments.length > 0 ? (
        record.payments.map((payment) => (
          <DocRow key={payment.payment_method} label={PAYMENT_METHOD_LABELS[payment.payment_method]}>
            {formatCurrency(payment.amount)}
          </DocRow>
        ))
      ) : (
        <DocRow label="Ödeme Şekli">Kayıtlı değil</DocRow>
      )}
      <DocRow label="Toplam" isTotal>
        {formatCurrency(record.amount)}
      </DocRow>
      <DocRow label="Tutar Yazıyla">{formatCurrencyInWords(record.amount)}</DocRow>
      <DocRow label="Kaşe / İmza">{session.managerName}</DocRow>
    </>
  );

  const renderVoucherRows = () => (
    <>
      <DocRow label="Yönetim">{organization}</DocRow>
      <DocRow label="Tarih">{formatDate(record.date)}</DocRow>
      <DocRow label="Hizmeti Veren" htmlFor="doc-vendor">
        <input
          id="doc-vendor"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          placeholder="Örn. Hasan Kılıç"
          maxLength={100}
        />
      </DocRow>
      <DocRow label="Yapılan İş / Alınan Mal">{voucherDescription(record)}</DocRow>
      <DocRow label="Adres" htmlFor="doc-address">
        <textarea
          id="doc-address"
          value={vendorAddress}
          onChange={(e) => setVendorAddress(e.target.value)}
          placeholder="Örn. Mavikent Sitesi B Blok No: 28, Etimesgut / Ankara"
          maxLength={300}
        />
      </DocRow>
      <DocRow label="Tutar" isTotal>
        {formatCurrency(record.amount)}
      </DocRow>
      <DocRow label="Tutar Yazıyla">{formatCurrencyInWords(record.amount)}</DocRow>
      <DocRow label="Kaşe / İmza">{session.managerName}</DocRow>
    </>
  );

  const renderBody = () => {
    if (loadError) {
      return (
        <p className="tx-md-status" role="alert">
          {loadError}
        </p>
      );
    }

    if (!record) {
      return <p className="tx-md-status">Yükleniyor...</p>;
    }

    return (
      <>
        <dl className="tx-doc-list">{isReceipt ? renderReceiptRows() : renderVoucherRows()}</dl>
        {isDuesReceipt ? (
          <p className="tx-doc-note">
            Ödeyen o ayın daire sakinidir. Dairenin bu aya yaptığı bütün tahsilatlar tek makbuzda birleşir.
          </p>
        ) : null}
        <button type="submit" className="tx-md-btn-solid tx-md-submit" disabled={isSubmitting}>
          {isSubmitting ? "Hazırlanıyor..." : "PDF Oluştur"}
        </button>
      </>
    );
  };

  return (
    <div className="tx-md-overlay">
      <form className="tx-md-box" onSubmit={handleSubmit}>
        <div className="tx-md-head">
          <div className="tx-md-identity">
            <h2 className="tx-md-title">{text.title}</h2>
            <span className="tx-md-scope" title={building.name}>
              {building.name}
            </span>
          </div>
          <button
            type="button"
            className="tx-md-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Kapat"
          >
            <FiX />
          </button>
        </div>

        <div className="tx-md-body">{renderBody()}</div>
      </form>
    </div>
  );
}

export default DocumentModal;
