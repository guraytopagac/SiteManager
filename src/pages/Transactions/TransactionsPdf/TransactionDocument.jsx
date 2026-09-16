import { PAYMENT_METHOD_LABELS } from "@/utils/constants";
import { formatCurrency, formatCurrencyInWords } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import {
  organizationName,
  receiptDescription,
  receiptPayerName,
  textSizeClass,
  voucherDescription,
} from "./documentFigures";

const TITLES = {
  income: "TAHSİLAT MAKBUZU",
  expense: "GİDER PUSULASI",
};

const SIZES = {
  name: [40, 70],
  address: [60, 120, 220],
  text: [60, 150, 320],
  words: [60, 110],
};

const LONG_ORGANIZATION_NAME = 26;

const classNames = (...names) => names.filter(Boolean).join(" ");

function Header({ title, date, buildingName }) {
  const name = organizationName(buildingName);

  return (
    <header className="doc-top">
      <div className="org-box">
        <div className={classNames("org-name", name.length > LONG_ORGANIZATION_NAME && "org-name--compact")}>
          {name}
        </div>
        <div className="org-role">YÖNETİMİ</div>
      </div>
      <div className="doc-meta">
        <h1 className="doc-title">{title}</h1>
        <div className="doc-date">
          <span>Tarih</span>
          <span className="fill">{formatDate(date)}</span>
        </div>
      </div>
    </header>
  );
}

function InfoTable({ className, rows }) {
  return (
    <div className="table-frame">
      <table className={classNames("info-table", className)}>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={classNames(row.isTotal && "info-total", row.isTall && "info-tall") || undefined}
            >
              <th>{row.label}</th>
              <td className={classNames(!row.isStatic && "fill", row.sizeClass, row.isNumber && "num")}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CaptionedBox({ caption, boxClassName, children, footer }) {
  return (
    <div className="doc-field">
      <div className="section-caption">{caption}</div>
      <div className={classNames("doc-box", boxClassName)}>{children}</div>
      {footer ? <div className="doc-box-name">{footer}</div> : null}
    </div>
  );
}

function Sheet({ type, date, buildingName, amount, managerName, children }) {
  const words = formatCurrencyInWords(amount);

  return (
    <main className={`sheet sheet--${type}`}>
      <Header title={TITLES[type]} date={date} buildingName={buildingName} />

      <section className="doc-split doc-body">{children}</section>

      <section className="doc-bottom">
        <CaptionedBox
          caption="Tutar Yazıyla"
          boxClassName={classNames("doc-words-box fill", textSizeClass(words, ...SIZES.words))}
        >
          {words}
        </CaptionedBox>
        <CaptionedBox caption="Kaşe / İmza" footer={managerName} />
      </section>
    </main>
  );
}

function ReceiptBody({ receipt }) {
  const payerName = receiptPayerName(receipt);
  const description = receiptDescription(receipt);
  const paidByMethod = Object.fromEntries(receipt.payments.map((payment) => [payment.payment_method, payment.amount]));

  const methodRows = Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => ({
    label,
    value: method in paidByMethod ? formatCurrency(paidByMethod[method]) : "—",
    isNumber: true,
  }));

  return (
    <>
      <InfoTable
        className="doc-info"
        rows={[
          { label: "Ödeyen", value: payerName, sizeClass: textSizeClass(payerName, ...SIZES.name) },
          {
            label: "Açıklama",
            value: description,
            sizeClass: textSizeClass(description, ...SIZES.text),
            isTall: true,
          },
          { label: "Durum", value: "Tahsil edilmiştir.", isStatic: true },
        ]}
      />
      <InfoTable
        className="rc-methods"
        rows={[
          ...methodRows,
          { label: "Toplam", value: formatCurrency(receipt.amount), isNumber: true, isTotal: true },
        ]}
      />
    </>
  );
}

function VoucherBody({ voucher }) {
  const description = voucherDescription(voucher);
  const vendorName = voucher.vendor_name ?? "";
  const vendorAddress = voucher.vendor_address ?? "";

  return (
    <>
      <InfoTable
        className="doc-info"
        rows={[
          { label: "Hizmeti Veren", value: vendorName, sizeClass: textSizeClass(vendorName, ...SIZES.name) },
          {
            label: "Yapılan İş / Alınan Mal",
            value: description,
            sizeClass: textSizeClass(description, ...SIZES.text),
            isTall: true,
          },
          { label: "Adres", value: vendorAddress, sizeClass: textSizeClass(vendorAddress, ...SIZES.address) },
        ]}
      />
      <div className="vc-total">
        <div className="vc-total-label">Tutar</div>
        <div className="vc-total-value fill num">{formatCurrency(voucher.amount)}</div>
      </div>
    </>
  );
}

function TransactionDocument({ type, data, buildingName, managerName }) {
  return (
    <Sheet type={type} date={data.date} buildingName={buildingName} amount={data.amount} managerName={managerName}>
      {type === "income" ? <ReceiptBody receipt={data} /> : <VoucherBody voucher={data} />}
    </Sheet>
  );
}

export default TransactionDocument;
