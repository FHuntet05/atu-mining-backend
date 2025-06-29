// atu-mining-api/routes/configRoutes.js
const express = require('express');
const router = express.Router();
const ECONOMY_CONFIG = require('../config/economy');

// Este endpoint simplemente devuelve el objeto de configuración.
router.get('/', (req, res) => {
    res.json(ECONOMY_CONFIG);
});

module.exports = router;