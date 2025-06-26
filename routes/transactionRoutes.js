// En: atu-mining-backend/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const transactions = await Transaction.find({ telegramId }).sort({ createdAt: -1 }).limit(50);
        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener transacciones' });
    }
});

module.exports = router;
