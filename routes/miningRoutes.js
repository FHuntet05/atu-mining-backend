const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const ENERGY_CAPACITY_HOURS = 8;

router.post('/claim', async (req, res) => {
    try {
        const { telegramId } = req.body;
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const elapsedTime = Date.now() - new Date(user.lastClaim).getTime();
        const maxTime = ENERGY_CAPACITY_HOURS * 60 * 60 * 1000;
        const accruedTime = Math.min(elapsedTime, maxTime);

        if (accruedTime < 60000) { // No se puede reclamar antes de 1 minuto
            return res.status(400).json({ message: 'Debes esperar un poco más para reclamar.' });
        }
        
        const totalYieldPerHour = (350 / 24) + user.boostYieldPerHour;
        const earnedAmount = (accruedTime / (1000 * 60 * 60)) * totalYieldPerHour;
        
        // --- INICIO DE CORRECCIÓN ---
        const oldBalance = user.autBalance;
        user.autBalance += earnedAmount;
        user.lastClaim = new Date();
        
        // Creamos la transacción correctamente
        await Transaction.create({
            userId: user._id,
            type: 'claim_mining',
            currency: 'AUT',
            amount: earnedAmount, // Es un número
            status: 'completed',
            details: 'Reclamo de minería'
        });
        
        const updatedUser = await user.save();
        // --- FIN DE CORRECCIÓN ---

        res.status(200).json({
            message: `¡Has reclamado ${earnedAmount.toFixed(0)} AUT!`,
            user: updatedUser
        });
    } catch (error) {
        console.error("Error al reclamar:", error);
        res.status(500).json({ message: 'Error del servidor al reclamar.' });
    }
});

module.exports = router;
