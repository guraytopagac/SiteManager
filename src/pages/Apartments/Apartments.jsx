import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import "./Apartments.css";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { alert } from "../../utils/alert";

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const STATUS_LABELS = {
  unpaid: "Ödenmedi",
  partial: "Kısmen Ödendi",
  paid: "Ödendi",
};

const PAYMENT_METHOD_LABELS = {
  cash: "Nakit",
  bank_transfer: "Havale / EFT",
  card: "Kredi Kartı",
  other: "Diğer",
};

const APARTMENT_TYPES = ["1+1", "2+1", "3+1", "4+1"];

function EditModal({ apartment, onClose, onSaved }) {
  const [form, setForm] = useState({
    apartment_no: apartment.apartment_no || "",
    floor: apartment.floor ?? "",
    type: apartment.type || "1+1",
    square_meters: apartment.square_meters ?? "",
    due_amount: apartment.due_amount ?? "",
    resident_name: apartment.resident_name || "",
    resident_phone: apartment.resident_phone || "",
    resident_email: apartment.resident_email || "",
    resident_national_id: apartment.resident_national_id || "",
    resident_type: apartment.resident_type || "tenant",
    resident_move_in_date: apartment.resident_move_in_date || "",
    resident_notes: apartment.resident_notes || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [residentHistory, setResidentHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = async () => {
    const res = await window.electronAPI.getResidentHistory(apartment.apartment_id);
    if (res.success) setResidentHistory(res.data);
    setShowHistory(true);
  };

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await window.electronAPI.updateApartment(apartment.id, {
      ...form,
      floor: Number(form.floor),
      square_meters: form.square_meters ? Number(form.square_meters) : null,
      due_amount: Number(form.due_amount),
    });
    setIsSubmitting(false);

    if (res.success) {
      await alert.success("Güncellendi", res.message);
      onSaved();
    } else {
      alert.error("Hata", res.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Daireyi Düzenle</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <h4 className="modal-section-title">Daire Bilgileri</h4>

          <div className="edit-form-grid">
            <div className="form-row">
              <label>Daire No</label>
              <input type="text" value={form.apartment_no} onChange={set("apartment_no")} required />
            </div>
            <div className="form-row">
              <label>Kat</label>
              <input type="number" value={form.floor} onChange={set("floor")} required />
            </div>
            <div className="form-row">
              <label>Tip</label>
              <select value={form.type} onChange={set("type")}>
                {APARTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>m²</label>
              <input type="number" step="0.1" value={form.square_meters} onChange={set("square_meters")} />
            </div>
            <div className="form-row">
              <label>Aidat (₺)</label>
              <input type="number" step="0.01" value={form.due_amount} onChange={set("due_amount")} required />
            </div>
          </div>

          <h4 className="modal-section-title modal-section-title-spaced">Sakin Bilgileri</h4>

          <div className="form-row">
            <label>Ad Soyad</label>
            <input type="text" placeholder="İsteğe bağlı" value={form.resident_name} onChange={set("resident_name")} />
          </div>
          <div className="form-row">
            <label>Telefon</label>
            <input type="tel" placeholder="İsteğe bağlı" value={form.resident_phone} onChange={set("resident_phone")} />
          </div>
          <div className="form-row">
            <label>E-posta</label>
            <input
              type="email"
              placeholder="İsteğe bağlı"
              value={form.resident_email}
              onChange={set("resident_email")}
            />
          </div>
          <div className="form-row">
            <label>TC Kimlik No</label>
            <input
              type="text"
              maxLength={11}
              placeholder="11 haneli TC kimlik"
              value={form.resident_national_id}
              onChange={set("resident_national_id")}
            />
          </div>
          <div className="form-row">
            <label>Sakin Türü</label>
            <select value={form.resident_type} onChange={set("resident_type")}>
              <option value="tenant">Kiracı</option>
              <option value="owner">Malik</option>
            </select>
          </div>
          <div className="form-row">
            <label>Giriş Tarihi</label>
            <input type="date" value={form.resident_move_in_date} onChange={set("resident_move_in_date")} />
          </div>
          <div className="form-row">
            <label>Notlar</label>
            <textarea
              rows={2}
              placeholder="Sakin hakkında not"
              value={form.resident_notes}
              onChange={set("resident_notes")}
            />
          </div>

          {showHistory ? (
            <div className="resident-history-section">
              <h4 className="modal-section-title modal-section-title-spaced">Sakin Geçmişi</h4>
              {residentHistory.length === 0 ? (
                <p className="history-empty">Geçmiş sakin kaydı bulunamadı.</p>
              ) : (
                <ul className="resident-history-list">
                  {residentHistory.map((r) => (
                    <li key={r.id} className={`resident-history-item ${r.is_active ? "active" : ""}`}>
                      <span className="rh-name">{r.full_name}</span>
                      <span className="rh-type">{r.resident_type === "owner" ? "Malik" : "Kiracı"}</span>
                      <span className="rh-dates">
                        {r.move_in_date || "?"} → {r.move_out_date || "devam"}
                      </span>
                      {r.is_active === 1 && <span className="rh-active-badge">Aktif</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <button type="button" className="button button-secondary button-sm history-btn" onClick={fetchHistory}>
              Sakin Geçmişini Gör
            </button>
          )}

          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              İptal
            </button>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ due, currentUser, onClose, onPaymentSaved }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [receiptPath, setReceiptPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    const res = await window.electronAPI.getPaymentHistory(due.id);
    if (res.success) setHistory(res.data);
    setHistoryLoading(false);
  }, [due.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setReceiptPath(file.path);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      alert.warning("Geçersiz Tutar", "Lütfen geçerli bir tutar girin.");
      return;
    }

    const remaining = due.due_amount - due.paid_amount;
    if (parsedAmount > remaining + 0.01) {
      alert.warning("Fazla Ödeme", `Kalan borç ${remaining.toLocaleString("tr-TR")} ₺. Daha fazlası girilemez.`);
      return;
    }

    setIsSubmitting(true);
    const res = await window.electronAPI.recordPayment(due.id, {
      amount: parsedAmount,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      receipt_path: receiptPath || null,
      note: note || null,
      collected_by: currentUser.id,
    });
    setIsSubmitting(false);

    if (res.success) {
      alert.success("Kaydedildi", res.message);
      setAmount("");
      setNote("");
      setReceiptPath("");
      setPaymentMethod("cash");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      onPaymentSaved();
      fetchHistory();
    } else {
      alert.error("Hata", res.message);
    }
  };

  const handleCancel = async (paymentId) => {
    const { value: reason } = await Swal.fire({
      title: "Ödemeyi İptal Et",
      input: "textarea",
      inputLabel: "İptal Nedeni",
      inputPlaceholder: "Lütfen iptal nedenini yazın...",
      showCancelButton: true,
      confirmButtonText: "İptal Et",
      cancelButtonText: "Vazgeç",
      confirmButtonColor: "#dc2626",
      heightAuto: false,
      preConfirm: (val) => {
        if (!val?.trim()) Swal.showValidationMessage("İptal nedeni zorunludur.");
        return val?.trim();
      },
    });

    if (!reason) return;

    const res = await window.electronAPI.cancelPayment(paymentId, reason, currentUser.id);
    if (res.success) {
      alert.success("İptal Edildi", res.message, 1800);
      onPaymentSaved();
      fetchHistory();
    } else {
      alert.error("Hata", res.message);
    }
  };

  const remaining = due.due_amount - due.paid_amount;
  const isPaid = due.status === "paid";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-subtitle">
              {MONTHS[due.month - 1]} {due.year}
            </p>
            <h3 className="modal-title">Daire {due.apartment_no}</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-due-summary">
          <div className="due-summary-item">
            <span>Aidat</span>
            <strong>{due.due_amount.toLocaleString("tr-TR")} ₺</strong>
          </div>
          <div className="due-summary-item">
            <span>Ödenen</span>
            <strong className="color-paid">{due.paid_amount.toLocaleString("tr-TR")} ₺</strong>
          </div>
          <div className="due-summary-item">
            <span>Kalan</span>
            <strong className={remaining > 0 ? "color-unpaid" : "color-paid"}>
              {remaining.toLocaleString("tr-TR")} ₺
            </strong>
          </div>
        </div>

        {!isPaid && (
          <form className="payment-form" onSubmit={handleSubmit}>
            <h4 className="modal-section-title">Ödeme Ekle</h4>
            <div className="form-row">
              <label>Ödeme Yöntemi</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Ödenen Tutar (₺)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={remaining}
                placeholder={`Maks. ${remaining.toLocaleString("tr-TR")} ₺`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <label>Ödeme Tarihi</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Açıklama / Not</label>
              <textarea
                rows={2}
                placeholder="İsteğe bağlı not..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {paymentMethod === "transfer" && (
              <div className="form-row">
                <label>Dekont Yükle</label>
                <input type="file" accept="image/*,.pdf" onChange={handleFileChange} />
                {receiptPath && <span className="receipt-name">{receiptPath.split(/[\\/]/).pop()}</span>}
              </div>
            )}
            <button type="submit" className="button button-full-width" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor..." : "Ödemeyi Kaydet"}
            </button>
          </form>
        )}

        {isPaid && <div className="paid-notice">Bu aya ait aidat tamamen ödenmiştir.</div>}

        <div className="payment-history">
          <h4 className="modal-section-title">Ödeme Geçmişi</h4>
          {historyLoading ? (
            <p className="history-empty">Yükleniyor...</p>
          ) : history.length === 0 ? (
            <p className="history-empty">Henüz ödeme kaydı yok.</p>
          ) : (
            <ul className="history-list">
              {history.map((p) => (
                <li key={p.id} className={`history-item ${p.cancel_reason ? "cancelled" : ""}`}>
                  <div className="history-main">
                    <span className="history-amount">{p.amount.toLocaleString("tr-TR")} ₺</span>
                    <span className="history-method">{PAYMENT_METHOD_LABELS[p.payment_method]}</span>
                    <span className="history-date">{p.payment_date}</span>
                  </div>
                  <div className="history-meta">
                    <span>Tahsil eden: {p.collected_by_username}</span>
                    {p.note && <span> · {p.note}</span>}
                    {p.cancel_reason && (
                      <span className="cancel-reason">
                        {" "}· İptal: {p.cancel_reason}
                        {p.cancelled_by_username && ` (${p.cancelled_by_username})`}
                      </span>
                    )}
                  </div>
                  {!p.cancel_reason && (
                    <button className="cancel-btn" onClick={() => handleCancel(p.id)}>
                      İptal Et
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function BulkUpdateModal({ currentUser, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      alert.warning("Geçersiz Tutar", "Lütfen geçerli bir aidat tutarı girin.");
      return;
    }

    const confirm = await alert.confirm(
      "Toplu Aidat Güncelleme",
      `Tüm dairelerin aidat tutarı ${parsed.toLocaleString("tr-TR")} ₺ olarak güncellenecek. Onaylıyor musunuz?`,
      "Evet, Güncelle",
    );
    if (!confirm.isConfirmed) return;

    setIsSubmitting(true);
    const res = await window.electronAPI.bulkUpdateDueAmount(currentUser.id, parsed);
    setIsSubmitting(false);

    if (res.success) {
      await alert.success("Güncellendi", res.message);
      onSaved();
    } else {
      alert.error("Hata", res.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Toplu Aidat Güncelleme</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="modal-description">
          Tüm dairelerinizin aidat tutarını tek seferde güncelleyin. Bu işlem mevcut daire aidat tutarlarını değiştirir;
          önceki ödeme kayıtları etkilenmez.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Yeni Aidat Tutarı (₺)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="Örn: 2000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              İptal
            </button>
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? "Güncelleniyor..." : "Güncelle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Apartments() {
  const navigate = useNavigate();
  const now = new Date();
  const currentUser = useCurrentUser();

  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedDue, setSelectedDue] = useState(null);
  const [editingApartment, setEditingApartment] = useState(null);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  const fetchDues = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    if (!currentUser?.id) {
      navigate("/", { replace: true });
      return;
    }

    const response = await window.electronAPI.getDuesForMonth(currentUser.id, selectedYear, selectedMonth);
    if (response.success) {
      setDues(response.data);
    } else {
      setErrorMessage(response.message || "Veriler alınamadı.");
    }
    setLoading(false);
  }, [currentUser?.id, selectedYear, selectedMonth, navigate]);

  useEffect(() => {
    fetchDues();
  }, [fetchDues]);

  useEffect(() => {
    setSelectedDue((prev) => (prev ? dues.find((d) => d.id === prev.id) || prev : null));
  }, [dues]);

  const handlePaymentSaved = useCallback(async () => {
    await fetchDues();
  }, [fetchDues]);

  const handleDelete = async (due) => {
    const result = await Swal.fire({
      title: "Daireyi Sil",
      html: `<b>Daire ${due.apartment_no}</b> silinecek.<br/>Bu daireye ait tüm aidat kayıtları da kalıcı olarak silinir.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Evet, Sil",
      cancelButtonText: "Vazgeç",
      confirmButtonColor: "#dc2626",
      heightAuto: false,
    });

    if (!result.isConfirmed) return;

    const res = await window.electronAPI.deleteApartment(due.apartment_id);
    if (res.success) {
      await alert.success("Silindi", res.message);
      fetchDues();
    } else {
      alert.error("Hata", res.message);
    }
  };

  const totalDue = dues.reduce((sum, d) => sum + d.due_amount, 0);
  const totalPaid = dues.reduce((sum, d) => sum + d.paid_amount, 0);
  const paidCount = dues.filter((d) => d.status === "paid").length;
  const partialCount = dues.filter((d) => d.status === "partial").length;
  const unpaidCount = dues.filter((d) => d.status === "unpaid").length;

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) yearOptions.push(y);

  if (loading) return <div className="loading">Verileriniz Yükleniyor...</div>;
  if (errorMessage)
    return (
      <div className="loading">
        {errorMessage}{" "}
        <button className="button" onClick={fetchDues}>
          Yeniden Dene
        </button>
      </div>
    );

  return (
    <div className="apartments-container">
      <div className="apartments-header">
        <h2>Daire Listesi</h2>
        <div className="header-actions">
          <button className="button button-secondary button-sm" onClick={() => setShowBulkUpdate(true)}>
            Toplu Aidat Güncelle
          </button>
          <div className="month-selector">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
              {MONTHS.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="dues-summary">
        <div className="summary-item paid">
          <span className="summary-count">{paidCount}</span>
          <span className="summary-label">Ödendi</span>
        </div>
        <div className="summary-item partial">
          <span className="summary-count">{partialCount}</span>
          <span className="summary-label">Kısmen Ödendi</span>
        </div>
        <div className="summary-item unpaid">
          <span className="summary-count">{unpaidCount}</span>
          <span className="summary-label">Ödenmedi</span>
        </div>
        <div className="summary-item total">
          <span className="summary-count">{totalPaid.toLocaleString("tr-TR")} ₺</span>
          <span className="summary-label">/ {totalDue.toLocaleString("tr-TR")} ₺ Tahsilat</span>
        </div>
      </div>

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
              <td colSpan={9} className="table-empty-cell">
                Kayıtlı daire bulunamadı.
              </td>
            </tr>
          ) : (
            dues.map((due) => (
              <tr key={due.id}>
                <td>{due.apartment_no}</td>
                <td>{due.floor}</td>
                <td>{due.type}</td>
                <td>{due.square_meters}</td>
                <td className="resident-cell">{due.resident_name || <span className="resident-empty">—</span>}</td>
                <td>{due.due_amount.toLocaleString("tr-TR")} ₺</td>
                <td>{due.paid_amount.toLocaleString("tr-TR")} ₺</td>
                <td>
                  <button className={`status-badge status-${due.status}`} onClick={() => setSelectedDue(due)}>
                    {STATUS_LABELS[due.status]}
                  </button>
                </td>
                <td className="action-cell">
                  <button className="action-btn edit-btn" onClick={() => setEditingApartment(due)} title="Düzenle">
                    ✏️
                  </button>
                  <button className="action-btn delete-btn" onClick={() => handleDelete(due)} title="Sil">
                    🗑️
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <hr className="section-divider" />

      <div className="return-link">
        <button onClick={() => navigate("/dashboard")} className="button">
          Geri Dön
        </button>
      </div>

      {selectedDue && (
        <PaymentModal
          due={selectedDue}
          currentUser={currentUser}
          onClose={() => setSelectedDue(null)}
          onPaymentSaved={handlePaymentSaved}
        />
      )}

      {editingApartment && (
        <EditModal
          apartment={editingApartment}
          onClose={() => setEditingApartment(null)}
          onSaved={() => {
            setEditingApartment(null);
            fetchDues();
          }}
        />
      )}

      {showBulkUpdate && (
        <BulkUpdateModal
          currentUser={currentUser}
          onClose={() => setShowBulkUpdate(false)}
          onSaved={() => {
            setShowBulkUpdate(false);
            fetchDues();
          }}
        />
      )}
    </div>
  );
}

export default Apartments;
