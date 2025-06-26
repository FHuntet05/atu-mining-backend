// En: atu-mining-backend/routes/exchangeRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const AUT_TO_USDT_RATE = 10000;
const MINIMUM_EXCHANGE_USDT = 5; // Equivalente a 50,000 AUT

router.post('/', async (req, res) => {
    try {
        const { telegramId, autAmount } = req.body;
        const amountToExchange = parseFloat(autAmount);

        if (!telegramId || !amountToExchange || isNaN(amountToExchange) || amountToExchange <= 0) {
            return res.status(400).json({ message: 'Cantidad de AUT inválida.' });
        }

        const user = await User.findOne({ telegramId });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        if (user.autBalance < amountToExchange) {
            return res.status(400).json({ message: 'No tienes suficientes AUT para intercambiar.' });
        }

        const usdtEquivalent = amountToExchange / AUT_TO_USDT_RATE;
        if (usdtEquivalent < MINIMUM_EXCHANGE_USDT) {
            return res.status(400).json({ message: `El intercambio mínimo debe ser equivalente a ${MINIMUM_EXCHANGE_USDT} USDT.` });
        }

        // Procesar la transacción
        user.autBalance -= amountToExchange;
        user.usdtForWithdrawal += usdtEquivalent;
        await user.save();

        // Crear un registro de la transacción
        const newTransaction = new Transaction({
            telegramId,
            type: 'exchange',
            description: `Intercambio de ${amountToExchange.toLocaleString()} AUT`,
            amount: `+${usdtEquivalent.toFixed(4)} USDT`
        });
        await newTransaction.save();
        
        // Devolvemos el usuario actualizado para que el frontend refresque la UI
        res.status(200).json({
            message: '¡Intercambio realizado con éxito!',
            user: user
        });

    } catch (error) {
        console.error("Error en el intercambio de AUT:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;