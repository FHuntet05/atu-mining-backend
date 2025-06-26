// En: atu-mining-backend/routes/withdrawalRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

const MINIMUM_WITHDRAWAL_USDT = 1.0;
const WITHDRAWAL_COOLDOWN_HOURS = 24;
const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID, 10);

router.post('/request', async (req, res) => {
    try {
        const { telegramId, amount, walletAddress } = req.body;
        const user = await User.findOne({ telegramId });

        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
        if (amount < MINIMUM_WITHDRAWAL_USDT) return res.status(400).json({ message: `El retiro mínimo es de ${MINIMUM_WITHDRAWAL_USDT} USDT.` });
        if (amount > user.usdtForWithdrawal) return res.status(400).json({ message: 'Fondos insuficientes para retirar.' });
        if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) return res.status(400).json({ message: 'Dirección de billetera inválida.' });

        const now = new Date();
        if (user.lastWithdrawalRequest) {
            const cooldown = WITHDRAWAL_COOLDOWN_HOURS * 60 * 60 * 1000;
            const timeSinceLast = now.getTime() - user.lastWithdrawalRequest.getTime();
            if (timeSinceLast < cooldown) {
                const timeLeft = cooldown - timeSinceLast;
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                return res.status(429).json({ message: `Debes esperar aprox. ${hoursLeft}h ${minutesLeft}m para otra solicitud.` });
            }
        }
        
        user.usdtForWithdrawal -= amount;
        user.lastWithdrawalRequest = now;
        await user.save();

        const bot = req.app.locals.bot;
        const message = `⚠️ *Nueva Solicitud de Retiro*\n---------------------------------\n*Usuario:* ${user.firstName} (@${user.username || 'N/A'})\n*ID:* \`${user.telegramId}\`\n*Cantidad:* *${amount.toFixed(2)} USDT*\n*Billetera:* \`${walletAddress}\`\n---------------------------------\nPor favor, procesa el pago manualmente.`;
        await bot.telegram.sendMessage(ADMIN_ID, message, { parse_mode: 'Markdown' });

        res.status(200).json({ message: 'Tu solicitud de retiro ha sido enviada y está siendo procesada. Puede tardar hasta 24 horas.' });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});
module.exports = router;