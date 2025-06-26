// En: atu-mining-backend/routes/webhookRoutes.js
// CÓDIGO COMPLETO Y FINAL

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Endpoint para recibir notificaciones (IPN) de NOWPayments
router.post('/nowpayments', async (req, res) => {
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    const signature = req.headers['x-nowpayments-sig'];
    
    // Verificamos que tengamos una firma de seguridad
    if (!signature) {
        return res.status(401).send('Falta la firma de seguridad (x-nowpayments-sig).');
    }
    
    // Verificamos que el secreto IPN esté configurado en nuestro entorno
    if (!ipnSecret) {
        console.error("CRÍTICO: NOWPAYMENTS_IPN_SECRET no está configurado en el servidor.");
        return res.status(500).send('Error de configuración interno.');
    }

    try {
        // Verificamos que la firma sea válida para asegurar que la petición viene de NOWPayments
        const hmac = crypto.createHmac('sha512', ipnSecret);
        hmac.update(JSON.stringify(req.body, Object.keys(req.body).sort()));
        const calculatedSignature = hmac.digest('hex');

        if (signature !== calculatedSignature) {
            console.warn("ADVERTENCIA: Se recibió una petición con firma de IPN de NOWPayments inválida. Abortando.");
            return res.status(401).send('Firma inválida.');
        }

        console.log("Notificación (IPN) de NOWPayments recibida y verificada:", req.body);
        const { payment_status, order_id, price_amount } = req.body;

        // Estados que consideramos un pago exitoso
        const isSuccess = payment_status === 'finished' || payment_status === 'confirmed' || payment_status === 'partially_paid';

        if (isSuccess) {
            // Buscamos el pago en nuestra base de datos usando el order_id
            const payment = await Payment.findById(order_id);

            // Solo procesamos si encontramos el pago y está pendiente (para evitar doble abono)
            if (payment && payment.status === 'pending') {
                // 1. Marcar nuestro pago como completado
                payment.status = 'completed';
                await payment.save();

                // 2. Acreditar el saldo al usuario correspondiente
                await User.findOneAndUpdate(
                    { telegramId: payment.telegramId },
                    { $inc: { usdtBalance: price_amount } },
                    { new: true }
                );
                
                // 3. Crear un registro de la transacción para el historial del usuario
                const newTransaction = new Transaction({
                    telegramId: payment.telegramId,
                    type: 'deposit',
                    description: `Depósito vía NOWPayments`,
                    amount: `+${price_amount.toFixed(4)} USDT`
                });
                await newTransaction.save();
                
                // 4. Notificar al usuario a través del bot de Telegram
                const bot = req.app.locals.bot;
                if (bot) {
                    await bot.telegram.sendMessage(payment.telegramId, `✅ ¡Tu pago de ${price_amount} USDT ha sido confirmado y tu saldo ha sido actualizado!`);
                }
            } else {
                console.log(`Pago ${order_id} ya procesado o no encontrado. Ignorando.`);
            }
        } else {
            console.log(`Estado de pago '${payment_status}' para orden ${order_id} no requiere acción.`);
        }

        // Siempre respondemos 200 OK para que NOWPayments sepa que recibimos la notificación
        res.status(200).send('IPN procesado.');

    } catch (error) {
        console.error("Error crítico procesando IPN de NOWPayments:", error);
        res.status(500).send('Error interno del servidor al procesar la notificación.');
    }
});

// Puedes mantener aquí otras rutas de webhooks si las tienes (ej. Moralis)
// router.post('/moralis', ...);

module.exports = router;