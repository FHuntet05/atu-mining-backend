// --- START OF FILE atu-mining-api/routes/withdrawalRoutes.js (COMPLETO) ---

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const ECONOMY_CONFIG = require('../config/economy');

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim()));

router.post('/request', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { telegramId, amount, walletAddress } = req.body;
        const withdrawalAmount = parseFloat(amount);

        if (!telegramId || !withdrawalAmount || !walletAddress || isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
            return res.status(400).json({ message: 'Faltan datos en la solicitud.' });
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return res.status(400).json({ message: 'La dirección de billetera no es válida.' });
        }

        const user = await User.findOne({ telegramId }).session(session);
        if (!user) {
            await session.abortTransaction();
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        if (user.usdtBalance < withdrawalAmount) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'Fondos insuficientes para este retiro.' });
        }

        if(withdrawalAmount < ECONOMY_CONFIG.minWithdrawalUsdt){
             return res.status(400).json({ message: `El monto mínimo de retiro es ${ECONOMY_CONFIG.minWithdrawalUsdt} USDT.` });
        }

        if (user.lastWithdrawalRequest) {
            const timeSinceLastRequest = Date.now() - user.lastWithdrawalRequest.getTime();
            const twentyFourHours = 24 * 60 * 60 * 1000;
            if (timeSinceLastRequest < twentyFourHours) {
                await session.abortTransaction();
                const hoursRemaining = Math.ceil((twentyFourHours - timeSinceLastRequest) / (60 * 60 * 1000));
                return res.status(429).json({ message: `Debes esperar ${hoursRemaining} horas para otra solicitud.` });
            }
        }
        
        user.usdtBalance -= withdrawalAmount;
        user.lastWithdrawalRequest = new Date();
        const updatedUser = await user.save({ session });

        const newTransaction = new Transaction({
            userId: user._id,
            type: 'withdrawal_request',
            currency: 'USDT',
            amount: -withdrawalAmount,
            status: 'pending',
            details: `Solicitud de retiro a la billetera: ${walletAddress}`
        });
        await newTransaction.save({ session });

        // Notificación directa a los administradores
        const bot = req.app.get('bot');
        if (bot && ADMIN_IDS.length > 0) {
            const adminMessage = `🚨 *Nueva Solicitud de Retiro* 🚨\n\n` +
                               `*Usuario:* ${user.firstName} (\`${user.telegramId}\`)\n` +
                               `*Monto:* *${withdrawalAmount.toFixed(2)} USDT*\n` +
                               `*Billetera:* \`${walletAddress}\`\n\n` +
                               `*Nota:* Esta es solo una notificación. La gestión se realiza desde el bot de administración.`;
            
            ADMIN_IDS.forEach(adminId => {
                bot.telegram.sendMessage(adminId, adminMessage, { parse_mode: 'Markdown' }).catch(()=>{});
            });
        }
        
        await session.commitTransaction();
        
        res.status(200).json({
            message: 'Tu solicitud de retiro ha sido enviada y está en revisión. Recibirás el pago en las próximas 24 horas.',
            user: updatedUser
        });

    } catch (error) {
        await session.abortTransaction();
        console.error("Error en la solicitud de retiro:", error);
        res.status(500).json({ message: 'Error interno del servidor al procesar la solicitud.' });
    } finally {
        session.endSession();
    }
});

module.exports = router;
// --- END OF FILE atu-mining-api/routes/withdrawalRoutes.js (COMPLETO) ---