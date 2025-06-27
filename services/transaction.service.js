require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose'); // Importamos Mongoose para usar sesiones

// --- Configuración Crítica ---
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS;
const USDT_CONTRACT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const BSCSCAN_API_URL = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT_ADDRESS}&address=${DEPOSIT_WALLET_ADDRESS}&page=1&offset=100&sort=desc&apikey=${BSCSCAN_API_KEY}`;
const PROCESSED_OR_NOTIFIED_HASHES = new Set(); // Previene notificaciones y procesamientos duplicados

let botInstance; // Instancia del bot para enviar notificaciones

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

// --- Función Principal del Vigilante ---
async function checkIncomingTransactions() {
    try {
        const response = await axios.get(BSCSCAN_API_URL);
        if (response.data.status !== '1' || !Array.isArray(response.data.result) || response.data.result.length === 0) {
            return; // No hay transacciones nuevas
        }
        
        const recentTokenTransactions = response.data.result;

        for (const tx of recentTokenTransactions) {
            if (PROCESSED_OR_NOTIFIED_HASHES.has(tx.hash)) continue; // Evitar re-procesamiento

            const txAmount = Number(tx.value) / (10 ** parseInt(tx.tokenDecimal));

            const matchingPayment = await Payment.findOne({ 
                status: 'pending',
                uniqueAmount: parseFloat(txAmount.toFixed(6)),
                expiresAt: { $gt: new Date() }
            });

            if (matchingPayment) {
                // --- PROCESAMIENTO DE PAGO EXITOSO Y AUTOMÁTICO ---
                const session = await mongoose.startSession();
                session.startTransaction();
                try {
                    console.log(`✅ Coincidencia encontrada para ${txAmount.toFixed(6)} USDT. Procesando...`);
                    
                    matchingPayment.status = 'completed';
                    matchingPayment.txHash = tx.hash;
                    
                    const user = await User.findById(matchingPayment.userId).populate({
                        path: 'referrerId', model: 'User',
                        populate: { path: 'referrerId', model: 'User',
                            populate: { path: 'referrerId', model: 'User' }
                        }
                    }).session(session);

                    if (!user) throw new Error(`Usuario ${matchingPayment.userId} no encontrado.`);

                    // Acreditar saldo
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
                        details: 'Depósito confirmado vía BscScan', txHash: tx.hash
                    }], { session });
                    
                    await session.commitTransaction();
                    botInstance.telegram.sendMessage(user.telegramId, `✅ ¡Tu depósito de ${matchingPayment.baseAmount} USDT ha sido acreditado!`).catch(e => {});

                } catch (error) {
                    await session.abortTransaction();
                    console.error("Error al procesar pago coincidente:", error);
                } finally {
                    session.endSession();
                }

                PROCESSED_OR_NOTIFIED_HASHES.add(tx.hash); // Marcar como procesado

            } else {
                // --- MANEJO DE DEPÓSITO ANÓMALO ---
                const alreadyProcessed = await Payment.findOne({ txHash: tx.hash });
                if (alreadyProcessed) {
                    PROCESSED_OR_NOTIFIED_HASHES.add(tx.hash);
                    continue;
                }
                
                const adminIds = (process.env.ADMIN_IDS || '').split(',');
                if (adminIds.length > 0 && botInstance) {
                    console.warn(`🚨 Depósito anómalo detectado: ${txAmount.toFixed(6)} USDT, Hash: ${tx.hash}`);
                    const adminMessage = `🚨 *Depósito Anómalo Detectado* 🚨\n\n` +
                                         `*Cantidad:* \`${txAmount.toFixed(6)} USDT\`\n` +
                                         `*Desde Wallet:* \`${tx.from}\`\n` +
                                         `*Hash de Tx:* \`${tx.hash}\`\n\n` +
                                         `*Acción Requerida:* Verificar y acreditar manualmente si es necesario.`;
                    
                    for (const adminId of adminIds) {
                        if (adminId) {
                            botInstance.telegram.sendMessage(adminId.trim(), adminMessage, { parse_mode: 'Markdown' })
                                .catch(e => console.error(`Error al notificar al admin ${adminId}:`, e));
                        }
                    }
                }
                PROCESSED_OR_NOTIFIED_HASHES.add(tx.hash);
            }
        }
    } catch (error) {
        console.error("💥 Error en el vigilante de transacciones:", error);
    }
}

function startCheckingTransactions(bot) {
    if (!bot) {
        console.error("ERROR: No se proporcionó una instancia del bot al vigilante.");
        return;
    }
    botInstance = bot;
    console.log('✅ Iniciando vigilante de transacciones (producción)...');
    cron.schedule('*/30 * * * * *', checkIncomingTransactions); // Cada 30 segundos
}

module.exports = { startCheckingTransactions };