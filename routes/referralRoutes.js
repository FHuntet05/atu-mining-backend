// atu-mining-api/routes/referralRoutes.js (VERSIÓN FINAL CON LÓGICA DIRECTA Y TELEMETRÍA)
const express = require('express');
const router = express.Router();
const User = require('../models/User');

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

// Función auxiliar para calcular ganancias
const calculateEarnings = (referrals, commissionRate) => {
    const payingReferrals = referrals.filter(ref => ref.hasGeneratedReferralCommission).length;
    return payingReferrals * commissionRate;
};

router.get('/:telegramId', async (req, res) => {
    try {
        console.log(`[Referral-Debug] Petición recibida para /api/referrals/${req.params.telegramId}`);
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) }).populate('referrals').lean();

        if (!user) {
            console.log(`[Referral-Debug] Usuario ${telegramId} no encontrado.`);
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        console.log(`[Referral-Debug] Usuario principal encontrado. Tiene ${user.referrals.length} referidos directos.`);

        // --- LÓGICA DE CONTEO NIVEL POR NIVEL (CLARA Y CORRECTA) ---
        // Nivel 1 ya lo tenemos gracias a .populate()
        const level1Refs = user.referrals;
        console.log(`[Referral-Debug] Nivel 1: ${level1Refs.length} invitados.`);

        // Nivel 2: Buscamos los referidos de nuestros referidos de Nivel 1
        const level1Ids = level1Refs.map(ref => ref._id);
        const level2Refs = level1Ids.length > 0 ? await User.find({ referrerId: { $in: level1Ids } }).lean() : [];
        console.log(`[Referral-Debug] Nivel 2: ${level2Refs.length} invitados.`);

        // Nivel 3: Buscamos los referidos de nuestros referidos de Nivel 2
        const level2Ids = level2Refs.map(ref => ref._id);
        const level3Refs = level2Ids.length > 0 ? await User.find({ referrerId: { $in: level2Ids } }).lean() : [];
        console.log(`[Referral-Debug] Nivel 3: ${level3Refs.length} invitados.`);

        // --- CÁLCULO DE DATOS ---
        const level1Earnings = calculateEarnings(level1Refs, COMMISSIONS.level1);
        const level2Earnings = calculateEarnings(level2Refs, COMMISSIONS.level2);
        const level3Earnings = calculateEarnings(level3Refs, COMMISSIONS.level3);
        
        const responseData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
                { level: 1, title: 'Nivel 1', invites: level1Refs.length, earnings: level1Earnings.toFixed(2), color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1}` },
                { level: 2, title: 'Nivel 2', invites: level2Refs.length, earnings: level2Earnings.toFixed(2), color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2}` },
                { level: 3, title: 'Nivel 3', invites: level3Refs.length, earnings: level3Earnings.toFixed(2), color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3}` }
            ]
        };
        
        console.log('[Referral-Debug] Enviando respuesta:', JSON.stringify(responseData, null, 2));
        res.status(200).json(responseData);

    } catch (error) {
        console.error("❌ [Referral-Debug] Error CRÍTICO en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor al obtener datos de referidos.' });
    }
});

module.exports = router;