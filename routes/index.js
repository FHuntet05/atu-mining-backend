// --- START OF FILE atu-mining-api/routes/index.js (FINAL) ---

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


// Montar cada ruta SIN prefijo aquí.
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);
router.use('/boosts', boostRoutes);
router.use('/mining', miningRoutes);
router.use('/exchange', exchangeRoutes);
router.use('/payments', paymentRoutes);
router.use('/tasks', taskRoutes);
router.use('/transactions', transactionRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/leaderboard', leaderboardRoutes);

// Exportar el enrutador principal
module.exports = router;
// --- END OF FILE atu-mining-api/routes/index.js (FINAL) ---