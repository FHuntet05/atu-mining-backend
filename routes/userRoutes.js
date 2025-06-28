// --- START OF FILE atu-mining-api/routes/userRoutes.js (FINAL) ---
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// La ruta /sync ya no se define aquí.

// Esta ruta para obtener los datos de un usuario por su ID se mantiene.
// El archivo principal la montará en la ruta completa: /api/users/data/:telegramId
router.get('/data/:telegramId', userController.getUserData);

module.exports = router;
// --- END OF FILE atu-mining-api/routes/userRoutes.js (FINAL) ---