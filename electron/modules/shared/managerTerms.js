// Who held the account at a given moment. A handover rewrites the users row in place, so the user id on a
// record always names today's manager, and the author of a record is found by its timestamp instead.

// A scalar subquery for the manager whose term holds the given timestamp. The window is closed at the start
// and open at the end, so a record made in the handover second belongs to the incoming manager. A database
// that has never seen a handover since the terms table arrived may have no term at all, and then the
// account holder is the only manager it has had.
function managerAtSql(moment) {
  return `COALESCE(
    (SELECT mt.manager_name FROM manager_terms mt
      WHERE ${moment} >= mt.started_at AND (mt.ended_at IS NULL OR ${moment} < mt.ended_at)
      ORDER BY mt.id DESC LIMIT 1),
    (SELECT u.manager_name FROM users u ORDER BY u.id LIMIT 1))`;
}

module.exports = { managerAtSql };
