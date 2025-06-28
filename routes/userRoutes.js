// --- START OF FILE atu-mining-api/routes/userRoutes.js (FINAL) ---
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// La ruta /sync ya no se define aquí.

// Se mantiene la ruta para obtener datos de un usuario por su ID
// Será montada como /api/users/data/:telegramId
router.get('/data/:telegramId', userController.getUserData);

module.exports = router;
// --- END OF FILE atu-mining-api/routes/userRoutes.js (FINAL) ---