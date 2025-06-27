require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=txlist&address=${DEPOSIT_WALLET_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=${BSCSCAN_API_KEY}`;

let botInstance;

async function checkIncomingTransactions() {
    console.log(`[VIGILANTE] Despertando... Buscando pagos pendientes.`);
    try {
        // Buscamos pagos pendientes que no hayan expirado
        const pendingPayments = await Payment.find({ status: 'pending', expiresAt: { $gt: new Date() } });
        if (pendingPayments.length === 0) {
            console.log(`[VIGILANTE] No hay pagos pendientes. Durmiendo.`);
            return;
        }
        
        console.log(`[VIGILANTE] Encontré ${pendingPayments.length} pago(s) pendiente(s).`);
        pendingPayments.forEach(p => console.log(`  - Esperando pago por: ${p.uniqueAmount.toFixed(6)} USDT`));

        console.log(`[VIGILANTE] Consultando a BscScan...`);
        const response = await axios.get(BSCSCAN_API_URL);

        if (response.data.status !== '1' || !Array.isArray(response.data.result)) {
            if (response.data.message !== 'No transactions found') {
                console.warn(`[VIGILANTE] BscScan API devolvió un error: ${response.data.message}`);
            } else {
                console.log(`[VIGILANTE] BscScan no encontró transacciones recientes.`);
            }
            return;
        }
        
        const transactions = response.data.result;
        console.log(`[VIGILANTE] BscScan devolvió ${transactions.length} transacciones recientes.`);

        for (const payment of pendingPayments) {
            console.log(`[VIGILANTE] Procesando orden de ${payment.uniqueAmount.toFixed(6)}...`);
            
            const matchedTx = transactions.find(tx => {
                // Convertimos el valor de la transacción (que está en WEI) a USDT y lo redondeamos
                const txAmount = parseFloat((Number(tx.value) / 1e18).toFixed(6));
                const paymentAmount = parseFloat(payment.uniqueAmount.toFixed(6));
                
                // Log de depuración para cada comparación. Puedes descomentarlo si quieres ver todo.
                // console.log(`  -> Comparando: TX=${txAmount} vs ORDEN=${paymentAmount} | Dirección TO: ${tx.to.toLowerCase()}`);
                
                return tx.to.toLowerCase() === DEPOSIT_WALLET_ADDRESS.toLowerCase() && txAmount === paymentAmount;
            });

            if (matchedTx) {
                console.log(`✅ ¡COINCIDENCIA ENCONTRADA! Procesando pago para la orden ${payment._id} con TxHash: ${matchedTx.hash}`);
                
                const user = await User.findById(payment.userId).populate({ /* ... populate de referidos ... */ });
                if (!user) {
                    console.error(`Error: Usuario no encontrado para el pago ${payment._id}`);
                    payment.status = 'failed';
                    await payment.save();
                    continue;
                }

                // Lógica de acreditación y comisiones (si es el primer depósito)
                if (!user.hasMadeDeposit) {
                    user.hasMadeDeposit = true;
                    // ... Aquí iría la lógica de pago de comisiones a referentes ...
                }

                user.usdtBalance += payment.baseAmount;
                await user.save();

                payment.status = 'completed';
                payment.txHash = matchedTx.hash;
                await payment.save();
                
                await Transaction.create({
                    userId: user._id,
                    type: 'deposit',
                    currency: 'USDT',
                    amount: payment.baseAmount,
                    status: 'completed',
                    details: `Depósito confirmado vía BscScan`,
                    txHash: matchedTx.hash
                });
                
                botInstance.telegram.sendMessage(user.telegramId, `✅ ¡Tu depósito de ${payment.baseAmount} USDT ha sido acreditado!`).catch(e => console.error(e));
            } else {
                // No es un error, simplemente no se encontró una coincidencia en este ciclo.
                // console.log(`  - No se encontró coincidencia para ${payment.uniqueAmount.toFixed(6)}.`);
            }
        }
        console.log(`[VIGILANTE] Ciclo de verificación completado. Durmiendo.`);

    } catch (error) {
        console.error('💥 ERROR CATASTRÓFICO EN EL VIGILANTE:', error);
    }
}

function startCheckingTransactions(bot) {
    botInstance = bot;
    console.log('Iniciando el vigilante de transacciones (con depuración)...');
    cron.schedule('*/20 * * * * *', checkIncomingTransactions);
}

module.exports = { startCheckingTransactions };