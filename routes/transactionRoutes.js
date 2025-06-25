// En: atu-mining-backend/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const transactions = await Transaction.find({ telegramId: telegramId }).sort({ createdAt: -1 }).limit(50);
        res.status(200).json(transactions);
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});
module.exports = router;
