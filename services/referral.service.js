// --- START OF FILE atu-mining-api/services/referral.service.js (COMPLETO Y CORREGIDO) ---

const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
// Importamos la configuración central
const { referralCommissions } = require('../config/economy'); 

/**
 * Procesa y distribuye las comisiones de referido de 3 niveles.
 * @param {object} options
 * @param {User} options.buyer - El objeto de usuario completo de la persona que compró el boost.
 * @param {mongoose.ClientSession} options.session - La sesión de Mongoose para la transacción.
 */
async function processReferralCommissions({ buyer, session }) {
    // 1. Verificación: ¿Es la primera compra de este usuario?
    if (!buyer || buyer.hasGeneratedReferralCommission || !buyer.referrerId) {
        // Si ya generó comisión o no tiene referente, no hacemos nada.
        return;
    }

    console.log(`[Referral] Procesando comisiones para la primera compra del usuario ${buyer.telegramId}`);

    // 2. Marcar al comprador para que no vuelva a generar comisiones.
    buyer.hasGeneratedReferralCommission = true;
    await buyer.save({ session });

    // 3. Cadena de distribución de comisiones
    let currentReferrerId = buyer.referrerId;
    // Usamos las comisiones desde el archivo de configuración
    const levels = [referralCommissions.level1, referralCommissions.level2, referralCommissions.level3];
    
    for (let i = 0; i < levels.length; i++) {
        if (!currentReferrerId) break; // Si se acaba la cadena de referidos, paramos.

        const referrer = await User.findById(currentReferrerId).session(session);
        if (!referrer) break; // Si el referente no existe, paramos.

        const commissionAmount = levels[i];
        const level = i + 1;
        
        // Acreditamos la comisión
        referrer.usdtBalance += commissionAmount;
        referrer.referralEarnings += commissionAmount;
        await referrer.save({ session });
        
        // Creamos la transacción para el historial del referente
        await Transaction.create([{
            userId: referrer._id,
            type: 'referral_commission',
            currency: 'USDT',
            amount: commissionAmount,
            status: 'completed',
            details: `Comisión de Nivel ${level} por referido ${buyer.telegramId}`
        }], { session });

        console.log(`[Referral] Pagada comisión de ${commissionAmount} USDT al Nivel ${level} referente: ${referrer.telegramId}`);

        // Pasamos al siguiente nivel
        currentReferrerId = referrer.referrerId;
    }
}

module.exports = { processReferralCommissions };

// --- END OF FILE atu-mining-api/services/referral.service.js ---