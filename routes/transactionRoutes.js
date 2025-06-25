// En: atu-mining-backend/routes/transactionRoutes.js

const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');

// Ruta: GET /api/transactions/:telegramId
router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;

        // Buscamos las transacciones del usuario, las ordenamos por fecha (más nuevas primero) y limitamos a las últimas 50.
        const transactions = await Transaction.find({ telegramId: telegramId })
            .sort({ createdAt: -1 }) 
            .limit(50);

        res.status(200).json(transactions);
    } catch (error) {
        console.error('Error al obtener el historial de transacciones:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;