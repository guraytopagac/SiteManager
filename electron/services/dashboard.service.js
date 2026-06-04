const db = require('../../database/db');

async function getStats(managerId) {
    if (!managerId) {
        return {
            success: true,
            payload: { cash: 0, collections: 0, delays: 0 }
        };
    }

    return new Promise((resolve) => {
        db.serialize(async () => {
            try {
                await db.ready;

                // 1. Toplam Gelir Hesabı
                const totalIncome = await new Promise((res, rej) => {
                    db.get(
                        `SELECT COALESCE(SUM(amount), 0) AS totalIncome FROM incomes WHERE manager_id = ?`,
                        [managerId],
                        (err, row) => (err ? rej(err) : res(Number(row.totalIncome || 0)))
                    );
                });

                // 2. Toplam Gider Hesabı
                const totalExpense = await new Promise((res, rej) => {
                    db.get(
                        `SELECT COALESCE(SUM(amount), 0) AS totalExpense FROM expenses WHERE manager_id = ?`,
                        [managerId],
                        (err, row) => (err ? rej(err) : res(Number(row.totalExpense || 0)))
                    );
                });

                // 3. Toplam Alacak (Aidat) Hesabı
                const totalDue = await new Promise((res, rej) => {
                    db.get(
                        `SELECT COALESCE(SUM(due_amount), 0) AS totalDue FROM apartments WHERE manager_id = ?`,
                        [managerId],
                        (err, row) => (err ? rej(err) : res(Number(row.totalDue || 0)))
                    );
                });

                // Hesaplamalar
                const cash = Math.max(totalIncome - totalExpense, 0);
                const delays = Math.max(totalDue - totalIncome, 0);
                const collections = totalDue > 0 ? Math.min(Math.round((totalIncome / totalDue) * 100), 100) : 0;

                resolve({
                    success: true,
                    payload: { cash, collections, delays }
                });

            } catch (err) {
                console.error('Dashboard istatistikleri alınamadı:', err);
                resolve({ success: false, message: 'Dashboard verileri alınamadı.' });
            }
        });
    });
}

module.exports = { getStats };