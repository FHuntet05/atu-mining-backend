const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Ruta GET para obtener el historial de transacciones de un usuario
router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Buscamos todas las transacciones del usuario, ordenadas de más reciente a más antigua
        const transactions = await Transaction.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .limit(50); // Limitamos a las últimas 50 para no sobrecargar

        res.status(200).json(transactions);
    } catch (error) {
        console.error("Error al obtener historial de transacciones:", error);
        res.status(500).json({ message: "Error del servidor." });
    }
});

module.exports = router;
