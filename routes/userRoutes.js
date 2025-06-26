const express = require('express');
const router = express.Router();

// Importamos las funciones del controlador que acabamos de crear
const userController = require('../controllers/userController');

// --- Definición de Rutas ---

// Ruta para sincronizar/crear el usuario.
// El frontend llama a esta ruta cuando la Mini App se carga.
// POST /api/users/sync
router.post('/sync', userController.syncUser);

// Ruta para obtener los datos actualizados de un usuario.
// GET /api/users/data/:telegramId
router.get('/data/:telegramId', userController.getUserData);


// Exportamos el enrutador para que pueda ser usado en 'routes/index.js'
module.exports = router;