const express = require('express');
const router = express.Router();

// Importamos el controlador que contiene la lógica de pagos.
const paymentController = require('../controllers/paymentController');

// --- INICIO DE CORRECCIÓN ---
// La sintaxis correcta es pasar la referencia de la función directamente.
// No se necesita "=>" ni "{}" aquí.
router.post('/create', paymentController.createPaymentOrder);
// --- FIN DE CORRECCIÓN ---


// Si en el futuro necesitamos verificar el estado de un pago, añadiríamos la ruta aquí.
// Por ejemplo: router.get('/status/:orderId', paymentController.getPaymentStatus);

module.exports = router;