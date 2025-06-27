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

const COMMISSIONS = {
    level1: 0.27,
    level2: 0.17,
    level3: 0.07,
};

async function checkIncomingTransactions() {
    try {
        const pendingPayments = await Payment.find({ status: 'pending', expiresAt: { $gt: new Date() } });
        if (pendingPayments.length === 0) return;

        const response = await axios.get(BSCSCAN_API_URL);
        if (response.data.status !== '1') return;
        
        const transactions = response.data.result;

        for (const payment of pendingPayments) {
            const matchedTx = transactions.find(tx => 
                tx.to.toLowerCase() === DEPOSIT_WALLET_ADDRESS.toLowerCase() &&
                (Number(tx.value) / 1e18).toFixed(6) === payment.uniqueAmount.toFixed(6)
            );

            if (matchedTx) {
                // Poblamos el árbol de referidos hasta 3 niveles de profundidad
                const user = await User.findById(payment.userId).populate({
                    path: 'referrerId', // Nivel 1
                    model: 'User',
                    populate: {
                        path: 'referrerId', // Nivel 2
                        model: 'User',
                        populate: {
                            path: 'referrerId', // Nivel 3
                            model: 'User'
                        }
                    }
                });
                
                if (!user) {
                    payment.status = 'failed';
                    await payment.save();
                    continue;
                }

                // --- INICIO DE LÓGICA DE COMISIONES ---
                // Verificamos si este es el PRIMER depósito del usuario
                if (!user.hasMadeDeposit) {
                    user.hasMadeDeposit = true; // Marcamos que ya ha depositado
                    
                    // Nivel 1: El referente directo
                    const referrerL1 = user.referrerId;
                    if (referrerL1) {
                        referrerL1.referralEarnings = (referrerL1.referralEarnings || 0) + COMMISSIONS.level1;
                        referrerL1.usdtForWithdrawal = (referrerL1.usdtForWithdrawal || 0) + COMMISSIONS.level1;
                        await referrerL1.save();
                        // Notificar al referente de Nivel 1
                        botInstance.telegram.sendMessage(referrerL1.telegramId, `🎉 ¡Has recibido una comisión de ${COMMISSIONS.level1} USDT de tu referido de Nivel 1!`).catch(e => console.error(e));

                        // Nivel 2: El referente del referente
                        const referrerL2 = referrerL1.referrerId;
                        if (referrerL2) {
                            referrerL2.referralEarnings = (referrerL2.referralEarnings || 0) + COMMISSIONS.level2;
                            referrerL2.usdtForWithdrawal = (referrerL2.usdtForWithdrawal || 0) + COMMISSIONS.level2;
                            await referrerL2.save();
                            botInstance.telegram.sendMessage(referrerL2.telegramId, `🎉 ¡Has recibido una comisión de ${COMMISSIONS.level2} USDT de tu referido de Nivel 2!`).catch(e => console.error(e));

                            // Nivel 3: El referente del referente del referente
                            const referrerL3 = referrerL2.referrerId;
                            if (referrerL3) {
                                referrerL3.referralEarnings = (referrerL3.referralEarnings || 0) + COMMISSIONS.level3;
                                referrerL3.usdtForWithdrawal = (referrerL3.usdtForWithdrawal || 0) + COMMISSIONS.level3;
                                await referrerL3.save();
                                botInstance.telegram.sendMessage(referrerL3.telegramId, `🎉 ¡Has recibido una comisión de ${COMMISSIONS.level3} USDT de tu referido de Nivel 3!`).catch(e => console.error(e));
                            }
                        }
                    }
                }
                // --- FIN DE LÓGICA DE COMISIONES ---

                // Acreditar el saldo al usuario que depositó
                user.usdtBalance += payment.baseAmount;
                await user.save();

                payment.status = 'completed';
                payment.txHash = matchedTx.hash;
                await payment.save();
                
                await Transaction.create({ /* ... tu lógica de crear transacción ... */ });
                
                botInstance.telegram.sendMessage(user.telegramId, `✅ ¡Tu depósito de ${payment.baseAmount} USDT ha sido acreditado!`).catch(e => console.error(e));
            }
        }
    } catch (error) {
        console.error('Error en checkIncomingTransactions:', error);
    }
}

function startCheckingTransactions(bot) {
    botInstance = bot;
    console.log('Iniciando el vigilante de transacciones (con comisiones) cada 20 segundos...');
    cron.schedule('*/20 * * * * *', checkIncomingTransactions);
}

module.exports = { startCheckingTransactions };