// --- START OF FILE atu-mining-api/routes/userRoutes.js (CORREGIDO Y LIMPIO) ---

const express = require('express');
const router = express.Router();

// Importamos el controlador de usuario
const userController = require('../controllers/userController');

// --- Definición de Rutas ---
// ¡IMPORTANTE! LA RUTA /sync HA SIDO ELIMINADA DE AQUÍ
// para ser definida directamente en el index.js principal de la API.

// Esta ruta para obtener datos sí se queda aquí.
// El enrutador principal la montará en: /api/users/data/:telegramId
router.get('/data/:telegramId', userController.getUserData);

module.exports = router;
// --- END OF FILE atu-mining-api/routes/userRoutes.js (CORREGIDO Y LIMPIO) ---