// atu-mining-api/services/transaction.service.js (VERSIÓN FINAL Y ROBUSTA)
require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const AnomalousTransaction = require('../models/AnomalousTransaction');
const { grantBoostsToUser } = require('./boost.service');
const { notifyAdmins, notifyUser } = require('./notification.service'); // Asumimos un servicio de notificación

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS.toLowerCase(); // Normalizar aquí
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // BEP-20
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT_ADDRESS}&address=${DEPOSIT_WALLET_ADDRESS}&page=1&offset=50&sort=desc&apikey=${BSCSCAN_API_KEY}`;

// Función principal del Vigilante
async function checkIncomingTransactions() {
    try {
        const response = await axios.get(BSCSCAN_API_URL);
        if (response.data.status !== '1' || !Array.isArray(response.data.result)) {
            return;
        }

        // Procesamos las transacciones en orden, de la más antigua a la más nueva, para ser justos.
        for (const tx of response.data.result.reverse()) {
            
            // --- 1. PREVENCIÓN DE DOBLE PROCESAMIENTO (IDEMPOTENCIA) ---
            // ¿Ya hemos procesado esta transacción (exitosa o anómala)?
            const isAlreadyProcessed = await Payment.findOne({ txHash: tx.hash }).lean();
            const isAlreadyAnomalous = await AnomalousTransaction.findOne({ txHash: tx.hash }).lean();
            if (isAlreadyProcessed || isAlreadyAnomalous) {
                continue; // Ya la conocemos, la ignoramos.
            }

            // --- 2. NORMALIZACIÓN DE DATOS DE LA BLOCKCHAIN ---
            const senderAddress = tx.from.toLowerCase();
            // Usamos BigInt para la máxima precisión. 18 decimales para USDT.
            const txAmountBigInt = BigInt(tx.value);

            // --- 3. BÚSQUEDA DEL MATCH EN NUESTRA DB ---
            // Buscamos una orden de pago pendiente que coincida en dirección y monto.
            const pendingPayment = await Payment.findOne({
                senderAddress: senderAddress,
                status: 'pending',
                // Comparamos el monto exacto. El frontend debe enviar el precio exacto del boost.
                // Podríamos buscar en un rango si fuera necesario, pero la exactitud es mejor.
            });

            if (pendingPayment) {
                 // Convertimos el precio del boost de la orden a la unidad atómica para comparar
                const paymentAmountBigInt = BigInt(pendingPayment.baseAmount * (10**18));
                
                // Comparamos los BigInts. Si son iguales, es un match perfecto.
                if (txAmountBigInt === paymentAmountBigInt) {
                    await processMatchedPayment(tx, pendingPayment);
                } else {
                    // El monto no coincide, lo tratamos como anómalo por ahora.
                    await processAnomalousTransaction(tx);
                }
            } else {
                // No hay ninguna orden de pago pendiente para este remitente.
                await processAnomalousTransaction(tx);
            }
        }
    } catch (error) {
        console.error("❌ Error en el Vigilante:", error.message);
    }
}

// Procesa una compra exitosa de forma transaccional
async function processMatchedPayment(tx, payment) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        console.log(`✅ Match encontrado! Procesando pago ${payment._id} con TxHash ${tx.hash}`);

        await grantBoostsToUser({
            userId: payment.userId,
            boostId: payment.boostId,
            quantity: payment.quantity,
            session
        });

        // Actualizamos el pago a 'completed'
        payment.status = 'completed';
        payment.txHash = tx.hash;
        await payment.save({ session });
        
        // Creamos un registro de la transacción interna
        await Transaction.create([{
            userId: payment.userId,
            type: 'purchase',
            currency: 'USDT',
            amount: -payment.baseAmount, // Negativo porque es un gasto
            status: 'completed',
            details: `Compra de ${payment.quantity}x ${payment.boostId} (Tx: ${tx.hash.slice(0, 10)}...)`
        }], { session });

        await session.commitTransaction();

        // Notificamos al usuario fuera de la transacción
        const user = await User.findById(payment.userId).lean();
        if(user) {
            const userMessage = `✅ ¡Felicidades! Tu compra de *${payment.quantity}x del boost '${payment.boostId}'* ha sido procesada exitosamente.`;
            notifyUser(user.telegramId, userMessage);
        }

    } catch (error) {
        await session.abortTransaction();
        console.error(`❌ Error al procesar el pago ${payment._id}:`, error);
        // Si falla, no lo marcamos como anómalo para que se pueda reintentar.
    } finally {
        session.endSession();
    }
}

// Procesa una transacción que no tiene un match
async function processAnomalousTransaction(tx) {
    const txTimestamp = new Date(parseInt(tx.timeStamp) * 1000);
    const amountInUSDT = Number(BigInt(tx.value) / BigInt(10**18));

    await AnomalousTransaction.create({
        txHash: tx.hash,
        senderAddress: tx.from.toLowerCase(),
        amount: amountInUSDT,
        timestamp: txTimestamp,
        blockNumber: tx.blockNumber
    });

    const adminMessage = `🚨 *TRANSACCIÓN ANÓMALA DETECTADA* 🚨\n\n` +
                         `De: \`${tx.from.toLowerCase()}\`\n` +
                         `Monto: \`${amountInUSDT.toFixed(4)} USDT\`\n` +
                         `TxHash: \`https://bscscan.com/tx/${tx.hash}\``;
    notifyAdmins(adminMessage);
}

// Función que inicia el cron job
function startVigilante() {
    console.log("🚀 Vigilante v6 (Transaccional y Robusto) iniciado. Chequeando cada 30 segundos.");
    cron.schedule('*/30 * * * * *', checkIncomingTransactions);
}

module.exports = { startVigilante };