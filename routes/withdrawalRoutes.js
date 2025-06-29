// --- START OF FILE atu-mining-api/routes/withdrawalRoutes.js (VERSIÓN FINAL CON NOTIFICACIÓN ENRIQUECIDA) ---

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ECONOMY_CONFIG = require('../config/economy');

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

router.post('/request', async (req, res) => {
    try {
        const { telegramId, amount, walletAddress } = req.body;
        const withdrawalAmount = parseFloat(amount);

        // --- VALIDACIONES INICIALES ---
        if (!telegramId || !withdrawalAmount || !walletAddress || isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            return res.status(400).json({ message: 'Faltan datos en la solicitud.' });
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return res.status(400).json({ message: 'La dirección de billetera no es válida.' });
        }
        if (withdrawalAmount < ECONOMY_CONFIG.minWithdrawalUsdt) {
            return res.status(400).json({ message: `El monto mínimo de retiro es ${ECONOMY_CONFIG.minWithdrawalUsdt} USDT.` });
        }

        // --- PASO 1: OPERACIÓN ATÓMICA DE RETIRO (rápida y segura) ---
        const twentyFourHoursAgo = 10 * 1000;
        const updatedUser = await User.findOneAndUpdate(
            {
                $or: [{ telegramId: telegramId }, { telegramId: String(telegramId) }],
                usdtBalance: { $gte: withdrawalAmount },
                $or: [{ lastWithdrawalRequest: { $lte: twentyFourHoursAgo } }, { lastWithdrawalRequest: null }]
            },
            {
                $inc: { usdtBalance: -withdrawalAmount },
                $set: { lastWithdrawalRequest: new Date() }
            },
            { new: true }
        );

        if (!updatedUser) {
            const existingUser = await User.findOne({ $or: [{ telegramId: telegramId }, { telegramId: String(telegramId) }] });
            if (!existingUser) return res.status(404).json({ message: 'Usuario no encontrado.' });
            if (existingUser.usdtBalance < withdrawalAmount) return res.status(400).json({ message: 'Fondos insuficientes.' });
            return res.status(429).json({ message: 'Debes esperar 24 horas desde tu última solicitud.' });
        }

        // --- CREACIÓN DE TRANSACCIÓN ---
        await Transaction.create({
            userId: updatedUser._id, type: 'withdrawal_request', currency: 'USDT',
            amount: -withdrawalAmount, status: 'pending',
            details: `Solicitud de retiro a la billetera: ${walletAddress}`
        });

        // --- PASO 2: OBTENER DATOS RICOS PARA LA NOTIFICACIÓN ---
        // Hacemos una segunda consulta para obtener toda la información que queremos mostrar.
        const userForNotification = await User.findById(updatedUser._id).populate('referrals');

        // --- PASO 3: CONSTRUIR EL MENSAJE DETALLADO ---
        try {
            const bot = req.app.get('bot');
            if (bot && ADMIN_IDS.length > 0 && userForNotification) {
                const adminMessage = 
`🚨 *Nueva Solicitud de Retiro* 🚨

*Detalles del Solicitante:*
- *Nombre:* ${userForNotification.firstName || 'N/A'}
- *Usuario:* @${userForNotification.username || 'N/A'}
- *ID:* \`${userForNotification.telegramId}\`

*Detalles de la Transacción:*
- *Monto a Retirar:* *${withdrawalAmount.toFixed(2)} USDT*
- *Billetera (BEP20):* \`${walletAddress}\`

*Métricas del Usuario:*
- *Total Minado:* ${(userForNotification.totalMinedAUT || 0).toLocaleString()} AUT
- *Cantidad de Referidos:* ${userForNotification.referrals?.length || 0}`;
                
                // --- PASO 4: ENVIAR NOTIFICACIÓN A PRUEBA DE FALLOS ---
                await Promise.allSettled(
                    ADMIN_IDS.map(adminId => bot.telegram.sendMessage(adminId, adminMessage, { parse_mode: 'Markdown' }))
                );
            }
        } catch (notificationError) {
            console.error("Error al construir o enviar la notificación de retiro:", notificationError);
        }
        
        // Respondemos al usuario con éxito. La notificación es una tarea de fondo.
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
// --- END OF FILE atu-mining-api/routes/withdrawalRoutes.js (VERSIÓN FINAL CON NOTIFICACIÓN ENRIQUECIDA) ---