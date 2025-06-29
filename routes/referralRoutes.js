// atu-mining-api/routes/referralRoutes.js (VERSIÓN FINAL Y FIABLE)
const express = require('express');
const router = express.Router();
const User = require('../models/User');

const COMMISSIONS = { level1: 0.27, level2: 0.17, level3: 0.07 };

const calculateEarnings = (referrals, commissionRate) => {
    const payingReferrals = referrals.filter(ref => ref.hasGeneratedReferralCommission).length;
    return payingReferrals * commissionRate;
};

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) })
            .populate({ // Usamos populate para traer los datos de los referidos de Nivel 1
                path: 'referrals',
                select: 'hasGeneratedReferralCommission _id'
            }).lean();

        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
        
        // --- CONTEO Y CÁLCULO NIVEL POR NIVEL ---
        const level1Refs = user.referrals || [];
        
        const level1Ids = level1Refs.map(u => u._id);
        const level2Refs = level1Ids.length > 0 ? await User.find({ referrerId: { $in: level1Ids } }).select('hasGeneratedReferralCommission _id').lean() : [];
        
        const level2Ids = level2Refs.map(u => u._id);
        const level3Refs = level2Ids.length > 0 ? await User.find({ referrerId: { $in: level2Ids } }).select('hasGeneratedReferralCommission').lean() : [];

        const responseData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
                { level: 1, title: 'Nivel 1', invites: level1Refs.length, earnings: calculateEarnings(level1Refs, COMMISSIONS.level1).toFixed(2), color: '#4ef2f7', gainPerReferral: `${COMMISSIONS.level1}` },
                { level: 2, title: 'Nivel 2', invites: level2Refs.length, earnings: calculateEarnings(level2Refs, COMMISSIONS.level2).toFixed(2), color: '#f7a84e', gainPerReferral: `${COMMISSIONS.level2}` },
                { level: 3, title: 'Nivel 3', invites: level3Refs.length, earnings: calculateEarnings(level3Refs, COMMISSIONS.level3).toFixed(2), color: '#d84ef7', gainPerReferral: `${COMMISSIONS.level3}` }
            ]
        };
        
        res.status(200).json(responseData);
    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

module.exports = router;