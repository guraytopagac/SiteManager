// The shared label and value row of the two detail panels and the history card. An empty value prints the
// dash here, so no caller tests for null. The one page that stretches its rows overrides padding itself.

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
