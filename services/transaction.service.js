// atu-mining-api/services/transaction.service.js (VERSIÓN FINAL Y ATÓMICA)
require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const AnomalousTransaction = require('../models/AnomalousTransaction');
const { grantBoostsToUser } = require('./boost.service');
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
            // 1. PREVENCIÓN DE DOBLE PROCESAMIENTO
            const isAlreadyProcessed = await Payment.exists({ txHash: tx.hash });
            const isAlreadyAnomalous = await AnomalousTransaction.exists({ txHash: tx.hash });
            if (isAlreadyProcessed || isAlreadyAnomalous) {
                continue;
            }

            // 2. NORMALIZACIÓN Y PREPARACIÓN
            const senderAddress = tx.from.toLowerCase();
            const txAmountInUSDT = Number(BigInt(tx.value) / BigInt(10**18));

            // ============ LA LÍNEA DE CÓDIGO FINAL Y MÁS IMPORTANTE ============
            // Buscamos una orden de pago que coincida EXACTAMENTE en dirección y monto.
            // Esto es mucho más eficiente y preciso que buscar primero y comparar después.
            const matchingPayment = await Payment.findOne({
                senderAddress: senderAddress,
                baseAmount: txAmountInUSDT, // Comparamos directamente el valor en USDT
                status: 'pending'
            });
            // ===================================================================

            if (matchingPayment) {
                await processMatchedPayment(tx, matchingPayment);
            } else {
                await processAnomalousTransaction(tx);
            }
        }
    } catch (error) {
        console.error("❌ Error en el Vigilante:", error.message);
    }
}

// Procesa una compra exitosa de forma transaccional (SIN CAMBIOS)
async function processMatchedPayment(tx, payment) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        await grantBoostsToUser({
            userId: payment.userId, boostId: payment.boostId, quantity: payment.quantity, session
        });
        payment.status = 'completed';
        payment.txHash = tx.hash;
        await payment.save({ session });
        await Transaction.create([{
            userId: payment.userId, type: 'purchase', currency: 'USDT', amount: -payment.baseAmount,
            status: 'completed', details: `Compra de ${payment.quantity}x ${payment.boostId} (Tx: ${tx.hash.slice(0, 10)}...)`
        }], { session });
        await session.commitTransaction();
        const user = await User.findById(payment.userId).lean();
        if(user) {
            const userMessage = `✅ ¡Felicidades! Tu compra de *${payment.quantity}x del boost '${payment.boostId}'* ha sido procesada.`;
            notifyUser(user.telegramId, userMessage);
        }
    } catch (error) {
        await session.abortTransaction();
        console.error(`❌ Error al procesar el pago ${payment._id}:`, error);
    } finally {
        session.endSession();
    }
}

// Procesa una transacción que no tiene un match (SIN CAMBIOS)
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

// Función que inicia el cron job (SIN CAMBIOS)
function startVigilante() {
    console.log("🚀 Vigilante v7 (Búsqueda Atómica) iniciado. Chequeando cada 30 segundos.");
    cron.schedule('*/30 * * * * *', checkIncomingTransactions);
}

module.exports = { startVigilante };