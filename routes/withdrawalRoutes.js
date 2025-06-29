// atu-mining-api/routes/withdrawalRoutes.js (VERSIÓN FINAL CON NOTIFICACIÓN ENRIQUECIDA Y CORREGIDA)
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ECONOMY_CONFIG = require('../config/economy');
const { notifyAdmins } = require('../services/notification.service'); // Usaremos nuestro servicio centralizado

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

        // --- PASO 1: OPERACIÓN ATÓMICA DE RETIRO ---
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const updatedUser = await User.findOneAndUpdate(
            {
                telegramId: telegramId,
                usdtBalance: { $gte: withdrawalAmount },
                $or: [{ lastWithdrawalRequest: { $lte: twentyFourHoursAgo } }, { lastWithdrawalRequest: null }]
            },
            {
                $inc: { usdtBalance: -withdrawalAmount },
                $set: { lastWithdrawalRequest: new Date() }
            },
            { new: true } // Devuelve el documento actualizado
        );

        if (!updatedUser) {
            const existingUser = await User.findOne({ telegramId });
            if (!existingUser) return res.status(404).json({ message: 'Usuario no encontrado.' });
            if (existingUser.usdtBalance < withdrawalAmount) return res.status(400).json({ message: 'Fondos insuficientes.' });
            return res.status(429).json({ message: 'Debes esperar 24 horas desde tu última solicitud.' });
        }

        // --- CREACIÓN DE TRANSACCIÓN ---
        await Transaction.create({
            userId: updatedUser._id, type: 'withdrawal_request', currency: 'USDT',
            amount: -withdrawalAmount, status: 'pending',
            details: `Solicitud a la billetera: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        });

        // --- PASO 2: OBTENER DATOS RICOS PARA LA NOTIFICACIÓN ---
        // Hacemos una segunda consulta para obtener toda la información que queremos mostrar.
        // Usamos .populate() para obtener detalles de los boosts y referidos.
        const userForNotification = await User.findById(updatedUser._id)
            .populate('activeBoosts')
            .populate('referrals');

        // --- PASO 3: CONSTRUIR EL MENSAJE DETALLADO ---
        if (userForNotification) {
            // Contamos los boosts activos por tipo
            const boostSummary = userForNotification.activeBoosts.reduce((acc, boost) => {
                acc[boost.boostId] = (acc[boost.boostId] || 0) + 1;
                return acc;
            }, {});
            const boostSummaryString = Object.keys(boostSummary).length > 0 
                ? Object.entries(boostSummary).map(([id, count]) => `${count}x ${id}`).join(', ')
                : 'Ninguno';

            const adminMessage = 
`🚨 *Nueva Solicitud de Retiro* 🚨

*Detalles del Solicitante:*
- *Nombre:* ${userForNotification.firstName || 'N/A'}
- *Usuario:* @${userForNotification.username || 'N/A'}
- *ID:* \`${userForNotification.telegramId}\`

*Detalles de la Transacción:*
- *Monto a Retirar:* *${withdrawalAmount.toFixed(2)} USDT*
- *Billetera (BEP20):* \`${walletAddress}\`

*Métricas Clave del Usuario:*
- *Balance Actual:* \`${(userForNotification.autBalance || 0).toLocaleString()} AUT\`
- *Boosts Activos:* ${boostSummaryString}
- *Cantidad de Referidos:* ${userForNotification.referrals?.length || 0}
- *Total Minado:* ${(userForNotification.totalMinedAUT || 0).toLocaleString()} AUT`;
            
            // --- PASO 4: ENVIAR NOTIFICACIÓN USANDO EL SERVICIO CENTRALIZADO ---
            notifyAdmins(adminMessage);
        }
        
        // Respondemos al usuario inmediatamente. La notificación se envía en segundo plano.
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