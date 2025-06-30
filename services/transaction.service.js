// --- START OF FILE atu-mining-api/services/transaction.service.js (COMPLETO Y CORREGIDO) ---

require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const AnomalousTransaction = require('../models/AnomalousTransaction');
const { grantBoostsToUser } = require('./boost.service');
// --- !! IMPORTAMOS EL SERVICIO DE COMISIONES !! ---
const { processReferralCommissions } = require('./referral.service');
const { notifyAdmins, notifyUser } = require('./notification.service');

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS.toLowerCase();
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT_ADDRESS}&address=${DEPOSIT_WALLET_ADDRESS}&page=1&offset=50&sort=desc&apikey=${BSCSCAN_API_KEY}`;

async function checkIncomingTransactions() {
    try {
        const response = await axios.get(BSCSCAN_API_URL);
        if (response.data.status !== '1' || !Array.isArray(response.data.result)) {
            return;
        }
        for (const tx of response.data.result.reverse()) {
            const isProcessed = await Payment.exists({ txHash: tx.hash }) || await AnomalousTransaction.exists({ txHash: tx.hash });
            if (isProcessed) continue;
            
            const senderAddress = tx.from.toLowerCase();
            const txAmountInUSDT = Number(BigInt(tx.value) / BigInt(10**18));
            
            const matchingPayment = await Payment.findOne({
                senderAddress: senderAddress,
                baseAmount: txAmountInUSDT,
                status: 'pending'
            });
            
            if (matchingPayment) {
                await processMatchedPayment(tx, matchingPayment);
            } else {
                await processAnomalousTransaction(tx);
            }
        }
    } catch (error) {
        console.error("❌ [Vigilante] Error CRÍTICO en checkIncomingTransactions:", error);
    }
}

async function processMatchedPayment(tx, payment) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        await grantBoostsToUser({
            userId: payment.userId, boostId: payment.boostId, quantity: payment.quantity, session
        });
        
        // --- !! INYECTAMOS LA LÓGICA DE COMISIONES AQUÍ !! ---
        // 1. Cargamos el objeto completo del comprador, que es necesario para la lógica de comisiones.
        const buyer = await User.findById(payment.userId).session(session);
        if (buyer) {
            // 2. Llamamos a la función de comisiones.
            await processReferralCommissions({ buyer: buyer, session });
        }
        
        payment.status = 'completed';
        payment.txHash = tx.hash;
        await payment.save({ session });
        
        await Transaction.create([{
            userId: payment.userId, type: 'purchase', currency: 'USDT', amount: -payment.baseAmount,
            status: 'completed', details: `Compra de ${payment.quantity}x ${payment.boostId} (Tx: ${tx.hash.slice(0, 10)}...)`
        }], { session });
        
        await session.commitTransaction();
        
        if(buyer) {
            const userMessage = `✅ ¡Felicidades! Tu compra de *${payment.quantity}x del boost '${payment.boostId}'* ha sido procesada.`;
            notifyUser(buyer.telegramId, userMessage);
        }
    } catch (error) {
        await session.abortTransaction();
        console.error(`❌ Error al procesar el pago ${payment._id}:`, error);
    } finally {
        session.endSession();
    }
}

async function processAnomalousTransaction(tx) {
    const txTimestamp = new Date(parseInt(tx.timeStamp) * 1000);
    const amountInUSDT = Number(BigInt(tx.value) / BigInt(10**18));
    await AnomalousTransaction.create({
        txHash: tx.hash, senderAddress: tx.from.toLowerCase(), amount: amountInUSDT,
        timestamp: txTimestamp, blockNumber: tx.blockNumber
    });
    const adminMessage = `🚨 *TRANSACCIÓN ANÓMALA* 🚨\nDe: \`${tx.from.toLowerCase()}\`\nMonto: \`${amountInUSDT.toFixed(4)} USDT\`\nTx: \`https://bscscan.com/tx/${tx.hash}\``;
    notifyAdmins(adminMessage);
}

function startVigilante() {
    console.log("🚀 Vigilante de transacciones iniciado. Chequeando cada 30 segundos.");
    cron.schedule('*/30 * * * * *', checkIncomingTransactions);
}

module.exports = { startVigilante };

// --- END OF FILE atu-mining-api/services/transaction.service.js ---