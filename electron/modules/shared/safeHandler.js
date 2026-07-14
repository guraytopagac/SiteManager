function createSafeHandler(domain) {
  return function safeHandler(channel, fn, errorMessage = "İşlem sırasında bir hata oluştu.") {
    return async (event, ...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        console.error(`[${domain}.handlers] ${channel}:`, err);
        return { success: false, message: errorMessage };
      }
    };
  };
}

module.exports = { createSafeHandler };
