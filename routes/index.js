const express = require('express');
const router = express.Router();

// Importar todas las rutas individuales
const userRoutes = require('./userRoutes');
const boostRoutes = require('./boostRoutes');
const miningRoutes = require('./miningRoutes');
const exchangeRoutes = require('./exchangeRoutes');
const paymentRoutes = require('./paymentRoutes');
const referralRoutes = require('./referralRoutes');
const taskRoutes = require('./taskRoutes');
const transactionRoutes = require('./transactionRoutes');
const withdrawalRoutes = require('./withdrawalRoutes');
const leaderboardRoutes = require('./leaderboardRoutes');

// Montar cada ruta en el enrutador principal
// La URL base para todas estas rutas será /api
router.use('/users', userRoutes);
router.use('/boosts', boostRoutes);
router.use('/mining', miningRoutes);
router.use('/exchange', exchangeRoutes);
router.use('/payments', paymentRoutes);
router.use('/referrals', referralRoutes);
router.use('/tasks', taskRoutes);
router.use('/transactions', transactionRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/leaderboard', leaderboardRoutes);

// Exportar el enrutador principal que contiene todas las rutas
module.exports = router;