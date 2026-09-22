// Which resident lived in an apartment during a given month. The dues list, the report and the residents
// overview all ask this and their answers have to match, so the query is written once here.
const { monthEnd, trToday } = require("./trTime");

// A row counts from the day it was recorded, the only date the user can actually know. move_in_date
// overrides it in one case: a successor entered with a move-out dated ahead belongs to the transfer day.
const EFFECTIVE_MOVE_IN = "COALESCE(r.move_in_date, date(r.created_at))";

// An apartment can hold an owner row and a tenant row at once, so the tenant wins first and the owner
// answers only for the months no tenant covers. is_occupant drops an owner kept merely as a contact.
const OCCUPANT_FILTER = "AND r.is_occupant = 1";
const OCCUPANT_PRIORITY = "CASE WHEN r.resident_type = 'tenant' THEN 0 ELSE 1 END, ";
const OWNER_FILTER = "AND r.resident_type = 'owner'";

// The month's resident is whoever lived there at the end of that month, and today for the month in
// progress. A move-out therefore takes effect at once instead of lingering until the month turns.
function periodCutoff(year, month) {
  const end = monthEnd(year, month);
  const today = trToday();
  return today < end ? today : end;
}

// A scalar subquery, not a join: two residents can overlap one month and a join would emit the apartment
// twice. Binds periodCutoff twice, ahead of the WHERE clause, so those two precede every other binding.
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

// The name alone for the dues list and the report, the id for the overview, which needs the whole row.
const RESIDENT_NAME_FOR_PERIOD_SQL = residentForPeriodSql("r.full_name", OCCUPANT_FILTER, OCCUPANT_PRIORITY);
const RESIDENT_ID_FOR_PERIOD_SQL = residentForPeriodSql("r.id", OCCUPANT_FILTER, OCCUPANT_PRIORITY);
const OWNER_ID_FOR_PERIOD_SQL = residentForPeriodSql("r.id", OWNER_FILTER);
// The investment list asks for the owner by name, since the fund contribution is owed by the owner.
const OWNER_NAME_FOR_PERIOD_SQL = residentForPeriodSql("r.full_name", OWNER_FILTER);

// The same tenant-first rule without the month filter, for the one caller that asks about today. Summing
// every occupant row would count an owner who rented the flat out next to the tenant.
const ACTIVE_OCCUPANT_ID_SQL = `(
           SELECT r.id FROM residents r
           WHERE r.apartment_id = a.id AND r.is_active = 1 AND r.is_occupant = 1
           ORDER BY ${OCCUPANT_PRIORITY}r.id DESC
           LIMIT 1
         )`;

module.exports = {
  ACTIVE_OCCUPANT_ID_SQL,
  OWNER_ID_FOR_PERIOD_SQL,
  OWNER_NAME_FOR_PERIOD_SQL,
  periodCutoff,
  RESIDENT_ID_FOR_PERIOD_SQL,
  RESIDENT_NAME_FOR_PERIOD_SQL,
};
