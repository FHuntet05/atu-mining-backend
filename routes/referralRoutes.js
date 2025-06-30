// --- START OF FILE atu-mining-api/routes/referralRoutes.js (COMPLETO Y CORREGIDO) ---

const express = require('express');
const router = express.Router();
const User = require('../models/User');
// Importamos la configuración central
const { referralCommissions } = require('../config/economy'); 

const calculateEarnings = (referrals, commissionRate) => {
    const payingReferrals = referrals.filter(ref => ref.hasGeneratedReferralCommission).length;
    return payingReferrals * commissionRate;
};

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) })
            .populate({ path: 'referrals', select: 'hasGeneratedReferralCommission _id' }).lean();

        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
        
        const level1Refs = user.referrals || [];
        const level1Ids = level1Refs.map(u => u._id);
        const level2Refs = level1Ids.length > 0 ? await User.find({ referrerId: { $in: level1Ids } }).select('hasGeneratedReferralCommission _id').lean() : [];
        const level2Ids = level2Refs.map(u => u._id);
        const level3Refs = level2Ids.length > 0 ? await User.find({ referrerId: { $in: level2Ids } }).select('hasGeneratedReferralCommission').lean() : [];

        // Usamos las comisiones desde el archivo de configuración
        const responseData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
                { level: 1, title: 'Nivel 1', invites: level1Refs.length, earnings: calculateEarnings(level1Refs, referralCommissions.level1).toFixed(2), color: '#4ef2f7', gainPerReferral: `${referralCommissions.level1}` },
                { level: 2, title: 'Nivel 2', invites: level2Refs.length, earnings: calculateEarnings(level2Refs, referralCommissions.level2).toFixed(2), color: '#f7a84e', gainPerReferral: `${referralCommissions.level2}` },
                { level: 3, title: 'Nivel 3', invites: level3Refs.length, earnings: calculateEarnings(level3Refs, referralCommissions.level3).toFixed(2), color: '#d84ef7', gainPerReferral: `${referralCommissions.level3}` }
            ]
        };
        
        res.status(200).json(responseData);
    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

module.exports = router;

// --- END OF FILE atu-mining-api/routes/referralRoutes.js ---