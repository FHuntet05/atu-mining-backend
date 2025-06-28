// --- START OF FILE atu-mining-backend/services/transaction.service.js ---

require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const AnomalousTransaction = require('../models/AnomalousTransaction');
const { grantBoostsToUser } = require('./boost.service');

// --- CONFIGURACIÓN ---
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT_ADDRESS}&address=${DEPOSIT_WALLET_ADDRESS}&page=1&offset=50&sort=desc&apikey=${BSCSCAN_API_KEY}`;

// --- CONFIGURACIÓN PARA NOTIFICAR AL BOT ADMIN ---
const ADMIN_BOT_URL = process.env.ADMIN_BOT_URL;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY; 

// Caché en memoria para evitar reprocesar transacciones dentro del ciclo de vida del servidor
let processedTxHashes = new Set();

async function checkIncomingTransactions() {
    try {
        const response = await axios.get(BSCSCAN_API_URL);
        if (response.data.status !== '1' || !Array.isArray(response.data.result) || response.data.result.length === 0) {
            return;
        }

        const tokenTransactions = response.data.result;

        for (const tx of tokenTransactions) {
            if (processedTxHashes.has(tx.hash)) {
                continue;
            }

            const txAmount = Number(tx.value) / (10 ** parseInt(tx.tokenDecimal));
            const senderAddress = tx.from.toLowerCase();
            const txTimestamp = new Date(parseInt(tx.timeStamp) * 1000);

            const matchingPayment = await Payment.findOne({
                status: 'pending',
                senderAddress: senderAddress,
                createdAt: { $lt: txTimestamp },
                expiresAt: { $gt: new Date() }
            }).sort({ createdAt: -1 });

            // CONDICIÓN DE ÉXITO: Hay una orden pendiente Y el monto es muy cercano
            if (matchingPayment && Math.abs(txAmount - matchingPayment.baseAmount) / matchingPayment.baseAmount < 0.05) { // 5% de tolerancia por si el usuario paga un poco de más
                const session = await mongoose.startSession();
                session.startTransaction();
                try {
                    await grantBoostsToUser({
                        userId: matchingPayment.userId,
                        boostId: matchingPayment.boostId,
                        quantity: matchingPayment.quantity,
                        session
                    });

                    matchingPayment.status = 'completed';
                    matchingPayment.txHash = tx.hash;
                    await matchingPayment.save({ session });
                    
                    await Transaction.create([{
                        userId: matchingPayment.userId, type: 'purchase', currency: 'USDT',
                        amount: -matchingPayment.baseAmount, status: 'completed',
                        details: `Compra de ${matchingPayment.quantity}x ${matchingPayment.boostId} con crypto`,
                        txHash: tx.hash
                    }], { session });

                    await session.commitTransaction();

                    processedTxHashes.add(tx.hash);
                    
                    const user = await User.findById(matchingPayment.userId);
                    // (Opcional, se puede hacer desde el bot admin) notificar al usuario principal
                    // botInstance?.telegram.sendMessage(user.telegramId, ...);
                    
                } catch (error) {
                    await session.abortTransaction();
                    console.error("Error crítico al procesar compra automática:", error);
                } finally {
                    session.endSession();
                }
            } else {
                // CONDICIÓN DE ANOMALÍA: No hay orden de pago que coincida
                const existingAnomaly = await AnomalousTransaction.findOne({ txHash: tx.hash });
                const isAlreadyProcessedPayment = await Payment.findOne({ txHash: tx.hash, status: 'completed' });
                
                if (!existingAnomaly && !isAlreadyProcessedPayment) {
                    await AnomalousTransaction.create({
                        txHash: tx.hash,
                        senderAddress: senderAddress,
                        amount: txAmount,
                        blockNumber: tx.blockNumber,
                        timestamp: txTimestamp,
                    });

                    const adminMessage = `🚨 **TRANSACCIÓN ANÓMALA** 🚨\n\n` +
                                         `Recibido un pago que no coincide con ninguna orden de compra pendiente.\n\n` +
                                         `👤 **Desde:** \`${senderAddress}\`\n` +
                                         `💰 **Monto:** \`${txAmount.toFixed(4)} USDT\`\n` +
                                         `🔗 **TxHash:** \`${tx.hash}\`\n\n` +
                                         `Por favor, revisa el panel de administración.`;
                    
                    if (ADMIN_BOT_URL && INTERNAL_API_KEY) {
                        try {
                            await axios.post(`${ADMIN_BOT_URL}/notify-admins`, {
                                message: adminMessage,
                                parse_mode: 'Markdown'
                            }, {
                                headers: { 'x-internal-api-key': INTERNAL_API_KEY }
                            });
                        } catch (apiError) {
                            console.error("Error notificando al bot de admin vía API:", apiError.message);
                        }
                    }
                }
                processedTxHashes.add(tx.hash); // También marcamos las anómalas como procesadas
            }
        }
    } catch (error) {
        if (error.response) console.error("Error en API de BscScan:", error.response.data);
        else console.error("Error general en el vigilante:", error.message);
    } finally {
      if (processedTxHashes.size > 500) { // Limpiamos la caché para no agotar la memoria
        const newCache = new Set(Array.from(processedTxHashes).slice(250));
        processedTxHashes = newCache;
      }
    }
}

// Esta función es llamada desde el server.js principal de la API
function startCheckingTransactions() {
    console.log("🚀 Vigilante de transacciones iniciado. Revisando cada 30 segundos.");
    cron.schedule('*/30 * * * * *', checkIncomingTransactions);
}

module.exports = { startCheckingTransactions };
// --- END OF FILE atu-mining-backend/services/transaction.service.js ---