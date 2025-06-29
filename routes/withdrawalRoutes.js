// --- START OF FILE atu-mining-api/routes/withdrawalRoutes.js (CORREGIDO Y BLINDADO) ---

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ECONOMY_CONFIG = require('../config/economy');

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

router.post('/request', async (req, res) => {
    try {
        const { telegramId, amount, walletAddress } = req.body;
        const withdrawalAmount = parseFloat(amount);

        // --- VALIDACIONES INICIALES (SIN CAMBIOS, SON CORRECTAS) ---
        if (!telegramId || !withdrawalAmount || !walletAddress || isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            return res.status(400).json({ message: 'Faltan datos en la solicitud.' });
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return res.status(400).json({ message: 'La dirección de billetera no es válida.' });
        }
        if (withdrawalAmount < ECONOMY_CONFIG.minWithdrawalUsdt) {
            return res.status(400).json({ message: `El monto mínimo de retiro es ${ECONOMY_CONFIG.minWithdrawalUsdt} USDT.` });
        }

        // --- OPERACIÓN ATÓMICA Y VERIFICACIÓN DE COOLDOWN EN UN SOLO PASO ---
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const updatedUser = await User.findOneAndUpdate(
            {
                telegramId: telegramId,
                usdtBalance: { $gte: withdrawalAmount },
                // Condición: el último retiro fue hace más de 24h O nunca ha habido uno
                $or: [
                    { lastWithdrawalRequest: { $lte: twentyFourHoursAgo } },
                    { lastWithdrawalRequest: null }
                ]
            },
            {
                $inc: { usdtBalance: -withdrawalAmount },
                $set: { lastWithdrawalRequest: new Date() }
            },
            { new: true } // Devuelve el documento actualizado
        );

        // Si updatedUser es null, una de las condiciones falló
        if (!updatedUser) {
            // Verificamos por qué falló para dar un mensaje de error más útil
            const existingUser = await User.findOne({ telegramId });
            if (!existingUser) return res.status(404).json({ message: 'Usuario no encontrado.' });
            if (existingUser.usdtBalance < withdrawalAmount) return res.status(400).json({ message: 'Fondos insuficientes.' });
            return res.status(429).json({ message: 'Debes esperar 24 horas desde tu última solicitud.' });
        }

        // --- CREACIÓN DE TRANSACCIÓN (YA NO NECESITA SESIÓN) ---
        await Transaction.create({
            userId: updatedUser._id,
            type: 'withdrawal_request',
            currency: 'USDT',
            amount: -withdrawalAmount, // Mantenemos el negativo para indicar salida
            status: 'pending',
            details: `Solicitud de retiro a la billetera: ${walletAddress}`
        });

        // --- NOTIFICACIÓN A ADMINS (A PRUEBA DE FALLOS) ---
        try {
            const bot = req.app.get('bot');
            if (bot && ADMIN_IDS.length > 0) {
                const adminMessage = `🚨 *Nueva Solicitud de Retiro* 🚨\n\n` +
                                   `*Usuario:* ${updatedUser.firstName || 'N/A'} (\`${updatedUser.telegramId}\`)\n` +
                                   `*Monto:* *${withdrawalAmount.toFixed(2)} USDT*\n` +
                                   `*Billetera:* \`${walletAddress}\``;
                
                // Usamos Promise.allSettled para no detener el proceso si un mensaje falla
                await Promise.allSettled(
                    ADMIN_IDS.map(adminId => bot.telegram.sendMessage(adminId, adminMessage, { parse_mode: 'Markdown' }))
                );
            }
        } catch (notificationError) {
            // Si la notificación falla, solo lo registramos, pero no rompemos el flujo del usuario.
            console.error("Error al enviar notificación de retiro a admins:", notificationError);
        }
        
        res.status(200).json({
            message: 'Tu solicitud de retiro ha sido enviada y está en revisión.',
            user: updatedUser
        });

    } catch (error) {
        console.error("Error fatal en la solicitud de retiro:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

module.exports = router;
// --- END OF FILE atu-mining-api/routes/withdrawalRoutes.js (CORREGIDO Y BLINDADO) ---