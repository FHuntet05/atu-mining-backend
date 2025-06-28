// --- START OF FILE atu-mining-api/routes/taskRoutes.js (VERSIÓN SIMPLIFICADA) ---

const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController.js');

// Ruta para obtener el estado de todas las tareas de un usuario
router.get('/:telegramId', taskController.getTasks);

// Ruta para que un usuario reclame la recompensa de una tarea
router.post('/claim', taskController.claimTask);

module.exports = router;
// --- END OF FILE atu-mining-api/routes/taskRoutes.js ---