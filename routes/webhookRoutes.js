// En: atu-mining-backend/routes/webhookRoutes.js
// CÓDIGO COMPLETO Y ACTUALIZADO

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const REFERRAL_BONUS_USDT = 0.5; // Define tu comisión aquí

router.post('/nowpayments', async (req, res) => {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    const signature = req.headers['x-nowpayments-sig'];
    if (!signature) return res.status(401).send('Falta la firma de seguridad.');
    if (!ipnSecret) return res.status(500).send('Error de configuración interno.');

    try {
        const hmac = crypto.createHmac('sha512', ipnSecret);
        hmac.update(JSON.stringify(req.body, Object.keys(req.body).sort()));
        const calculatedSignature = hmac.digest('hex');

        if (signature !== calculatedSignature) {
            return res.status(401).send('Firma inválida.');
        }

        const { payment_status, order_id, price_amount } = req.body;
        const isSuccess = payment_status === 'finished' || payment_status === 'confirmed';

        if (isSuccess) {
            const payment = await Payment.findById(order_id);
            if (payment && payment.status === 'pending') {
                payment.status = 'completed';
                await payment.save();

                const user = await User.findOne({ telegramId: payment.telegramId });
                if (!user) return res.status(200).send('Usuario no encontrado, IPN procesado.');

                // 1. Acreditar saldo al usuario que pagó
                user.usdtBalance += price_amount;
                const userTransaction = new Transaction({ telegramId: user.telegramId, type: 'deposit', description: `Depósito vía NOWPayments`, amount: `+${price_amount.toFixed(2)} USDT` });
                await userTransaction.save();
                
                // 2. Lógica de comisión por referido
                const previousDeposits = await Transaction.countDocuments({ telegramId: user.telegramId, type: 'deposit' });
                
                // Si es el primer depósito (contando el actual) y tiene un referente
                if (previousDeposits === 1 && user.referrerId) {
                    const referrer = await User.findOneAndUpdate(
                        { telegramId: user.referrerId },
                        {
                            $inc: { usdtForWithdrawal: REFERRAL_BONUS_USDT }, // Acreditamos la comisión
                            $addToSet: { activeReferrals: user.telegramId } // Lo marcamos como referido activo
                        },
                        { new: true }
                    );

                    if (referrer) {
                        const bonusTransaction = new Transaction({ telegramId: referrer.telegramId, type: 'claim', description: `Comisión por referido @${user.username || user.firstName}`, amount: `+${REFERRAL_BONUS_USDT.toFixed(2)} USDT` });
                        await bonusTransaction.save();
                        
                        const bot = req.app.locals.bot;
                        await bot.telegram.sendMessage(referrer.telegramId, `🎉 ¡Has ganado ${REFERRAL_BONUS_USDT.toFixed(2)} USDT por la primera recarga de tu referido ${user.firstName}!`);
                    }
                }
                
                await user.save();
                
                // 3. Notificar al usuario que pagó
                const bot = req.app.locals.bot;
                await bot.telegram.sendMessage(user.telegramId, `✅ ¡Tu pago de ${price_amount} USDT ha sido confirmado!`);
            }
        }
        res.status(200).send('IPN procesado.');
    } catch (error) {
        console.error("Error procesando IPN de NOWPayments:", error);
        res.status(500).send('Error interno del servidor.');
    }
});

module.exports = router;

