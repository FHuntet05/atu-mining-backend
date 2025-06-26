// En: atu-mining-backend/services/transaction.service.js
const axios = require('axios');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');

const API_KEY = process.env.BSCSCAN_API_KEY;
const WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955'; // Contrato de USDT en BSC

async function checkIncomingTransactions(bot) {
    try {
        const url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT}&address=${WALLET_ADDRESS}&page=1&offset=100&sort=desc&apikey=${API_KEY}`;
        const response = await axios.get(url);

        if (response.data.status !== "1") return;

        for (const tx of response.data.result) {
            // Buscamos transacciones entrantes a nuestra wallet
            if (tx.to.toLowerCase() === WALLET_ADDRESS.toLowerCase()) {
                const txHash = tx.hash;
                const amount = parseFloat(tx.value) / 1e18; // USDT tiene 18 decimales
                const uniqueAmount = parseFloat(amount.toFixed(8));

                // Buscamos una orden de pago pendiente con ese monto único
                const pendingPayment = await Payment.findOne({ uniqueAmount, status: 'pending' });

                if (pendingPayment) {
                    pendingPayment.status = 'completed';
                    await pendingPayment.save();

                    // Acreditar saldo y notificar
                    const user = await User.findOneAndUpdate(
                        { telegramId: pendingPayment.telegramId },
                        { $inc: { usdtBalance: pendingPayment.baseAmount } },
                        { new: true }
                    );
                    
                    if (user) {
                        await new Transaction({ telegramId: user.telegramId, type: 'deposit', description: 'Depósito USDT (BEP20)', amount: `+${pendingPayment.baseAmount.toFixed(2)} USDT` }).save();
                        await bot.telegram.sendMessage(user.telegramId, `✅ ¡VIP ACTIVADO AUTOMÁTICAMENTE!\n👤 *Usuario:* \`${user.telegramId}\`\n💰 *Pago:* ${pendingPayment.baseAmount.toFixed(2)} USDT`);
                        
                        // Aquí iría tu lógica de referidos...
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error al verificar transacciones:", error.message);
    }
}

function startTransactionScanner(bot) {
    console.log('🚀 Vigilante de transacciones iniciado. Verificando cada 20 segundos.');
    setInterval(() => checkIncomingTransactions(bot), 20000); // Cada 20 segundos
}

module.exports = { startTransactionScanner };