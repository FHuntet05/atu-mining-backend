// En: atu-mining-backend/routes/webhookRoutes.js
// CÓDIGO COMPLETO (FINAL)

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

async function payReferralCommissions(userWhoDeposited, bot) {
    try {
        if (!userWhoDeposited.referrerId) return; // Nivel 1
        const referrerL1 = await User.findOneAndUpdate({ telegramId: userWhoDeposited.referrerId }, { $inc: { usdtForWithdrawal: COMMISSIONS.level1, referralEarnings: COMMISSIONS.level1 }, $addToSet: { activeReferrals: userWhoDeposited._id } }, { new: true });
        if (!referrerL1) return;
        await new Transaction({ telegramId: referrerL1.telegramId, type: 'claim', description: `Comisión N1 por ${userWhoDeposited.firstName}`, amount: `+${COMMISSIONS.level1.toFixed(2)} USDT` }).save();
        await bot.telegram.sendMessage(referrerL1.telegramId, `🎉 ¡Has ganado ${COMMISSIONS.level1.toFixed(2)} USDT (N1) por la primera recarga de tu referido ${userWhoDeposited.firstName}!`);

        if (!referrerL1.referrerId) return; // Nivel 2
        const referrerL2 = await User.findOneAndUpdate({ telegramId: referrerL1.referrerId }, { $inc: { usdtForWithdrawal: COMMISSIONS.level2, referralEarnings: COMMISSIONS.level2 } }, { new: true });
        if (!referrerL2) return;
        await new Transaction({ telegramId: referrerL2.telegramId, type: 'claim', description: `Comisión N2 por ${userWhoDeposited.firstName}`, amount: `+${COMMISSIONS.level2.toFixed(2)} USDT` }).save();
        await bot.telegram.sendMessage(referrerL2.telegramId, `¡Has ganado ${COMMISSIONS.level2.toFixed(2)} USDT (N2) por un referido de segundo nivel!`);

        if (!referrerL2.referrerId) return; // Nivel 3
        const referrerL3 = await User.findOneAndUpdate({ telegramId: referrerL2.referrerId }, { $inc: { usdtForWithdrawal: COMMISSIONS.level3, referralEarnings: COMMISSIONS.level3 } });
        if (!referrerL3) return;
        await new Transaction({ telegramId: referrerL3.telegramId, type: 'claim', description: `Comisión N3 por ${userWhoDeposited.firstName}`, amount: `+${COMMISSIONS.level3.toFixed(2)} USDT` }).save();
        await bot.telegram.sendMessage(referrerL3.telegramId, `¡Has ganado ${COMMISSIONS.level3.toFixed(2)} USDT (N3) por un referido de tercer nivel!`);
    } catch (error) { console.error("Error al pagar comisiones de referido:", error); }
}

router.post('/nowpayments', async (req, res) => {
    try {
        const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
        const signature = req.headers['x-nowpayments-sig'];
        if (!signature || !ipnSecret) return res.status(401).send('Configuración inválida.');
        const hmac = crypto.createHmac('sha512', ipnSecret);
        hmac.update(JSON.stringify(req.body, Object.keys(req.body).sort()));
        if (signature !== hmac.digest('hex')) return res.status(401).send('Firma inválida.');

        const { payment_status, order_id, price_amount } = req.body;
        if (payment_status === 'finished' || payment_status === 'confirmed') {
            const payment = await Payment.findById(order_id);
            if (payment && payment.status === 'pending') {
                payment.status = 'completed';
                await payment.save();
                
                const user = await User.findOne({ telegramId: payment.telegramId });
                if (!user) return res.status(200).send('Usuario no encontrado.');

                user.usdtBalance += price_amount;
                await new Transaction({ telegramId: user.telegramId, type: 'deposit', description: `Depósito vía NOWPayments`, amount: `+${price_amount.toFixed(2)} USDT` }).save();
                await user.save();
                
                const previousDeposits = await Transaction.countDocuments({ telegramId: user.telegramId, type: 'deposit' });
                if (previousDeposits === 1) {
                    const bot = req.app.locals.bot;
                    await payReferralCommissions(user, bot);
                }
                
                const bot = req.app.locals.bot;
                await bot.telegram.sendMessage(user.telegramId, `✅ ¡Tu pago de ${price_amount} USDT ha sido confirmado!`);
            }
        }
        res.status(200).send('IPN procesado.');
    } catch (error) {
        console.error("Error crítico procesando IPN de NOWPayments:", error);
        res.status(500).send('Error interno.');
    }
});
module.exports = router;