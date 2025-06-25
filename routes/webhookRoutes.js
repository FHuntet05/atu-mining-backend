// En: atu-mining-backend/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();
const PendingDeposit = require('../models/PendingDeposit');
const User = require('../models/User');

const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID, 10);

router.post('/moralis', async (req, res) => {
    try {
        const { body } = req;
        const bot = req.app.locals.bot;

        // Iteramos sobre las transacciones en el webhook
        for (const tx of body.txs) {
            // Verificamos que sea una transferencia a nuestra dirección y que tenga un 'memo' (input)
            if (tx.to.toLowerCase() === process.env.DEPOSIT_WALLET_ADDRESS.toLowerCase() && tx.input !== '0x') {
                const telegramId = parseInt(tx.input, 16); // El 'memo' viene en hexadecimal
                const amount = parseFloat(tx.value) / 1e18; // El valor viene en WEI, lo convertimos a USDT
                const txHash = tx.hash;

                if (isNaN(telegramId) || amount <= 0) continue;

                // Evitar procesar la misma transacción dos veces
                const existingDeposit = await PendingDeposit.findOne({ txHash });
                if (existingDeposit) continue;

                const user = await User.findOne({ telegramId });
                if (!user) continue;

                const newDeposit = new PendingDeposit({
                    telegramId,
                    amount,
                    txHash,
                });
                await newDeposit.save();

                // Notificar al admin
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
