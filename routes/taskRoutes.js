const express = require('express');
const router = express.Router();

// Importamos el nuevo controlador que contiene toda la lógica
const taskController = require('../controllers/taskController');

// Ruta: GET /api/tasks/:telegramId
// Llama a la función getTasks del controlador para obtener el estado de las tareas.
router.get('/:telegramId', taskController.getTasks);

// Ruta: POST /api/tasks/claim
// Llama a la función claimTask del controlador.
router.post('/claim', taskController.claimTask);

module.exports = router;