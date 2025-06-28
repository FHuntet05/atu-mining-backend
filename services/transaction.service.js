// --- START OF FILE atu-mining-api/services/transaction.service.js (FINAL COMPLETO Y CORREGIDO) ---
require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User.js');
const Payment = require('../models/Payment.js');
const Transaction = require('../models/Transaction.js');
const AnomalousTransaction = require('../models/AnomalousTransaction.js');
const { grantBoostsToUser } = require('./boost.service.js');

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT_ADDRESS}&address=${DEPOSIT_WALLET_ADDRESS}&page=1&offset=50&sort=desc&apikey=${BSCSCAN_API_KEY}`;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim()));
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let processedTxHashes = new Set();

// Función para notificar directamente a la API de Telegram
const notifyAdmins = (message) => {
    if (!TELEGRAM_BOT_TOKEN || ADMIN_IDS.length === 0) {
        console.warn("No se puede notificar a los admins: TELEGRAM_BOT_TOKEN o ADMIN_IDS no están configurados.");
        return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    ADMIN_IDS.forEach(chat_id => {
        axios.post(url, {
            chat_id,
            text: message,
            parse_mode: 'Markdown'
        }).catch(e => console.error(`Error notificando al admin ${chat_id}: ${e.message}`));
    });
};

const notifyUser = (telegramId, message) => {
    if (!TELEGRAM_BOT_TOKEN) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    axios.post(url, {
        chat_id: telegramId,
        text: message,
        parse_mode: 'Markdown'
    }).catch(e => console.error(`Error notificando al usuario ${telegramId}: ${e.message}`));
};

async function checkIncomingTransactions() {
    try {
        const response = await axios.get(BSCSCAN_API_URL);
        if (response.data.status !== '1' || !Array.isArray(response.data.result) || response.data.result.length === 0) {
            return;
        }

        for (const tx of response.data.result) {
            if (processedTxHashes.has(tx.hash)) continue;
            
            const txAmount = Number(tx.value) / (10 ** parseInt(tx.tokenDecimal));
            const senderAddress = tx.from.toLowerCase();

            const potentialPayments = await Payment.find({
                status: 'pending',
                senderAddress: senderAddress,
                expiresAt: { $gt: new Date() }
            }).sort({ createdAt: -1 });

            let matchingPayment = null;
            for (const payment of potentialPayments) {
                if (Math.abs(txAmount - payment.baseAmount) < 0.1) {
                    matchingPayment = payment;
                    break;
                }
            }
            
            if (matchingPayment) {
                processedTxHashes.add(tx.hash);
                
                const session = await mongoose.startSession();
                session.startTransaction();
                try {
                    const user = await User.findById(matchingPayment.userId).session(session);
                    if (!user) throw new Error(`Usuario de la orden ${matchingPayment._id} no encontrado.`);

                    await grantBoostsToUser({ userId: user._id, boostId: matchingPayment.boostId, quantity: matchingPayment.quantity, session });

                    matchingPayment.status = 'completed';
                    matchingPayment.txHash = tx.hash;
                    await matchingPayment.save({ session });

                    await Transaction.create([{
                        userId: user._id,
                        type: 'purchase', currency: 'USDT', amount: -matchingPayment.baseAmount,
                        status: 'completed',
                        details: `Compra de ${matchingPayment.quantity}x ${matchingPayment.boostId}`,
                        txHash: tx.hash
                    }], { session });

                    await session.commitTransaction();
                    
                    const userMessage = `✅ ¡Felicidades! Tu compra de *${matchingPayment.quantity}x del boost '${matchingPayment.boostId}'* ha sido procesada.`;
                    notifyUser(user.telegramId, userMessage);

                } catch (error) {
                    await session.abortTransaction();
                    console.error("Error al procesar compra automática:", error);
                } finally {
                    session.endSession();
                }
            } else {
                const existingAnomaly = await AnomalousTransaction.findOne({ txHash: tx.hash });
                const isAlreadyProcessed = await Payment.findOne({ txHash: tx.hash });
                if (!existingAnomaly && !isAlreadyProcessed) {
                    const txTimestamp = new Date(parseInt(tx.timeStamp) * 1000);
                    await AnomalousTransaction.create({ txHash: tx.hash, senderAddress, amount: txAmount, timestamp: txTimestamp });
                    const adminMessage = `🚨 *TRANSACCIÓN ANÓMALA* 🚨\n\n` +
                                         `De: \`${senderAddress}\`\n` +
                                         `Monto: \`${txAmount.toFixed(4)} USDT\`\n` +
                                         `TxHash: \`${tx.hash}\``;
                    notifyAdmins(adminMessage);
                }
                processedTxHashes.add(tx.hash);
            }
        }
    } catch (error) {
        console.error("Error en el Vigilante:", error.message);
    }
}

function startCheckingTransactions() {
    console.log("🚀 Vigilante v5 (autónomo) iniciado.");
    cron.schedule('*/30 * * * * *', checkIncomingTransactions);
}

module.exports = { startCheckingTransactions };
// --- END OF FILE atu-mining-api/services/transaction.service.js (FINAL COMPLETO Y CORREGIDO) ---