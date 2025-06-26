// En: atu-mining-backend/routes/webhookRoutes.js
// CÓDIGO COMPLETO Y REVISADO

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const REFERRAL_BONUS_USDT = 0.5; // Asegúrate que este valor coincida

router.post('/nowpayments', async (req, res) => {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    const signature = req.headers['x-nowpayments-sig'];
    if (!signature || !ipnSecret) return res.status(401).send('Configuración inválida.');

    try {
        const hmac = crypto.createHmac('sha512', ipnSecret);
        hmac.update(JSON.stringify(req.body, Object.keys(req.body).sort()));
        if (signature !== hmac.digest('hex')) return res.status(401).send('Firma inválida.');

        const { payment_status, order_id, price_amount } = req.body;
        const isSuccess = payment_status === 'finished' || payment_status === 'confirmed';

        if (isSuccess) {
            const payment = await Payment.findById(order_id);
            if (payment && payment.status === 'pending') {
                payment.status = 'completed';
                await payment.save();

                const user = await User.findOne({ telegramId: payment.telegramId });
                if (!user) return res.status(200).send('Usuario no encontrado.');

                user.usdtBalance += price_amount;
                const userTransaction = new Transaction({ telegramId: user.telegramId, type: 'deposit', description: `Depósito vía NOWPayments`, amount: `+${price_amount.toFixed(2)} USDT` });
                await userTransaction.save();
                
                const previousDeposits = await Transaction.countDocuments({ telegramId: user.telegramId, type: 'deposit' });
                if (previousDeposits === 1 && user.referrerId) {
                    const referrer = await User.findOneAndUpdate(
                        { telegramId: user.referrerId },
                        {
                            $inc: { usdtForWithdrawal: REFERRAL_BONUS_USDT, referralEarnings: REFERRAL_BONUS_USDT },
                            $addToSet: { activeReferrals: user.telegramId }
                        },
                        { new: true }
                    );

                    if (referrer) {
                        const bonusTransaction = new Transaction({ telegramId: referrer.telegramId, type: 'claim', description: `Comisión por referido ${user.firstName}`, amount: `+${REFERRAL_BONUS_USDT.toFixed(2)} USDT` });
                        await bonusTransaction.save();
                        
                        const bot = req.app.locals.bot;
                        await bot.telegram.sendMessage(referrer.telegramId, `🎉 ¡Has ganado ${REFERRAL_BONUS_USDT.toFixed(2)} USDT por la primera recarga de tu referido ${user.firstName}!`);
                    }
                }
                await user.save();
                const bot = req.app.locals.bot;
                await bot.telegram.sendMessage(user.telegramId, `✅ ¡Tu pago de ${price_amount} USDT ha sido confirmado!`);
            }
        }
        res.status(200).send('IPN procesado.');
    } catch (error) {
        console.error("Error procesando IPN de NOWPayments:", error);
        res.status(500).send('Error interno.');
    }
});
module.exports = router;