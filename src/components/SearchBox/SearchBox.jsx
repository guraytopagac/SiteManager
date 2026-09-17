// The search field of the list pages. One text prop feeds the placeholder and the accessible name, since the
// wrapping label holds only an icon. The growth rules live here, both control bars want the same behaviour.

import { FiSearch } from "react-icons/fi";
import "./SearchBox.css";

function SearchBox({ label, value, onChange }) {
  return (
    <label className="search-box">
      <FiSearch size={18} aria-hidden="true" />
      <input
        type="text"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default SearchBox;
