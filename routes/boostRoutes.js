const express = require('express');
const router = express.Router();
const boostController = require('../controllers/boostController');

// GET /api/boosts - Devuelve la lista de todos los boosts disponibles
router.get('/', boostController.getBoosts);

// POST /api/boosts/purchase-with-balance - Maneja la compra usando el saldo interno
router.post('/purchase-with-balance', boostController.purchaseWithBalance);

module.exports = router;
