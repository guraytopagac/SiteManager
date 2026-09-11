// Which resident lived in an apartment during a given month. The dues list, the report and the
// residents overview all ask this and their answers have to match, so the query lives here instead
// of being written three times.
const { monthEnd, trToday } = require("./trTime");

// A row counts from the day it was recorded, which is the only date the user can actually know: a
// resident who moved in years ago cannot be dated, and the ledger does not reach back that far
// anyway. move_in_date overrides that day and is written in one case only, a move-out dated ahead
// whose successor is entered with it: that row is recorded today but belongs to the transfer day.
// The same key drives the filter and the ordering, which is what keeps the list stable: a resident
// recorded in October is excluded from September instead of merely losing a comparison. Both ends
// are compared against the cutoff day rather than the month, so a record that starts on the 25th
// does not answer for the 10th.
const EFFECTIVE_MOVE_IN = "COALESCE(r.move_in_date, date(r.created_at))";

// An apartment can hold an owner row and a tenant row at the same time, so "who lived here" needs
// an order between the two. The tenant is the one living in the flat, and the owner answers only
// for the months no tenant covers, which is why the priority beats the dates: an owner recorded
// long before the tenant would otherwise never lose. is_occupant then drops an owner who is kept
// only as a contact for a rented or empty flat. The flag is never cleared when a tenant arrives,
// so a month before the tenancy still names the owner who lived there then.
const OCCUPANT_FILTER = "AND r.is_occupant = 1";
const OCCUPANT_PRIORITY = "CASE WHEN r.resident_type = 'tenant' THEN 0 ELSE 1 END, ";
const OWNER_FILTER = "AND r.resident_type = 'owner'";

// The month's resident is whoever was living in the flat at the end of that month, and today for
// the month in progress. This cutoff is that instant. A move-out therefore takes effect the moment
// it is recorded instead of lingering until the month turns, which is what the user sees: the row
// leaves the table and the panel falls back to its empty state. The price is a month that ends
// empty, which names nobody even if someone lived there for most of it. That person is still in the
// apartment's resident history, which is where a closed record is read.
function periodCutoff(year, month) {
  const end = monthEnd(year, month);
  const today = trToday();
  return today < end ? today : end;
}

// A scalar subquery rather than a join, because two residents can overlap one month. A join would
// then emit the apartment twice, which shows it twice in the dues table and counts it twice in the
// report totals. Every caller aliases apartments as "a", and "r" is taken by the scan below, so a
// caller that joins residents itself has to pick a third alias.
//
// Binds periodCutoff(year, month) twice, once for each end of the window. It sits ahead of the WHERE
// clause in all three callers, so those two bindings come before every other binding in the
// statement.
function residentForPeriodSql(column, roleFilter, rolePriority = "") {
  return `(
           SELECT ${column} FROM residents r
           WHERE r.apartment_id = a.id
             ${roleFilter}
             AND ${EFFECTIVE_MOVE_IN} <= ?
             AND (r.move_out_date IS NULL OR r.move_out_date > ?)
           ORDER BY ${rolePriority}${EFFECTIVE_MOVE_IN} DESC, r.id DESC
           LIMIT 1
         )`;
}

// The dues list and the report print the name and nothing else. The residents overview needs the
// whole row, so it joins on the id instead of pulling one column at a time, and it asks for the
// owner as well, because the panel shows both records side by side.
const RESIDENT_NAME_FOR_PERIOD_SQL = residentForPeriodSql("r.full_name", OCCUPANT_FILTER, OCCUPANT_PRIORITY);
const RESIDENT_ID_FOR_PERIOD_SQL = residentForPeriodSql("r.id", OCCUPANT_FILTER, OCCUPANT_PRIORITY);
const OWNER_ID_FOR_PERIOD_SQL = residentForPeriodSql("r.id", OWNER_FILTER);

// The same tenant-first rule without the month filter, for the one caller that asks about today
// rather than about a period. It cannot simply sum every occupant row, because an owner who rented
// the flat out keeps the flag and would be counted next to the tenant.
const ACTIVE_OCCUPANT_ID_SQL = `(
           SELECT r.id FROM residents r
           WHERE r.apartment_id = a.id AND r.is_active = 1 AND r.is_occupant = 1
           ORDER BY ${OCCUPANT_PRIORITY}r.id DESC
           LIMIT 1
         )`;

module.exports = {
  ACTIVE_OCCUPANT_ID_SQL,
  OWNER_ID_FOR_PERIOD_SQL,
  periodCutoff,
  RESIDENT_ID_FOR_PERIOD_SQL,
  RESIDENT_NAME_FOR_PERIOD_SQL,
};
