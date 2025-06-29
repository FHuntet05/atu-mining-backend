// atu-mining-api/routes/userRoutes.js - VERSIÓN FINAL Y CORRECTA

const express = require('express');
const router = express.Router();

// Usamos require para importar el controlador
const userController = require('../controllers/userController');

// --- RUTA AÑADIDA (ESTA ES LA SOLUCIÓN) ---
// Esta ruta es la que el frontend busca al iniciar.
// Responde a peticiones POST en /api/users/sync
router.post('/sync', userController.syncUser);

// --- RUTA EXISTENTE ---
// Esta ruta se mantiene para cualquier otra necesidad futura.
router.get('/data/:telegramId', userController.getUserData);

// Exportamos el router con la sintaxis antigua
module.exports = router;