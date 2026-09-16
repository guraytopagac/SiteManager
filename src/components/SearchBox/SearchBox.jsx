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
