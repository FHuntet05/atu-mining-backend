// En: atu-mining-backend/routes/referralRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

const REFERRAL_BONUS_USDT = 0.27; // Comisión por cada referido activo de Nivel 1

router.get('/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await User.findOne({ telegramId }).populate('referrals');
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

        const level1Referrals = user.referrals || [];
        const level1ActiveCount = user.activeReferrals ? user.activeReferrals.length : 0;
        
        let level2ReferralsCount = 0;
        let level3ReferralsCount = 0;

        for (const ref of level1Referrals) {
            level2ReferralsCount += ref.referrals ? ref.referrals.length : 0;
            const level2Users = await User.find({_id: {$in: ref.referrals}}).populate('referrals');
            for(const ref2 of level2Users) {
                level3ReferralsCount += ref2.referrals ? ref2.referrals.length : 0;
            }
        }

        const referralData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0,
            tiers: [
              { level: 1, title: 'Nivel 1', invites: `${level1ActiveCount} / ${level1Referrals.length}`, earnings: (user.referralEarnings || 0).toFixed(2), color: '#4ef2f7', gainPerReferral: `${REFERRAL_BONUS_USDT} USDT` },
              { level: 2, title: 'Nivel 2', invites: level2ReferralsCount, earnings: '0.00', color: '#f7a84e', gainPerReferral: 'Próximamente' },
              { level: 3, title: 'Nivel 3', invites: level3ReferralsCount, earnings: '0.00', color: '#d84ef7', gainPerReferral: 'Próximamente' },
            ]
        };
        res.status(200).json(referralData);
    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor.' });
    }
});

module.exports = router;