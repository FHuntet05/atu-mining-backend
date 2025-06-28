const express = require('express');
const router = express.Router();

// Usamos require para importar el controlador
const userController = require('../controllers/userController');

// Definimos la ruta que necesita el frontend
router.get('/data/:telegramId', userController.getUserData);

// Exportamos el router con la sintaxis antigua
module.exports = router;