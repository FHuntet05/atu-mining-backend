// atu-mining-api/routes/userRoutes.js - VERSIÓN CORREGIDA

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Ruta de sincronización existente
router.post('/sync', userController.syncUser);

// Ruta de datos existente
router.get('/data/:telegramId', userController.getUserData);

// --- AÑADIR ESTA NUEVA RUTA AL ARCHIVO ---
// Esta será la ruta para reclamar las recompensas.
router.post('/claim', userController.claimRewards);

module.exports = router;