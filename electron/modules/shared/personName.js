// Person names are stored with each word capitalised and the rest lower case, whatever case the
// user typed. Turkish rules apply, so "i" becomes "İ" and "I" becomes "ı". Used by auth, resident
// and dues, the three domains that take a person's name.

function capitalize(part) {
  return part.charAt(0).toLocaleUpperCase("tr") + part.slice(1).toLocaleLowerCase("tr");
}

// Trims and collapses inner whitespace too, so callers do not trim first. Hyphenated names count
// as separate words.
function formatPersonName(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.split("-").map(capitalize).join("-"))
    .join(" ");
}

module.exports = { formatPersonName };
