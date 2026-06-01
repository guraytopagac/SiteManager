async function getStats() {
    return { success: true, payload: { cash: 12450, collections: 85, delays: 4200 } };
}

module.exports = {
    getStats
};
