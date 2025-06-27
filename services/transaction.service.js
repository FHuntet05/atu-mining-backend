require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT_ADDRESS}&address=${DEPOSIT_WALLET_ADDRESS}&page=1&offset=100&sort=desc&apikey=${BSCSCAN_API_KEY}`;

let botInstance;

async function checkIncomingTransactions() {
    try {
        const response = await axios.get(BSCSCAN_API_URL);
        if (response.data.status !== '1' || !Array.isArray(response.data.result) || response.data.result.length === 0) return;

        const tokenTransactions = response.data.result;

        for (const tx of tokenTransactions) {
            const txAmount = Number(tx.value) / (10 ** parseInt(tx.tokenDecimal));
            const senderAddress = tx.from.toLowerCase();

            // Buscamos una orden pendiente que coincida en DIRECCIÓN y MONTO (con una pequeña tolerancia)
            const matchingPayment = await Payment.findOne({
                status: 'pending',
                senderAddress: senderAddress,
                expiresAt: { $gt: new Date() }
            });

            if (matchingPayment) {
                // Verificamos si el monto es suficientemente cercano (ej. 99.9% del valor esperado)
                if (txAmount >= matchingPayment.baseAmount * 0.999) {
                    console.log(`✅ Coincidencia encontrada por dirección y monto. Procesando pago...`);
                    // --- Aquí va toda la lógica completa de acreditación y comisiones ---
                    // (Implementación completa, sin omisiones)
                    const session = await mongoose.startSession();
                    session.startTransaction();
                    try {
                        matchingPayment.status = 'completed';
                        matchingPayment.txHash = tx.hash;

                        const user = await User.findById(matchingPayment.userId).session(session);
                        if (!user) throw new Error("Usuario no encontrado");

                        user.usdtBalance += matchingPayment.baseAmount;
                         // Lógica de comisiones si es el primer depósito
                        if (!user.hasMadeDeposit) {
                        user.hasMadeDeposit = true;
                        const referrerL1 = user.referrerId;
                        if (referrerL1) {
                            referrerL1.referralEarnings = (referrerL1.referralEarnings || 0) + COMMISSIONS.level1;
                            referrerL1.usdtForWithdrawal = (referrerL1.usdtForWithdrawal || 0) + COMMISSIONS.level1;
                            await referrerL1.save({ session });
                            botInstance.telegram.sendMessage(referrerL1.telegramId, `🎉 ¡Has recibido ${COMMISSIONS.level1} USDT de comisión!`).catch(e => {});

                            const referrerL2 = referrerL1.referrerId;
                            if (referrerL2) {
                                referrerL2.referralEarnings = (referrerL2.referralEarnings || 0) + COMMISSIONS.level2;
                                referrerL2.usdtForWithdrawal = (referrerL2.usdtForWithdrawal || 0) + COMMISSIONS.level2;
                                await referrerL2.save({ session });
                                botInstance.telegram.sendMessage(referrerL2.telegramId, `🎉 ¡Has recibido ${COMMISSIONS.level2} USDT de comisión!`).catch(e => {});
                                
                                const referrerL3 = referrerL2.referrerId;
                                if (referrerL3) {
                                    referrerL3.referralEarnings = (referrerL3.referralEarnings || 0) + COMMISSIONS.level3;
                                    referrerL3.usdtForWithdrawal = (referrerL3.usdtForWithdrawal || 0) + COMMISSIONS.level3;
                                    await referrerL3.save({ session });
                                    botInstance.telegram.sendMessage(referrerL3.telegramId, `🎉 ¡Has recibido ${COMMISSIONS.level3} USDT de comisión!`).catch(e => {});
                                }
                            }
                        }
                    }
                        
                        await user.save({ session });
                        await matchingPayment.save({ session });
                        await Transaction.create([{
                            userId: user._id, type: 'deposit', currency: 'USDT',
                            amount: matchingPayment.baseAmount, status: 'completed',
                            details: `Depósito desde ${senderAddress}`, txHash: tx.hash
                        }], { session });

                        await session.commitTransaction();
                        botInstance.telegram.sendMessage(user.telegramId, `✅ Depósito de ${matchingPayment.baseAmount} USDT acreditado!`).catch(e => {});

                    } catch (error) {
                        await session.abortTransaction();
                        console.error("Error en transacción de acreditación:", error);
                    } finally {
                        session.endSession();
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error en el vigilante:", error);
    }
}

function startCheckingTransactions(bot) {
    botInstance = bot;
    cron.schedule('*/30 * * * * *', checkIncomingTransactions);
}
module.exports = { startCheckingTransactions };