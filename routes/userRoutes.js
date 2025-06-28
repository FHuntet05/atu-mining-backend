import express from 'express';
import * as userController from '../controllers/userController.js';

const router = express.Router();

// Esta ruta para obtener los datos de un usuario por su ID se mantiene.
// El archivo principal la montará en la ruta completa: /api/users/data/:telegramId
router.get('/data/:telegramId', userController.getUserData);

// NOTA: Si necesitas otras rutas de usuario, como /sync, añádelas aquí.
// Ejemplo: router.post('/sync', userController.syncUser);

export default router;