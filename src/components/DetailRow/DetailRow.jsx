import "./DetailRow.css";

function DetailRow({ label, value, title }) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd title={title}>{value || "—"}</dd>
    </div>
  );
}

export default DetailRow;
