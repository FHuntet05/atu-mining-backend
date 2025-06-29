// --- START OF FILE atu-mining-backend/routes/exchangeRoutes.js (VERSIÓN DE DEPURACIÓN) ---

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ECONOMY_CONFIG = require('../config/economy');

router.post('/', async (req, res) => {
    // SONDA 1: ¿Llegó la petición?
    console.log(`[EXCHANGE] Petición de intercambio recibida.`);
    console.log(`[EXCHANGE] Cuerpo de la petición:`, req.body);

    try {
        const { telegramId, autAmount } = req.body;
        const amountToExchange = parseFloat(autAmount);
        
        // SONDA 2: ¿Los datos de entrada son correctos?
        console.log(`[EXCHANGE] Datos parseados: telegramId=${telegramId}, amountToExchange=${amountToExchange}`);

        if (!telegramId || !amountToExchange || isNaN(amountToExchange) || amountToExchange <= 0) {
            console.error('[EXCHANGE_ERROR] Validación de entrada fallida.');
            return res.status(400).json({ message: 'Cantidad de AUT inválida.' });
        }

        const usdtEquivalent = amountToExchange / ECONOMY_CONFIG.autToUsdtRate;
        console.log(`[EXCHANGE] Equivalente en USDT calculado: ${usdtEquivalent}`);

        if (usdtEquivalent < ECONOMY_CONFIG.minExchangeUsdt) {
            console.error('[EXCHANGE_ERROR] Intento de intercambio por debajo del mínimo.');
            return res.status(400).json({ message: `El intercambio mínimo es el equivalente a ${ECONOMY_CONFIG.minExchangeUsdt} USDT.` });
        }
        
        const usdtToAdd = parseFloat(usdtEquivalent.toFixed(6));
        console.log(`[EXCHANGE] USDT a añadir (redondeado): ${usdtToAdd}`);

        // SONDA 3: ¿Estamos a punto de ejecutar la operación crítica?
        console.log(`[EXCHANGE] Intentando operación atómica en la DB...`);
        const updatedUser = await User.findOneAndUpdate(
            { 
                telegramId: telegramId, 
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
            // SONDA 4: ¿Falló la condición de la operación?
            console.warn('[EXCHANGE_WARN] La operación atómica no encontró un usuario con saldo suficiente.');
            return res.status(400).json({ message: 'No tienes suficientes AUT para intercambiar.' });
        }

        // SONDA 5: ¿La actualización fue exitosa?
        console.log(`[EXCHANGE_SUCCESS] Usuario actualizado en DB. Nuevo autBalance: ${updatedUser.autBalance}`);

        await Transaction.create({
            userId: updatedUser._id, type: 'exchange', currency: 'USDT',
            amount: usdtToAdd, status: 'completed',
            details: `Intercambio de ${amountToExchange.toLocaleString()} AUT`
        });
        
        console.log(`[EXCHANGE_SUCCESS] Transacción registrada.`);
        res.status(200).json({ message: '¡Intercambio realizado con éxito!', user: updatedUser });

    } catch (error) {
        // SONDA 6: ¿Ocurrió un error inesperado?
        console.error("[EXCHANGE_FATAL_ERROR] Ha ocurrido un error en el bloque try-catch:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;
// --- END OF FILE atu-mining-backend/routes/exchangeRoutes.js (VERSIÓN DE DEPURACIÓN) ---