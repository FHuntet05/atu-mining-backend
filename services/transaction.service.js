// --- START OF FILE atu-mining-api/services/transaction.service.js (SOLUCIÓN DEFINITIVA) ---
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
    if (!botInstance || ADMIN_IDS.length === 0) return;
    ADMIN_IDS.forEach(adminId => {
        botInstance.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' }).catch(e => console.error(`Error notificando admin ${adminId}: ${e.message}`));
    });
};

async function checkIncomingTransactions() {
    console.log('--- [VIGILANTE] Iniciando ciclo de revisión ---');
    try {
        const response = await axios.get(BSCSCAN_API_URL);
        if (response.data.status !== '1' || !Array.isArray(response.data.result)) return;

        for (const tx of response.data.result) {
            if (processedTxHashes.has(tx.hash)) continue;
            processedTxHashes.add(tx.hash);

            const txAmount = Number(tx.value) / (10 ** parseInt(tx.tokenDecimal));
            const senderAddress = tx.from.toLowerCase();
            const txTimestamp = new Date(parseInt(tx.timeStamp) * 1000);

            console.log(`[VIGILANTE] Analizando TX: ${tx.hash.slice(0, 10)}... | From: ${senderAddress} | Amount: ${txAmount}`);
            
            // --- LÓGICA DE BÚSQUEDA MEJORADA ---
            // Buscamos una orden que cumpla todas las condiciones.
            // La condición del tiempo es la más importante.
            const matchingPayment = await Payment.findOne({
                status: 'pending',
                senderAddress: senderAddress,
                expiresAt: { $gt: new Date() },
                createdAt: { $lt: txTimestamp } // ¡CRUCIAL! La orden debe haber sido creada ANTES que la transacción.
            }).populate('userId').sort({ createdAt: -1 });

            if (!matchingPayment) {
                // Si no hay orden, podría ser anómalo
                const existingAnomaly = await AnomalousTransaction.findOne({ txHash: tx.hash });
                const isAlreadyProcessed = await Payment.findOne({ txHash: tx.hash });
                if (!existingAnomaly && !isAlreadyProcessed) {
                    await AnomalousTransaction.create({ txHash: tx.hash, senderAddress, amount: txAmount, timestamp: txTimestamp });
                    const adminMessage = `🚨 *TRANSACCIÓN ANÓMALA DETECTADA* 🚨\n\n... (mensaje de anomalía) ...`;
                    notifyAdmins(adminMessage);
                    console.log(`[VIGILANTE] TX ${tx.hash.slice(0,10)}... marcada como ANÓMALA.`);
                }
                continue; // Pasamos a la siguiente transacción
            }

            console.log(`[VIGILANTE] TX ${tx.hash.slice(0, 10)}... ENCONTRÓ una orden pendiente. ID de Orden: ${matchingPayment._id}`);

            // Ahora verificamos el monto. Tolerancia del 5% por si pagan un poco de más.
            const amountMatches = txAmount >= matchingPayment.baseAmount && (Math.abs(txAmount - matchingPayment.baseAmount) / matchingPayment.baseAmount) < 0.05;

            if (amountMatches) {
                console.log(`[VIGILANTE] ¡COINCIDENCIA PERFECTA! Procesando compra para usuario ${matchingPayment.userId.firstName}...`);
                const session = await mongoose.startSession();
                session.startTransaction();
                try {
                    await grantBoostsToUser({ userId: matchingPayment.userId._id, boostId: matchingPayment.boostId, quantity: matchingPayment.quantity, session });
                    matchingPayment.status = 'completed';
                    matchingPayment.txHash = tx.hash;
                    await matchingPayment.save({ session });
                    await Transaction.create([{ userId: matchingPayment.userId._id, type: 'purchase', currency: 'USDT', amount: -matchingPayment.baseAmount, status: 'completed', details: `Compra de ${matchingPayment.quantity}x ${matchingPayment.boostId}`, txHash: tx.hash }], { session });
                    await session.commitTransaction();
                    botInstance.telegram.sendMessage(matchingPayment.userId.telegramId, `✅ ¡Felicidades! Tu compra de *${matchingPayment.quantity}x del boost '${matchingPayment.boostId}'* ha sido procesada.`, { parse_mode: 'Markdown' }).catch(()=>{});
                } catch (error) {
                    await session.abortTransaction(); console.error("Error al procesar compra automática:", error);
                } finally { session.endSession(); }
            } else {
                console.log(`[VIGILANTE] TX ${tx.hash.slice(0, 10)}... encontrada pero el MONTO NO COINCIDE. Esperado: ${matchingPayment.baseAmount}, Recibido: ${txAmount}. Se tratará como anómala.`);
                // Marcar como anómala porque el monto es incorrecto
                const existingAnomaly = await AnomalousTransaction.findOne({ txHash: tx.hash });
                if (!existingAnomaly) {
                    await AnomalousTransaction.create({ txHash: tx.hash, senderAddress, amount: txAmount, timestamp: txTimestamp });
                    const adminMessage = `🚨 *ANOMALÍA POR MONTO INCORRECTO* 🚨\n\n... (mensaje de anomalía) ...`;
                    notifyAdmins(adminMessage);
                }
            }
        }
    } catch (error) {
        console.error("Error general en el Vigilante:", error.message);
    }
}

function startCheckingTransactions(bot) {
    botInstance = bot;
    console.log("🚀 Vigilante de transacciones v2 iniciado.");
    cron.schedule('*/30 * * * * *', checkIncomingTransactions);
}

module.exports = { startCheckingTransactions };
// --- END OF FILE atu-mining-api/services/transaction.service.js (SOLUCIÓN DEFINITIVA) ---