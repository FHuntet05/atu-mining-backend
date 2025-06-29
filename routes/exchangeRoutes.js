// --- START OF FILE atu-mining-backend/routes/exchangeRoutes.js (VERSIÓN DE DIAGNÓSTICO) ---

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ECONOMY_CONFIG = require('../config/economy');
const mongoose = require('mongoose'); // Importante para usar tipos de Mongoose

router.post('/', async (req, res) => {
    try {
        const { telegramId, autAmount } = req.body;
        console.log(`[DIAGNÓSTICO] Datos recibidos: telegramId=${telegramId}, autAmount=${autAmount}`);

        // =================================================================
        // === PASO DE DIAGNÓSTICO: OBTENER EL ESTADO EXACTO DEL USUARIO ===
        // =================================================================
        const userBeforeUpdate = await User.findOne({ 
            $or: [{ telegramId: telegramId }, { telegramId: String(telegramId) }] 
        });

        if (!userBeforeUpdate) {
            console.error('[DIAGNÓSTICO] ERROR CRÍTICO: El usuario no fue encontrado NI SIQUIERA con la búsqueda simple.');
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // ¡ESTE ES EL LOG MÁS IMPORTANTE!
        console.log('[DIAGNÓSTICO] Estado del usuario ANTES de la operación:', JSON.stringify(userBeforeUpdate, null, 2));
        console.log(`[DIAGNÓSTICO] Tipo de dato de autBalance en la DB: ${userBeforeUpdate.autBalance.constructor.name}`);
        console.log(`[DIAGNÓSTICO] Monto a intercambiar: ${autAmount}, Tipo: ${typeof autAmount}`);
        // =================================================================
        

        const amountToExchange = parseFloat(autAmount);
        
        if (!telegramId || !amountToExchange || isNaN(amountToExchange) || amountToExchange <= 0) {
            return res.status(400).json({ message: 'Cantidad de AUT inválida.' });
        }

        const usdtEquivalent = amountToExchange / ECONOMY_CONFIG.autToUsdtRate;
        if (usdtEquivalent < ECONOMY_CONFIG.minExchangeUsdt) {
            return res.status(400).json({ message: `El intercambio mínimo es el equivalente a ${ECONOMY_CONFIG.minExchangeUsdt} USDT.` });
        }
        
        const usdtToAdd = parseFloat(usdtEquivalent.toFixed(6));
        const userIdString = String(telegramId);

        const updatedUser = await User.findOneAndUpdate(
            { 
                $or: [{ telegramId: telegramId }, { telegramId: userIdString }],
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
            // Este es el punto donde probablemente falla.
            console.error('[DIAGNÓSTICO] La operación findOneAndUpdate falló. updatedUser es null.');
            return res.status(400).json({ message: 'La condición de intercambio no se cumplió (probablemente saldo insuficiente o error de tipo).' });
        }
        
        res.status(200).json({ message: '¡Intercambio realizado con éxito!', user: updatedUser });

    } catch (error) {
        console.error("[DIAGNÓSTICO] Ha ocurrido un error fatal en el bloque try-catch:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;
// --- END OF FILE atu-mining-backend/routes/exchangeRoutes.js (VERSIÓN DE DIAGNÓSTICO) ---