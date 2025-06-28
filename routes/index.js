// --- START OF FILE atu-mining-api/routes/index.js (VERSIÓN DEFINITIVA) ---

const express = require('express');
const router = express.Router();

// Importar todas las rutas individuales
const adminRoutes = require('./adminRoutes');
const userRoutes = require('./userRoutes');
const boostRoutes = require('./boostRoutes');
const miningRoutes = require('./miningRoutes');
const exchangeRoutes = require('./exchangeRoutes');
const paymentRoutes = require('./paymentRoutes');
const taskRoutes = require('./taskRoutes');
const transactionRoutes = require('./transactionRoutes');
const withdrawalRoutes = require('./withdrawalRoutes');
const leaderboardRoutes = require('./leaderboardRoutes');


// Montar cada ruta en el enrutador principal CON EL PREFIJO '/api'
router.use('/api/admin', adminRoutes);
router.use('/api/users', userRoutes);
router.use('/api/boosts', boostRoutes);
router.use('/api/mining', miningRoutes);
router.use('/api/exchange', exchangeRoutes);
router.use('/api/payments', paymentRoutes);
router.use('/api/tasks', taskRoutes);
router.use('/api/transactions', transactionRoutes);
router.use('/api/withdrawals', withdrawalRoutes);
router.use('/api/leaderboard', leaderboardRoutes);

// Exportar el enrutador principal que contiene todas las rutas ya prefijadas
module.exports = router;
// --- END OF FILE atu-mining-api/routes/index.js (VERSIÓN DEFINITIVA) ---