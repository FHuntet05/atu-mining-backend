// --- START OF FILE atu-mining-backend/routes/exchangeRoutes.js (VERSIÓN CORREGIDA FINAL) ---

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ECONOMY_CONFIG = require('../config/economy');

router.post('/', async (req, res) => {
    try {
        const { telegramId, autAmount } = req.body;
        const amountToExchange = parseFloat(autAmount);
        
        if (!telegramId || !amountToExchange || isNaN(amountToExchange) || amountToExchange <= 0) {
            return res.status(400).json({ message: 'Cantidad de AUT inválida.' });
        }

        const usdtEquivalent = amountToExchange / ECONOMY_CONFIG.autToUsdtRate;
        if (usdtEquivalent < ECONOMY_CONFIG.minExchangeUsdt) {
            return res.status(400).json({ message: `El intercambio mínimo es el equivalente a ${ECONOMY_CONFIG.minExchangeUsdt} USDT.` });
        }
        
        const usdtToAdd = parseFloat(usdtEquivalent.toFixed(6));
        const userIdString = String(telegramId); // Convertimos a string para la búsqueda

        // --- BÚSQUEDA FLEXIBLE Y OPERACIÓN ATÓMICA ---
        const updatedUser = await User.findOneAndUpdate(
            { 
                // Buscamos el ID como número O como string
                $or: [{ telegramId: telegramId }, { telegramId: userIdString }],
                // La condición del balance sigue igual
                autBalance: { $gte: amountToExchange }
            },
            { 
                $inc: {
                    autBalance: -amountToExchange,
                    usdtBalance: usdtToAdd
                }
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(400).json({ message: 'No tienes suficientes AUT para intercambiar o el usuario no fue encontrado.' });
        }

        try {
            await Transaction.create({
                userId: updatedUser._id,
                type: 'exchange',
                currency: 'USDT',
                amount: usdtToAdd,
                status: 'completed',
                details: `Intercambio de ${amountToExchange.toLocaleString()} AUT`
            });
        } catch (transactionError) {
            console.error("Error al crear el registro de la transacción de intercambio:", transactionError);
        }
        
        res.status(200).json({ message: '¡Intercambio realizado con éxito!', user: updatedUser });

    } catch (error) {
        console.error("Error fatal en el intercambio:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;
// --- END OF FILE atu-mining-backend/routes/exchangeRoutes.js (VERSIÓN CORREGIDA FINAL) ---