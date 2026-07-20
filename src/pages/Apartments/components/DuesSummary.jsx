
function DuesSummary({ dues }) {
  const totalDue = dues.reduce((sum, d) => sum + d.due_amount, 0);
  const totalPaid = dues.reduce((sum, d) => sum + d.paid_amount, 0);
  const paidCount = dues.filter((d) => d.status === "paid").length;
  const partialCount = dues.filter((d) => d.status === "partial").length;
  const unpaidCount = dues.filter((d) => d.status === "unpaid").length;

  return (
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
  );
}

export default DuesSummary;
