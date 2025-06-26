// En: atu-mining-backend/routes/webhookRoutes.js
// CÓDIGO COMPLETO CON COMISIONES MULTI-NIVEL

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Definimos las comisiones en un solo lugar para fácil modificación
const COMMISSIONS = {
    level1: 0.27,
    level2: 0.17,
    level3: 0.07,
};

// --- Función Auxiliar para Pagar Comisiones ---
// Esta función sube por el árbol de referidos y paga a cada nivel.
async function payReferralCommissions(userWhoDeposited, bot) {
    try {
        // Nivel 1: El referente directo del usuario que depositó
        if (!userWhoDeposited.referrerId) return; // Si no tiene referente, paramos.
        
        const referrerL1 = await User.findOneAndUpdate(
            { telegramId: userWhoDeposited.referrerId },
            { 
                $inc: { usdtForWithdrawal: COMMISSIONS.level1, referralEarnings: COMMISSIONS.level1 },
                $addToSet: { activeReferrals: userWhoDeposited._id } // Marcamos al referido como activo
            },
            { new: true }
        );

        if (!referrerL1) return; // Si no se encuentra el referente L1, paramos.

        await new Transaction({ telegramId: referrerL1.telegramId, type: 'claim', description: `Comisión N1 por ${userWhoDeposited.firstName}`, amount: `+${COMMISSIONS.level1.toFixed(2)} USDT` }).save();
        await bot.telegram.sendMessage(referrerL1.telegramId, `🎉 ¡Has ganado ${COMMISSIONS.level1.toFixed(2)} USDT (Nivel 1) por la primera recarga de tu referido ${userWhoDeposited.firstName}!`);

        // Nivel 2: El referente del referente
        if (!referrerL1.referrerId) return;
        const referrerL2 = await User.findOneAndUpdate(
            { telegramId: referrerL1.referrerId },
            { $inc: { usdtForWithdrawal: COMMISSIONS.level2, referralEarnings: COMMISSIONS.level2 } },
            { new: true }
        );

        if (!referrerL2) return;

        await new Transaction({ telegramId: referrerL2.telegramId, type: 'claim', description: `Comisión N2 por ${userWhoDeposited.firstName}`, amount: `+${COMMISSIONS.level2.toFixed(2)} USDT` }).save();
        await bot.telegram.sendMessage(referrerL2.telegramId, `¡Has ganado ${COMMISSIONS.level2.toFixed(2)} USDT (Nivel 2) por un referido de segundo nivel!`);

        // Nivel 3: El referente del referente del referente
        if (!referrerL2.referrerId) return;
        await User.findOneAndUpdate(
            { telegramId: referrerL2.referrerId },
            { $inc: { usdtForWithdrawal: COMMISSIONS.level3, referralEarnings: COMMISSIONS.level3 } }
        );

        await new Transaction({ telegramId: referrerL2.referrerId, type: 'claim', description: `Comisión N3 por ${userWhoDeposited.firstName}`, amount: `+${COMMISSIONS.level3.toFixed(2)} USDT` }).save();
        await bot.telegram.sendMessage(referrerL2.telegramId, `¡Has ganado ${COMMISSIONS.level3.toFixed(2)} USDT (Nivel 3) por un referido de tercer nivel!`);

    } catch (error) {
        console.error("Error al pagar comisiones de referido:", error);
    }
}


// --- Endpoint Principal del Webhook ---
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

                // Acreditar saldo al usuario que pagó
                user.usdtBalance += price_amount;
                await user.save();
                await new Transaction({ telegramId: user.telegramId, type: 'deposit', description: `Depósito vía NOWPayments`, amount: `+${price_amount.toFixed(2)} USDT` }).save();
                
                // Verificar si es el primer depósito para pagar comisiones
                const previousDeposits = await Transaction.countDocuments({ telegramId: user.telegramId, type: 'deposit' });
                if (previousDeposits === 1) {
                    const bot = req.app.locals.bot;
                    await payReferralCommissions(user, bot);
                }
                
                // Notificar al usuario que su pago fue exitoso
                const bot = req.app.locals.bot;
                await bot.telegram.sendMessage(user.telegramId, `✅ ¡Tu pago de ${price_amount} USDT ha sido confirmado y tu saldo ha sido actualizado!`);
            }
        }
        res.status(200).send('IPN procesado.');
    } catch (error) {
        console.error("Error crítico procesando IPN de NOWPayments:", error);
        res.status(500).send('Error interno.');
    }
});

module.exports = router;