// --- START OF FILE atu-mining-backend/config/economy.js (COMPLETO Y CORREGIDO) ---

const ECONOMY_CONFIG = {
    autToUsdtRate: 10000,
    minWithdrawalUsdt: 1.0,
    minExchangeUsdt: 1.0,
    DAILY_CLAIM_REWARD: 350,
    CYCLE_DURATION_HOURS: 0.0028,

    // --- !! NUEVO BLOQUE DE CONFIGURACIÓN !! ---
    // Centralizamos las comisiones de referido aquí.
    referralCommissions: {
        level1: 0.27,
        level2: 0.17,
        level3: 0.07,
    }
};

module.exports = ECONOMY_CONFIG;

// --- END OF FILE atu-mining-backend/config/economy.js ---