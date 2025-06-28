// --- START OF FILE atu-mining-api/routes/userRoutes.js (CORREGIDO) ---

const express = require('express');
const router = express.Router();

// Importamos el controlador
const userController = require('../controllers/userController');

// --- Definición de Rutas ---

// ¡IMPORTANTE! HEMOS ELIMINADO LA RUTA '/sync' DE AQUÍ.
// La definiremos directamente en el index.js principal de la API.

// Ruta para obtener los datos actualizados de un usuario.
// GET /api/users/data/:telegramId
router.get('/data/:telegramId', userController.getUserData);


module.exports = router;
// --- END OF FILE atu-mining-api/routes/userRoutes.js (CORREGIDO) ---