// --- START OF FILE atu-mining-backend/routes/exchangeRoutes.js ---

const express = require('express.js');
const router = express.Router();
const User = require('../models/User.js');
const Transaction =require('../models/Transaction.js');
const ECONOMY_CONFIG = require('../config/economy.js');

router.post('/', async (req, res) => {
    try {
        const { telegramId, autAmount } = req.body;
        const amountToExchange = parseFloat(autAmount);

        if (!telegramId || !amountToExchange || isNaN(amountToExchange) || amountToExchange <= 0) {
            return res.status(400).json({ message: 'Cantidad de AUT inválida.' });
        }
        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
        if (user.autBalance < amountToExchange) {
            return res.status(400).json({ message: 'No tienes suficientes AUT para intercambiar.' });
        }

        const usdtEquivalent = amountToExchange / ECONOMY_CONFIG.autToUsdtRate;
        if (usdtEquivalent < ECONOMY_CONFIG.minExchangeUsdt) {
            return res.status(400).json({ message: `El intercambio mínimo debe ser equivalente a ${ECONOMY_CONFIG.minExchangeUsdt} USDT.` });
        }
        
        user.autBalance -= amountToExchange;
        user.usdtBalance += usdtEquivalent; // Se suma al único usdtBalance
        
        await Transaction.create({
            userId: user._id, type: 'exchange', currency: 'USDT',
            amount: usdtEquivalent, status: 'completed',
            details: `Intercambio de ${amountToExchange.toLocaleString()} AUT`
        });
        const updatedUser = await user.save();
        
        res.status(200).json({ message: '¡Intercambio realizado con éxito!', user: updatedUser });
    } catch (error) {
        console.error("Error en el intercambio de AUT:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;
// --- END OF FILE atu-mining-backend/routes/exchangeRoutes.js ---