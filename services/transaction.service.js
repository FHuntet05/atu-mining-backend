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
    console.log(`[VIGILANTE] Despertando...`);
    try {
        const pendingPayments = await Payment.find({ status: 'pending', expiresAt: { $gt: new Date() } });
        if (pendingPayments.length === 0) return;
        
        console.log(`[VIGILANTE] Encontré ${pendingPayments.length} pago(s) pendiente(s).`);

        const response = await axios.get(BSCSCAN_API_URL);
        if (response.data.status !== '1' || !Array.isArray(response.data.result)) {
            return;
        }
        
        const transactions = response.data.result;
        console.log(`[VIGILANTE] BscScan devolvió ${transactions.length} transacciones.`);

        for (const payment of pendingPayments) {
            console.log(`[VIGILANTE] Buscando coincidencia para la orden de ${payment.uniqueAmount.toFixed(6)} USDT...`);
            
            const matchedTx = transactions.find(tx => {
                // --- INICIO DE CORRECCIÓN DE COMPARACIÓN ---
                // 1. Convertimos el valor de la transacción (que está en WEI) a un número de USDT.
                const txValueInUSDT = Number(tx.value) / 1e18;
                
                // 2. Comparamos los números como strings con una precisión fija de 6 decimales.
                //    Esto evita cualquier error de punto flotante de JavaScript.
                const isAmountMatch = txValueInUSDT.toFixed(6) === payment.uniqueAmount.toFixed(6);
                const isAddressMatch = tx.to.toLowerCase() === DEPOSIT_WALLET_ADDRESS.toLowerCase();

                if (isAddressMatch) {
                    // Log para ver las comparaciones solo de las transacciones a nuestra wallet
                    console.log(`  -> Comparando: TX=${txValueInUSDT.toFixed(6)} vs ORDEN=${payment.uniqueAmount.toFixed(6)} -> ${isAmountMatch ? '¡COINCIDE!' : 'No coincide'}`);
                }

                return isAddressMatch && isAmountMatch;
                // --- FIN DE CORRECCIÓN DE COMPARACIÓN ---
            });

            if (matchedTx) {
                console.log(`✅ ¡ÉXITO! Procesando pago para la orden ${payment._id}`);
                
                const user = await User.findById(payment.userId);
                if (!user) {
                    console.error(`Error: Usuario no encontrado para el pago ${payment._id}`);
                    payment.status = 'failed';
                    await payment.save();
                    continue;
                }

                // ... (El resto de tu lógica de acreditación, que ya es correcta)
                user.usdtBalance += payment.baseAmount;
                await user.save();
                payment.status = 'completed';
                await payment.save();
                // ... etc ...
            }
        }
        console.log(`[VIGILANTE] Ciclo completado.`);

    } catch (error) {
        console.error('💥 ERROR CATASTRÓFICO EN EL VIGILANTE:', error);
    }
}

function startCheckingTransactions(bot) {
    botInstance = bot;
    console.log('Iniciando el vigilante de transacciones...');
    cron.schedule('*/20 * * * * *', checkIncomingTransactions);
}

module.exports = { startCheckingTransactions };