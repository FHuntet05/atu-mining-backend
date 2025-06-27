require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const { Telegraf } = require('telegraf');

// --- Configuración ---
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=txlist&address=${DEPOSIT_WALLET_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=${BSCSCAN_API_KEY}`;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',');

// Instancia de Telegraf solo para enviar notificaciones al admin
const adminNotifierBot = new Telegraf(process.env.BOT_TOKEN);
let botInstance; // La instancia del bot principal para notificar a los usuarios

async function checkIncomingTransactions() {
    try {
        const pendingPayments = await Payment.find({ status: 'pending', expiresAt: { $gt: new Date() } });
        const response = await axios.get(BSCSCAN_API_URL);

        if (response.data.status !== '1' || !Array.isArray(response.data.result)) {
            return;
        }
        
        const recentTransactions = response.data.result;
        const processedTxHashes = new Set();

        // --- FASE 1: Procesar Coincidencias Exactas ---
        for (const payment of pendingPayments) {
            const matchedTx = recentTransactions.find(tx => {
                const txAmountStr = (Number(tx.value) / 1e18).toFixed(6);
                const paymentAmountStr = payment.uniqueAmount.toFixed(6);
                return tx.to.toLowerCase() === DEPOSIT_WALLET_ADDRESS.toLowerCase() && txAmountStr === paymentAmountStr;
            });

            if (matchedTx) {
                console.log(`✅ Coincidencia exacta encontrada para ${payment.uniqueAmount}. Procesando...`);
                processedTxHashes.add(matchedTx.hash);
                
                const user = await User.findById(payment.userId); // Lógica de acreditación
                if (user) {
                    if (!user.hasMadeDeposit) {
                        user.hasMadeDeposit = true;
                        // ... Aquí iría tu lógica de comisiones para referentes ...
                    }
                    user.usdtBalance += payment.baseAmount;
                    await user.save();
                    botInstance.telegram.sendMessage(user.telegramId, `✅ ¡Tu depósito de ${payment.baseAmount} USDT ha sido acreditado!`).catch(e => {});
                }
                
                payment.status = 'completed';
                payment.txHash = matchedTx.hash;
                await payment.save();
            }
        }
        
        // --- FASE 2: Detectar y Notificar Transacciones Anómalas ---
        const anomalousTransactions = recentTransactions.filter(tx => 
            tx.to.toLowerCase() === DEPOSIT_WALLET_ADDRESS.toLowerCase() &&
            !processedTxHashes.has(tx.hash)
        );

        for (const tx of anomalousTransactions) {
            const existingNotification = await Transaction.findOne({ txHash: tx.hash, type: 'manual_review_needed' });
            if (existingNotification) continue;

            const txAmount = parseFloat((Number(tx.value) / 1e18).toFixed(6));
            console.log(`⚠️ ¡ANOMALÍA DETECTADA! Transacción de ${txAmount} USDT con hash ${tx.hash}`);

            if (adminNotifierBot && ADMIN_IDS.length > 0) {
                const adminMessage = `*🚨 Pago Manual Requerido 🚨*\n\n` +
                                     `Se ha detectado un depósito que no coincide con ninguna orden.\n\n` +
                                     `*Monto Recibido:* \`${txAmount} USDT\`\n` +
                                     `*Desde Wallet:* \`${tx.from}\`\n` +
                                     `*TxHash:* \`${tx.hash}\`\n\n` +
                                     `Por favor, acredita el saldo manualmente usando el *Bot de Administración*.`;
                
                for (const adminId of ADMIN_IDS) {
                    if (adminId) adminNotifierBot.telegram.sendMessage(adminId, adminMessage, { parse_mode: 'Markdown' }).catch(e => console.error(e));
                }
            }
            
            await Transaction.create({
                type: 'manual_review_needed',
                currency: 'USDT',
                amount: txAmount,
                status: 'pending',
                txHash: tx.hash,
                details: `Depósito anómalo desde la billetera: ${tx.from}`
            });
        }

    } catch (error) {
        console.error('💥 ERROR en el Vigilante de Transacciones:', error);
    }
}

function startCheckingTransactions(bot) {
    botInstance = bot; // Guardamos la instancia del bot principal
    console.log('Iniciando el vigilante de transacciones (con detección de anomalías)...');
    cron.schedule('*/20 * * * * *', checkIncomingTransactions);
}

module.exports = { startCheckingTransactions };