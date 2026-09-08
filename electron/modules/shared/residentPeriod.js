// Which resident lived in an apartment during a given month. Only the dues list and the report ask
// this, and their answers have to match, so the query lives here instead of being written twice.
const { periodSql } = require("./trTime");

// move_in_date is optional and in practice usually empty, so the row's own created_at stands in for
// it. The same key drives the filter and the ordering, which is what makes the fallback work: a
// resident recorded in October is excluded from September instead of merely losing a comparison,
// and a missing date can never beat a real one.
const EFFECTIVE_MOVE_IN = "COALESCE(r.move_in_date, date(r.created_at))";

// A scalar subquery rather than a join, because two residents can overlap one month. A join would
// then emit the apartment twice, which shows it twice in the dues table and counts it twice in the
// report totals. Both callers alias apartments as "a".
//
// Binds the period from toPeriod(year, month) twice. It sits in the SELECT list, so those two
// bindings come before every other binding in the statement.
const RESIDENT_NAME_FOR_PERIOD_SQL = `(
           SELECT r.full_name FROM residents r
           WHERE r.apartment_id = a.id
             AND ${periodSql(EFFECTIVE_MOVE_IN)} <= ?
             AND (r.move_out_date IS NULL OR ${periodSql("r.move_out_date")} >= ?)
           ORDER BY ${EFFECTIVE_MOVE_IN} DESC, r.id DESC
           LIMIT 1
         )`;

module.exports = { RESIDENT_NAME_FOR_PERIOD_SQL };
