// --- START OF FILE atu-mining-api/services/transaction.service.js (COMPLETO) ---
require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const AnomalousTransaction = require('../models/AnomalousTransaction');
const { grantBoostsToUser } = require('./boost.service');

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT_ADDRESS}&address=${DEPOSIT_WALLET_ADDRESS}&page=1&offset=50&sort=desc&apikey=${BSCSCAN_API_KEY}`;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim()));

let botInstance;
let processedTxHashes = new Set();

const notifyAdmins = (message) => {
    if (!botInstance || ADMIN_IDS.length === 0) {
        console.warn("Vigilante intentó notificar, pero no hay instancia del bot o ADMIN_IDS configurados.");
        return;
    }
    ADMIN_IDS.forEach(adminId => {
        botInstance.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' }).catch(e => {
            console.error(`Error al notificar al admin ${adminId}: ${e.message}`);
        });
    });
};

async function checkIncomingTransactions() {
    try {
        const response = await axios.get(BSCSCAN_API_URL);
        if (response.data.status !== '1' || !Array.isArray(response.data.result) || response.data.result.length === 0) {
            return;
        }

        const tokenTransactions = response.data.result;

        for (const tx of tokenTransactions) {
            if (processedTxHashes.has(tx.hash)) continue;

            const txAmount = Number(tx.value) / (10 ** parseInt(tx.tokenDecimal));
            const senderAddress = tx.from.toLowerCase();
            const txTimestamp = new Date(parseInt(tx.timeStamp) * 1000);

            const matchingPayment = await Payment.findOne({
                status: 'pending',
                senderAddress: senderAddress,
                expiresAt: { $gt: new Date() },
                createdAt: { $lt: txTimestamp }
            }).populate('userId').sort({ createdAt: -1 });

            // CASO 1: Hay una orden pendiente y el monto es muy cercano (hasta 5% más por si acaso)
            if (matchingPayment && txAmount >= matchingPayment.baseAmount && Math.abs(txAmount - matchingPayment.baseAmount) / matchingPayment.baseAmount < 0.05) {
                processedTxHashes.add(tx.hash);
                const session = await mongoose.startSession();
                session.startTransaction();
                try {
                    await grantBoostsToUser({
                        userId: matchingPayment.userId._id,
                        boostId: matchingPayment.boostId,
                        quantity: matchingPayment.quantity,
                        session
                    });
                    
                    matchingPayment.status = 'completed';
                    matchingPayment.txHash = tx.hash;
                    await matchingPayment.save({ session });
                    
                    await Transaction.create([{
                        userId: matchingPayment.userId._id,
                        type: 'purchase', currency: 'USDT', amount: -matchingPayment.baseAmount,
                        status: 'completed',
                        details: `Compra de ${matchingPayment.quantity}x ${matchingPayment.boostId} con crypto`,
                        txHash: tx.hash
                    }], { session });

                    await session.commitTransaction();

                    const user = matchingPayment.userId;
                    botInstance.telegram.sendMessage(user.telegramId, `✅ ¡Felicidades, ${user.firstName}! Tu compra de *${matchingPayment.quantity}x del boost '${matchingPayment.boostId}'* ha sido procesada y ya está activa.`, { parse_mode: 'Markdown' }).catch(()=>{});
                } catch (error) {
                    await session.abortTransaction();
                    console.error("Error crítico al procesar compra automática:", error);
                } finally {
                    session.endSession();
                }
            } 
            // CASO 2: No hay orden de pago que coincida -> transacción anómala
            else {
                const existingAnomaly = await AnomalousTransaction.findOne({ txHash: tx.hash });
                const isAlreadyProcessed = await Payment.findOne({ txHash: tx.hash });
                
                if (!existingAnomaly && !isAlreadyProcessed) {
                    await AnomalousTransaction.create({
                        txHash: tx.hash, senderAddress,
                        amount: txAmount, blockNumber: tx.blockNumber, timestamp: txTimestamp,
                    });

                    const adminMessage = `🚨 *TRANSACCIÓN ANÓMALA DETECTADA* 🚨\n\n` +
                                         `Se ha recibido un pago que no coincide con ninguna orden de compra pendiente.\n\n` +
                                         `👤 **Desde:** \`${senderAddress}\`\n` +
                                         `💰 **Monto:** \`${txAmount.toFixed(4)} USDT\`\n` +
                                         `🔗 **TxHash:** \`${tx.hash}\`\n\n` +
                                         `Esta transacción requiere revisión manual.`;
                    
                    notifyAdmins(adminMessage);
                }
                processedTxHashes.add(tx.hash);
            }
        }
    } catch (error) {
        if (error.response) console.error("Error en API de BscScan:", error.response.data);
        else console.error("Error en el Vigilante:", error.message);
    }
}

function startCheckingTransactions(bot) {
    botInstance = bot;
    console.log("🚀 Vigilante de transacciones iniciado. Revisando cada 30 segundos.");
    cron.schedule('*/30 * * * * *', checkIncomingTransactions);
}

module.exports = { startCheckingTransactions };
// --- END OF FILE atu-mining-api/services/transaction.service.js (COMPLETO) ---