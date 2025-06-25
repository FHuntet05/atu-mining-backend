// En: atu-mining-backend/routes/webhookRoutes.js
// CÓDIGO ACTUALIZADO CON LA VERIFICACIÓN DE MORALIS

const express = require('express');
const router = express.Router();
const PendingDeposit = require('../models/PendingDeposit');
const User = require('../models/User');

const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID, 10);
const DEPOSIT_WALLET = process.env.DEPOSIT_WALLET_ADDRESS.toLowerCase();

router.post('/moralis', async (req, res) => {
    try {
        const { body } = req;

        // --- PASO 1: VERIFICACIÓN DEL WEBHOOK DE MORALIS ---
        // Moralis envía una primera petición con body.confirmed = true para verificar el webhook.
        // Si vemos esto, simplemente respondemos 200 OK y terminamos.
        if (body.confirmed) {
            console.log('✅ Webhook de Moralis verificado correctamente.');
            return res.status(200).send('Webhook verificado');
        }
        
        // Si no hay transacciones en el body, no hay nada que hacer.
        if (!body.txs || body.txs.length === 0) {
            return res.status(200).send('No hay transacciones para procesar.');
        }

        // --- PASO 2: PROCESAMIENTO NORMAL DE TRANSACCIONES ---
        const bot = req.app.locals.bot;

        for (const tx of body.txs) {
            // Verificamos que sea una transferencia a nuestra dirección y que tenga un 'memo' (input)
            // y que el valor sea mayor que 0.
            if (tx.to.toLowerCase() === DEPOSIT_WALLET && tx.input !== '0x' && parseFloat(tx.value) > 0) {
                const telegramId = parseInt(tx.input, 16); // El 'memo' viene en hexadecimal
                const amount = parseFloat(tx.value) / 1e18; // El valor viene en WEI, lo convertimos a USDT
                const txHash = tx.hash;

                if (isNaN(telegramId) || amount <= 0) continue;

                const existingDeposit = await PendingDeposit.findOne({ txHash });
                if (existingDeposit) continue;

                const user = await User.findOne({ telegramId });
                if (!user) {
                    console.warn(`Depósito recibido para un usuario no existente: ${telegramId}`);
                    continue;
                }

                const newDeposit = new PendingDeposit({
                    telegramId,
                    amount,
                    txHash,
                });
                await newDeposit.save();

                const message = `
✅ *Nuevo Depósito Pendiente*
-----------------------------------
*Usuario:* @${user.username || 'N/A'} (\`${telegramId}\`)
*Cantidad:* ${amount.toFixed(4)} USDT
*TxID:* \`${txHash}\`
-----------------------------------
Por favor, verifica y toma una acción.
                `;

                await bot.telegram.sendMessage(ADMIN_ID, message, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '👍 Aprobar', callback_data: `approve_deposit:${newDeposit._id}` },
                            { text: '👎 Rechazar', callback_data: `reject_deposit:${newDeposit._id}` }
                        ]]
                    }
                });
            }
        }
        res.status(200).send('Webhook procesado');
    } catch (error) {
        console.error('Error en webhook de Moralis:', error);
        res.status(500).send('Error interno');
    }
});

module.exports = router;

module.exports = router;
