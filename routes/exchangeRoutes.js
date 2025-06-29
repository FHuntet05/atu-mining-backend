// --- START OF FILE atu-mining-backend/routes/exchangeRoutes.js (CORREGIDO) ---

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ECONOMY_CONFIG = require('../config/economy');

router.post('/', async (req, res) => {
    try {
        const { telegramId, autAmount } = req.body;
        const amountToExchange = parseFloat(autAmount);

        // 1. Validación de entrada (sin cambios, es correcta)
        if (!telegramId || !amountToExchange || isNaN(amountToExchange) || amountToExchange <= 0) {
            return res.status(400).json({ message: 'Cantidad de AUT inválida.' });
        }

        const usdtEquivalent = amountToExchange / ECONOMY_CONFIG.autToUsdtRate;
        if (usdtEquivalent < ECONOMY_CONFIG.minExchangeUsdt) {
            return res.status(400).json({ message: `El intercambio mínimo es el equivalente a ${ECONOMY_CONFIG.minExchangeUsdt} USDT.` });
        }
        
        // 2. Solución de Precisión: Redondear a un número seguro de decimales
        const usdtToAdd = parseFloat(usdtEquivalent.toFixed(6));

        // 3. Solución a la Condición de Carrera: Operación Atómica
        const updatedUser = await User.findOneAndUpdate(
            { 
                telegramId: telegramId, 
                autBalance: { $gte: amountToExchange } // Condición: solo actualizar si el saldo es suficiente
            },
            { 
                $inc: { // $inc hace la suma/resta de forma atómica
                    autBalance: -amountToExchange,
                    usdtBalance: usdtToAdd
                }
            },
            { new: true } // Opción para que devuelva el documento actualizado
        );

        // Si updatedUser es null, significa que la condición no se cumplió (saldo insuficiente)
        if (!updatedUser) {
            return res.status(400).json({ message: 'No tienes suficientes AUT para intercambiar.' });
        }

        // 4. Crear el registro de la transacción (ahora es más seguro porque el saldo ya se actualizó)
        await Transaction.create({
            userId: updatedUser._id,
            type: 'exchange',
            currency: 'USDT',
            amount: usdtToAdd,
            status: 'completed',
            details: `Intercambio de ${amountToExchange.toLocaleString()} AUT`
        });

        res.status(200).json({ message: '¡Intercambio realizado con éxito!', user: updatedUser });

    } catch (error) {
        console.error("Error en el intercambio de AUT:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;
// --- END OF FILE atu-mining-backend/routes/exchangeRoutes.js (CORREGIDO) ---