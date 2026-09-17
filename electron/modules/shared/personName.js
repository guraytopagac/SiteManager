// Person names are stored with each word capitalised and the rest lower case, whatever the user typed.
// Turkish rules apply, so "i" becomes "İ" and "I" becomes "ı".

function capitalize(part) {
  return part.charAt(0).toLocaleUpperCase("tr") + part.slice(1).toLocaleLowerCase("tr");
}

// Trims and collapses inner whitespace too, so callers do not trim first. Hyphenated names count as words.
function formatPersonName(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.split("-").map(capitalize).join("-"))
    .join(" ");
}

module.exports = { formatPersonName };
